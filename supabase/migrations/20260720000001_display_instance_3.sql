-- =============================================================================
-- Migration: Clone WC instance #1 into display instance #3 with anonymised users
-- =============================================================================
-- Creates 48 synthetic users with Animal + Surname pseudonyms, then copies all
-- competition data from instance #1 with user_id remapping. Events/rounds are
-- shared via tournament_id and are NOT duplicated.
--
-- Idempotent: checks if instance #3 already exists before running.
-- Uses session_replication_role = 'replica' to bypass triggers and FK checks
-- (synthetic users are not in auth.users).
-- =============================================================================

DO $$
DECLARE
  v_source_comp_id uuid := '1a4448e5-a178-45ab-b819-a0dfab370306';
  v_tournament_id  uuid := 'a0000000-0000-0000-0000-000000000026';
  v_new_comp_id    uuid;
  v_exists         boolean;
BEGIN

  -- Idempotency check: skip if instance #3 already exists for this tournament
  SELECT EXISTS(
    SELECT 1 FROM competitions
    WHERE tournament_id = v_tournament_id AND instance_number = 3
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'Display instance #3 already exists — skipping migration.';
    RETURN;
  END IF;

  -- Disable triggers and FK checks for bulk insert
  SET session_replication_role = 'replica';

  -- =========================================================================
  -- 1. Create user mapping temp table: real user_id -> synthetic user_id + name
  -- =========================================================================
  CREATE TEMP TABLE _user_map (
    old_user_id uuid NOT NULL,
    new_user_id uuid NOT NULL,
    display_name text NOT NULL,
    row_num int NOT NULL
  ) ON COMMIT DROP;

  -- Build the animal + surname pseudonym pairs
  -- 48 animals x matched to 48 surnames (deterministic pairing)
  WITH animals(idx, name) AS (
    VALUES
      (1,'Otter'),(2,'Hawk'),(3,'Lynx'),(4,'Badger'),(5,'Fox'),
      (6,'Stoat'),(7,'Heron'),(8,'Pine Marten'),(9,'Hare'),(10,'Owl'),
      (11,'Falcon'),(12,'Stag'),(13,'Salmon'),(14,'Wren'),(15,'Curlew'),
      (16,'Kestrel'),(17,'Jay'),(18,'Magpie'),(19,'Raven'),(20,'Finch'),
      (21,'Swift'),(22,'Robin'),(23,'Linnet'),(24,'Goldcrest'),(25,'Pike'),
      (26,'Trout'),(27,'Mackerel'),(28,'Seal'),(29,'Dolphin'),(30,'Whale'),
      (31,'Puffin'),(32,'Gannet'),(33,'Razorbill'),(34,'Tern'),(35,'Plover'),
      (36,'Lapwing'),(37,'Snipe'),(38,'Woodcock'),(39,'Pheasant'),(40,'Partridge'),
      (41,'Grouse'),(42,'Buzzard'),(43,'Harrier'),(44,'Eagle'),(45,'Osprey'),
      (46,'Merlin'),(47,'Goshawk'),(48,'Sparrowhawk')
  ),
  surnames(idx, name) AS (
    VALUES
      -- Mexican (10)
      (1,'López'),(2,'García'),(3,'Hernández'),(4,'Ramírez'),(5,'Torres'),
      (6,'Flores'),(7,'Cruz'),(8,'Morales'),(9,'Reyes'),(10,'Mendoza'),
      -- Irish (10)
      (11,'Lynch'),(12,'Murphy'),(13,'O''Brien'),(14,'Kelly'),(15,'Doyle'),
      (16,'Walsh'),(17,'Byrne'),(18,'Ryan'),(19,'O''Sullivan'),(20,'Brennan'),
      -- French (1)
      (21,'Dupont'),
      -- Polish (2)
      (22,'Kowalski'),(23,'Nowak'),
      -- British (15)
      (24,'Smith'),(25,'Clarke'),(26,'Thompson'),(27,'Edwards'),(28,'Hughes'),
      (29,'Bennett'),(30,'Ward'),(31,'Palmer'),(32,'Hart'),(33,'Fletcher'),
      -- Pad remaining 15 with re-used surnames from different origins
      (34,'Lynch'),(35,'García'),(36,'Torres'),(37,'Walsh'),(38,'Murphy'),
      (39,'Ramírez'),(40,'Kelly'),(41,'Dupont'),(42,'Smith'),(43,'Edwards'),
      (44,'Flores'),(45,'Brennan'),(46,'Nowak'),(47,'Clarke'),(48,'Hart')
  ),
  real_users AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn
    FROM competition_members
    WHERE competition_id = v_source_comp_id
  )
  INSERT INTO _user_map (old_user_id, new_user_id, display_name, row_num)
  SELECT
    ru.user_id,
    gen_random_uuid(),
    a.name || ' ' || s.name,
    ru.rn::int
  FROM real_users ru
  JOIN animals a ON a.idx = ru.rn
  JOIN surnames s ON s.idx = ru.rn;

  -- =========================================================================
  -- 2. Create synthetic user records in public.users
  -- =========================================================================
  INSERT INTO public.users (id, email, display_name, is_super_admin, created_at)
  SELECT
    new_user_id,
    'display-' || new_user_id || '@synthetic.predictsport.local',
    display_name,
    false,
    NOW()
  FROM _user_map;

  -- =========================================================================
  -- 3. Create the new competition (instance #3)
  -- =========================================================================
  v_new_comp_id := gen_random_uuid();

  INSERT INTO competitions (
    id, name, description, type, visibility, status, scoring_rules,
    lock_default_minutes, allow_nominations, created_by, invite_code,
    created_at, min_rounds_required, allow_prediction_updates,
    tournament_id, product_mode, entry_closes_at, entry_close_trigger,
    max_entrants, min_entrants, chat_enabled, instance_type, instance_number
  )
  SELECT
    v_new_comp_id,
    name || ' (Display)',
    description,
    type, visibility, status, scoring_rules,
    lock_default_minutes, allow_nominations,
    (SELECT new_user_id FROM _user_map LIMIT 1),  -- synthetic created_by
    'DISPLAY-' || LEFT(v_new_comp_id::text, 8),     -- unique invite code
    NOW(),
    min_rounds_required, allow_prediction_updates,
    tournament_id, product_mode, entry_closes_at, entry_close_trigger,
    max_entrants, min_entrants,
    false,            -- chat disabled on display site
    'full',           -- instance_type (check constraint: full | knockout_only)
    3                 -- instance_number
  FROM competitions
  WHERE id = v_source_comp_id;

  -- =========================================================================
  -- 4. Copy competition_members (48 rows)
  -- =========================================================================
  INSERT INTO competition_members (id, competition_id, user_id, role, joined_at, callout_label)
  SELECT
    gen_random_uuid(),
    v_new_comp_id,
    um.new_user_id,
    cm.role,
    cm.joined_at,
    cm.callout_label
  FROM competition_members cm
  JOIN _user_map um ON um.old_user_id = cm.user_id
  WHERE cm.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 5. Copy classifications (5 rows) — need old->new ID mapping
  -- =========================================================================
  CREATE TEMP TABLE _classification_map (
    old_id uuid NOT NULL,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _classification_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM classifications
  WHERE competition_id = v_source_comp_id;

  INSERT INTO classifications (
    id, competition_id, classification_key, classification_type,
    name, status, scoring_strategy, elimination_strategy, config,
    source_template_key
  )
  SELECT
    cm.new_id,
    v_new_comp_id,
    c.classification_key,
    c.classification_type,
    c.name,
    c.status,
    c.scoring_strategy,
    c.elimination_strategy,
    c.config,
    c.source_template_key
  FROM classifications c
  JOIN _classification_map cm ON cm.old_id = c.id
  WHERE c.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 6. Copy classification_memberships (147 rows)
  -- =========================================================================
  INSERT INTO classification_memberships (
    id, classification_id, competition_id, user_id, status,
    entered_at, eliminated_at, eliminated_window_id, eliminated_stage_id,
    elimination_reason, display_visibility, pseudonym
  )
  SELECT
    gen_random_uuid(),
    clm.new_id,
    v_new_comp_id,
    um.new_user_id,
    cmem.status,
    cmem.entered_at,
    cmem.eliminated_at,
    cmem.eliminated_window_id,
    cmem.eliminated_stage_id,
    cmem.elimination_reason,
    cmem.display_visibility,
    cmem.pseudonym
  FROM classification_memberships cmem
  JOIN _classification_map clm ON clm.old_id = cmem.classification_id
  JOIN _user_map um ON um.old_user_id = cmem.user_id
  WHERE cmem.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 7. Copy classification_phases (6 rows) — need old->new mapping for
  --    self-referencing source_phase_id chain
  -- =========================================================================
  CREATE TEMP TABLE _phase_map (
    old_id uuid NOT NULL,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _phase_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM classification_phases
  WHERE classification_id IN (
    SELECT id FROM classifications WHERE competition_id = v_source_comp_id
  );

  INSERT INTO classification_phases (
    id, classification_id, phase_key, phase_name, phase_order,
    entry_count, exit_count, qualification_rules, pool_structure,
    tiebreaker_rules, scoring_scope, source_phase_id, branch_type,
    status, activated_at, finalised_at, config
  )
  SELECT
    pm.new_id,
    clm.new_id,
    cp.phase_key,
    cp.phase_name,
    cp.phase_order,
    cp.entry_count,
    cp.exit_count,
    cp.qualification_rules,
    cp.pool_structure,
    cp.tiebreaker_rules,
    cp.scoring_scope,
    spm.new_id,          -- remapped source_phase_id (NULL if source is NULL)
    cp.branch_type,
    cp.status,
    cp.activated_at,
    cp.finalised_at,
    cp.config
  FROM classification_phases cp
  JOIN _phase_map pm ON pm.old_id = cp.id
  JOIN _classification_map clm ON clm.old_id = cp.classification_id
  LEFT JOIN _phase_map spm ON spm.old_id = cp.source_phase_id
  WHERE cp.classification_id IN (
    SELECT id FROM classifications WHERE competition_id = v_source_comp_id
  );

  -- =========================================================================
  -- 7b. Copy classification_phase_stages (9 rows) — maps phases to shared
  --     sporting stages. phase_id remapped, sporting_stage_id stays same.
  -- =========================================================================
  INSERT INTO classification_phase_stages (
    id, phase_id, sporting_stage_id, stage_role, stage_order_within_phase
  )
  SELECT
    gen_random_uuid(),
    pm.new_id,
    cps.sporting_stage_id,
    cps.stage_role,
    cps.stage_order_within_phase
  FROM classification_phase_stages cps
  JOIN _phase_map pm ON pm.old_id = cps.phase_id
  WHERE cps.phase_id IN (SELECT old_id FROM _phase_map);

  -- =========================================================================
  -- 8. Copy classification_standings_snapshots (26 rows)
  --    standings_data JSONB: remap user_id + display_name in each entry
  -- =========================================================================
  INSERT INTO classification_standings_snapshots (
    id, classification_id, competition_id, prediction_window_id,
    sporting_stage_id, finalisation_id, snapshot_type, standings_data,
    entrant_count, generated_at, generated_by, generation_method, checksum
  )
  SELECT
    gen_random_uuid(),
    clm.new_id,
    v_new_comp_id,
    css.prediction_window_id,       -- shared (references rounds via tournament)
    css.sporting_stage_id,          -- shared
    NULL,                           -- finalisation_id: not copying result_finalisations
    css.snapshot_type,
    -- Remap user_id and display_name inside standings_data JSONB.
    -- standings_data is normally a JSONB array, but may be an object or null.
    CASE
      WHEN jsonb_typeof(css.standings_data) = 'array' THEN (
        SELECT jsonb_agg(
          CASE
            WHEN um.new_user_id IS NOT NULL THEN
              elem
                || jsonb_build_object('user_id', um.new_user_id)
                || jsonb_build_object('display_name', um.display_name)
            ELSE
              elem
          END
          ORDER BY (elem->>'rank')::int NULLS LAST
        )
        FROM jsonb_array_elements(css.standings_data) AS elem
        LEFT JOIN _user_map um ON um.old_user_id = (elem->>'user_id')::uuid
      )
      ELSE css.standings_data  -- non-array: copy as-is
    END,
    css.entrant_count,
    css.generated_at,
    css.generated_by,
    css.generation_method,
    NULL  -- checksum will be stale after remapping; NULL it out
  FROM classification_standings_snapshots css
  JOIN _classification_map clm ON clm.old_id = css.classification_id
  WHERE css.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 9. Copy predictions (~8k rows)
  --    event_id stays the same (shared via tournament). user_id remapped.
  --    New rows get new IDs so unique constraint (event_prediction_type_id, user_id)
  --    is satisfied since user_id is different.
  -- =========================================================================
  INSERT INTO predictions (
    id, event_id, user_id, prediction_type, prediction_data,
    is_correct, is_partial, points_awarded, submitted_at, updated_at,
    note_text, note_visibility, event_prediction_type_id, confidence_level
  )
  SELECT
    gen_random_uuid(),
    p.event_id,
    um.new_user_id,
    p.prediction_type,
    p.prediction_data,
    p.is_correct,
    p.is_partial,
    p.points_awarded,
    p.submitted_at,
    p.updated_at,
    NULL,                -- note_text: strip personal notes for display site
    p.note_visibility,
    p.event_prediction_type_id,
    p.confidence_level
  FROM predictions p
  JOIN _user_map um ON um.old_user_id = p.user_id
  WHERE p.event_id IN (
    SELECT e.id FROM events e
    WHERE e.tournament_id = v_tournament_id
  );

  -- =========================================================================
  -- 10. Copy bracket_prediction_submissions (1 row)
  -- =========================================================================
  INSERT INTO bracket_prediction_submissions (
    id, competition_id, classification_id, bracket_template_id,
    user_id, version_number, status, bracket_data,
    submitted_at, locked_at, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_new_comp_id,
    clm.new_id,
    bps.bracket_template_id,    -- shared template
    um.new_user_id,
    bps.version_number,
    bps.status,
    bps.bracket_data,           -- team names inside, no user_id remapping needed
    bps.submitted_at,
    bps.locked_at,
    bps.created_at,
    bps.updated_at
  FROM bracket_prediction_submissions bps
  JOIN _classification_map clm ON clm.old_id = bps.classification_id
  JOIN _user_map um ON um.old_user_id = bps.user_id
  WHERE bps.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 11. Copy format_prediction_groups (17 rows)
  --     Need old->new mapping for format_group_memberships
  -- =========================================================================
  CREATE TEMP TABLE _group_map (
    old_id uuid NOT NULL,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _group_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM format_prediction_groups
  WHERE competition_id = v_source_comp_id;

  INSERT INTO format_prediction_groups (
    id, classification_id, competition_id, group_name, group_number,
    target_size, metadata, status, phase_id
  )
  SELECT
    gm.new_id,
    clm.new_id,
    v_new_comp_id,
    fpg.group_name,
    fpg.group_number,
    fpg.target_size,
    fpg.metadata,
    fpg.status,
    pm.new_id          -- remapped phase_id (NULL if source is NULL)
  FROM format_prediction_groups fpg
  JOIN _group_map gm ON gm.old_id = fpg.id
  JOIN _classification_map clm ON clm.old_id = fpg.classification_id
  LEFT JOIN _phase_map pm ON pm.old_id = fpg.phase_id
  WHERE fpg.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 12. Copy format_group_memberships (110 rows)
  -- =========================================================================
  INSERT INTO format_group_memberships (
    id, group_id, classification_id, user_id, seed_position, status
  )
  SELECT
    gen_random_uuid(),
    gm.new_id,
    clm.new_id,
    um.new_user_id,
    fgm.seed_position,
    fgm.status
  FROM format_group_memberships fgm
  JOIN _group_map gm ON gm.old_id = fgm.group_id
  JOIN _classification_map clm ON clm.old_id = fgm.classification_id
  JOIN _user_map um ON um.old_user_id = fgm.user_id
  WHERE fgm.classification_id IN (
    SELECT id FROM classifications WHERE competition_id = v_source_comp_id
  );

  -- =========================================================================
  -- 13. Copy member_tags (210 rows)
  -- =========================================================================
  INSERT INTO member_tags (
    id, competition_id, user_id, round_id, event_id,
    tag_name, tag_variant, tag_category, stats, status,
    assigned_at, published_at, rejected_at, expired_at,
    suppressed_by, suppressed_at, created_at, accepted_at
  )
  SELECT
    gen_random_uuid(),
    v_new_comp_id,
    um.new_user_id,
    mt.round_id,        -- shared (rounds are per tournament)
    mt.event_id,        -- shared
    mt.tag_name,
    mt.tag_variant,
    mt.tag_category,
    mt.stats,
    mt.status,
    mt.assigned_at,
    mt.published_at,
    mt.rejected_at,
    mt.expired_at,
    NULL,               -- suppressed_by: not remapping admin actions
    mt.suppressed_at,
    mt.created_at,
    mt.accepted_at
  FROM member_tags mt
  JOIN _user_map um ON um.old_user_id = mt.user_id
  WHERE mt.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 14. Copy stage_results (110 rows) — needed for display site group tables
  -- =========================================================================
  INSERT INTO stage_results (
    id, competition_id, classification_id, sporting_stage_id,
    group_id, user_id, rank, points, status, snapshot_at,
    exact_hits, outcome_hits
  )
  SELECT
    gen_random_uuid(),
    v_new_comp_id,
    clm.new_id,
    sr.sporting_stage_id,       -- shared
    gm.new_id,                  -- remapped group_id
    um.new_user_id,
    sr.rank,
    sr.points,
    sr.status,
    sr.snapshot_at,
    sr.exact_hits,
    sr.outcome_hits
  FROM stage_results sr
  JOIN _classification_map clm ON clm.old_id = sr.classification_id
  LEFT JOIN _group_map gm ON gm.old_id = sr.group_id
  JOIN _user_map um ON um.old_user_id = sr.user_id
  WHERE sr.competition_id = v_source_comp_id;

  -- =========================================================================
  -- 15. Copy result_finalisations (13 rows) — needed for display site state
  -- =========================================================================
  INSERT INTO result_finalisations (
    id, competition_id, prediction_window_id, sporting_stage_id,
    finalisation_type, status, finalised_at, finalised_by,
    finalisation_method, metadata
  )
  SELECT
    gen_random_uuid(),
    v_new_comp_id,
    rf.prediction_window_id,    -- shared (rounds)
    rf.sporting_stage_id,       -- shared
    rf.finalisation_type,
    rf.status,
    rf.finalised_at,
    NULL,                       -- finalised_by: not remapping admin user
    rf.finalisation_method,
    rf.metadata
  FROM result_finalisations rf
  WHERE rf.competition_id = v_source_comp_id;

  -- =========================================================================
  -- Done — restore normal trigger/FK behavior
  -- =========================================================================
  SET session_replication_role = 'origin';

  RAISE NOTICE 'Display instance #3 created successfully. Competition ID: %', v_new_comp_id;

END $$;
