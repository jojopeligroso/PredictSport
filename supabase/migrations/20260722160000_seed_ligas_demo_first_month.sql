-- Seed: /ligas-invernales demo data — first month of the 2025-26 season.
--
-- Purpose: make the predict -> score -> rank loop demonstrable on the LIVE open
-- instance the picks page resolves (NOT the hardcoded uuid the backfills use).
--
-- Per national league (real MLB Stats data, first 30 days of the 2025-26 season):
--   * resulted games with real scores  -> results view + standings populate
--   * pre-scored predictions for the synthetic seed-fan members (spread accuracy)
--   * classification_memberships for those members (standings read that table)
--   * 3 near-future 'upcoming' games      -> the "make a pick" step is demoable
-- Serie del Caribe: 6-nation round-robin seeded as 'upcoming' — the real Feb-2026
-- box scores are unavailable from this environment, so no results are fabricated.
--
-- Idempotent + guarded: each block no-ops if the instance is missing or already
-- seeded. NOTE: authored without live-DB access (Supabase unreachable from the
-- build session); review before applying.

-- ── LMP ──────────────────────────────────────────────
DO $$
DECLARE
  v_slug     text := 'lmp';
  v_provider text := 'winter/lmp';
  v_admin uuid; v_tour uuid; v_comp uuid; v_class uuid;
  v_event uuid; v_ept uuid; v_winner text; v_lock timestamptz;
  v_fans uuid[]; v_pick text; g int := 0; i int; rec record;
BEGIN
  SELECT id INTO v_admin FROM public.users WHERE is_super_admin = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_tour FROM public.sporting_tournaments WHERE slug LIKE v_slug || '-%' ORDER BY starts_at DESC LIMIT 1;
  IF v_tour IS NULL THEN RAISE NOTICE '[ligas-demo] % : no tournament', v_slug; RETURN; END IF;
  SELECT id INTO v_comp FROM public.competitions
    WHERE tournament_id = v_tour AND type='open' AND status='active' AND product_mode='predictsport_full'
    ORDER BY instance_number ASC LIMIT 1;
  IF v_comp IS NULL THEN RAISE NOTICE '[ligas-demo] % : no live open instance', v_slug; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE competition_id = v_comp AND external_event_id = '826059') THEN
    RAISE NOTICE '[ligas-demo] % : already seeded, skipping', v_slug; RETURN; END IF;
  SELECT id INTO v_class FROM public.classifications
    WHERE competition_id = v_comp AND classification_type='leaderboard' ORDER BY created_at LIMIT 1;
  SELECT array_agg(u.id ORDER BY u.email) INTO v_fans FROM public.users u
    JOIN public.competition_members m ON m.user_id = u.id AND m.competition_id = v_comp
    WHERE u.email LIKE 'seed-fan-%@synthetic.predictsport.local';
  IF v_fans IS NULL THEN v_fans := ARRAY[]::uuid[]; END IF;
  IF v_class IS NOT NULL THEN
    INSERT INTO public.classification_memberships (classification_id, competition_id, user_id, status)
    SELECT v_class, v_comp, uid, 'active' FROM unnest(v_fans) AS uid
    ON CONFLICT (classification_id, user_id) DO NOTHING;
  END IF;
  FOR rec IN SELECT * FROM (VALUES
    ('Jaguares de Nayarit', 'Venados de Mazatlán', '2025-10-16T02:00:00Z'::timestamptz, '826059', 4, 6),
    ('Naranjeros de Hermosillo', 'Tucson Baseball Team', '2025-10-16T02:30:00Z'::timestamptz, '826054', 6, 1),
    ('Algodoneros de Guasave', 'Tomateros de Culiacán', '2025-10-16T02:30:00Z'::timestamptz, '826090', 5, 2),
    ('Cañeros de Los Mochis', 'Yaquis de Obregón', '2025-10-16T03:15:00Z'::timestamptz, '826055', 4, 1),
    ('Águilas de Mexicali', 'Charros de Jalisco', '2025-10-16T03:30:00Z'::timestamptz, '826057', 5, 1),
    ('Charros de Jalisco', 'Águilas de Mexicali', '2025-10-17T02:00:00Z'::timestamptz, '826061', 8, 5),
    ('Yaquis de Obregón', 'Cañeros de Los Mochis', '2025-10-17T02:30:00Z'::timestamptz, '826053', 0, 6),
    ('Tucson Baseball Team', 'Naranjeros de Hermosillo', '2025-10-17T02:30:00Z'::timestamptz, '826058', 4, 9),
    ('Venados de Mazatlán', 'Jaguares de Nayarit', '2025-10-17T03:00:00Z'::timestamptz, '826048', 0, 2),
    ('Tomateros de Culiacán', 'Algodoneros de Guasave', '2025-10-17T03:05:00Z'::timestamptz, '826126', 6, 5),
    ('Charros de Jalisco', 'Algodoneros de Guasave', '2025-10-18T01:30:00Z'::timestamptz, '826129', 7, 6),
    ('Tomateros de Culiacán', 'Águilas de Mexicali', '2025-10-18T02:05:00Z'::timestamptz, '826050', 3, 2),
    ('Yaquis de Obregón', 'Venados de Mazatlán', '2025-10-18T02:10:00Z'::timestamptz, '826045', 1, 0),
    ('Tucson Baseball Team', 'Naranjeros de Hermosillo', '2025-10-18T02:30:00Z'::timestamptz, '826049', 5, 1),
    ('Cañeros de Los Mochis', 'Jaguares de Nayarit', '2025-10-18T02:30:00Z'::timestamptz, '826052', 5, 7),
    ('Charros de Jalisco', 'Algodoneros de Guasave', '2025-10-19T00:00:00Z'::timestamptz, '826128', 7, 5),
    ('Tucson Baseball Team', 'Naranjeros de Hermosillo', '2025-10-19T01:00:00Z'::timestamptz, '826038', 6, 13),
    ('Cañeros de Los Mochis', 'Jaguares de Nayarit', '2025-10-19T01:00:00Z'::timestamptz, '826046', 2, 4),
    ('Tomateros de Culiacán', 'Águilas de Mexicali', '2025-10-19T01:05:00Z'::timestamptz, '826037', 3, 6),
    ('Yaquis de Obregón', 'Venados de Mazatlán', '2025-10-19T01:10:00Z'::timestamptz, '826036', 4, 3),
    ('Charros de Jalisco', 'Algodoneros de Guasave', '2025-10-19T23:00:00Z'::timestamptz, '826127', 5, 8),
    ('Cañeros de Los Mochis', 'Jaguares de Nayarit', '2025-10-20T00:00:00Z'::timestamptz, '826039', 6, 5),
    ('Tucson Baseball Team', 'Naranjeros de Hermosillo', '2025-10-20T00:00:00Z'::timestamptz, '826042', 3, 5),
    ('Tomateros de Culiacán', 'Águilas de Mexicali', '2025-10-20T00:05:00Z'::timestamptz, '826041', 4, 2),
    ('Yaquis de Obregón', 'Venados de Mazatlán', '2025-10-20T00:10:00Z'::timestamptz, '826043', 9, 3),
    ('Venados de Mazatlán', 'Cañeros de Los Mochis', '2025-10-22T02:00:00Z'::timestamptz, '826030', 1, 3),
    ('Naranjeros de Hermosillo', 'Yaquis de Obregón', '2025-10-22T02:30:00Z'::timestamptz, '826031', 10, 11),
    ('Jaguares de Nayarit', 'Tomateros de Culiacán', '2025-10-22T02:30:00Z'::timestamptz, '826033', 4, 3),
    ('Águilas de Mexicali', 'Charros de Jalisco', '2025-10-22T02:30:00Z'::timestamptz, '826044', 7, 10),
    ('Algodoneros de Guasave', 'Tucson Baseball Team', '2025-10-22T02:30:00Z'::timestamptz, '826093', 5, 6),
    ('Venados de Mazatlán', 'Cañeros de Los Mochis', '2025-10-23T02:00:00Z'::timestamptz, '826035', 0, 2),
    ('Naranjeros de Hermosillo', 'Yaquis de Obregón', '2025-10-23T02:30:00Z'::timestamptz, '826026', 4, 2),
    ('Jaguares de Nayarit', 'Tomateros de Culiacán', '2025-10-23T02:30:00Z'::timestamptz, '826027', 3, 4),
    ('Águilas de Mexicali', 'Charros de Jalisco', '2025-10-23T02:30:00Z'::timestamptz, '826029', 8, 2),
    ('Algodoneros de Guasave', 'Tucson Baseball Team', '2025-10-23T02:30:00Z'::timestamptz, '826094', 1, 4),
    ('Venados de Mazatlán', 'Cañeros de Los Mochis', '2025-10-24T02:00:00Z'::timestamptz, '826020', 2, 8),
    ('Jaguares de Nayarit', 'Tomateros de Culiacán', '2025-10-24T02:30:00Z'::timestamptz, '826018', 9, 3),
    ('Naranjeros de Hermosillo', 'Yaquis de Obregón', '2025-10-24T02:30:00Z'::timestamptz, '826019', 5, 3),
    ('Águilas de Mexicali', 'Charros de Jalisco', '2025-10-24T02:30:00Z'::timestamptz, '826034', 4, 2),
    ('Algodoneros de Guasave', 'Tucson Baseball Team', '2025-10-24T02:30:00Z'::timestamptz, '826095', 0, 3),
    ('Charros de Jalisco', 'Jaguares de Nayarit', '2025-10-25T01:30:00Z'::timestamptz, '826025', 7, 6),
    ('Tomateros de Culiacán', 'Venados de Mazatlán', '2025-10-25T02:05:00Z'::timestamptz, '826024', 9, 0),
    ('Tucson Baseball Team', 'Yaquis de Obregón', '2025-10-25T02:10:00Z'::timestamptz, '826016', 1, 5),
    ('Cañeros de Los Mochis', 'Naranjeros de Hermosillo', '2025-10-25T02:30:00Z'::timestamptz, '826022', 5, 6),
    ('Algodoneros de Guasave', 'Águilas de Mexicali', '2025-10-25T02:30:00Z'::timestamptz, '826096', 0, 4),
    ('Charros de Jalisco', 'Jaguares de Nayarit', '2025-10-25T23:00:00Z'::timestamptz, '826014', 12, 6),
    ('Cañeros de Los Mochis', 'Naranjeros de Hermosillo', '2025-10-26T01:00:00Z'::timestamptz, '826006', 6, 2),
    ('Algodoneros de Guasave', 'Águilas de Mexicali', '2025-10-26T01:00:00Z'::timestamptz, '826097', 1, 5),
    ('Tomateros de Culiacán', 'Venados de Mazatlán', '2025-10-26T01:05:00Z'::timestamptz, '826013', 2, 5),
    ('Tucson Baseball Team', 'Yaquis de Obregón', '2025-10-26T01:10:00Z'::timestamptz, '826009', 7, 15),
    ('Charros de Jalisco', 'Jaguares de Nayarit', '2025-10-26T23:00:00Z'::timestamptz, '826012', 7, 6),
    ('Cañeros de Los Mochis', 'Naranjeros de Hermosillo', '2025-10-27T00:00:00Z'::timestamptz, '826011', 2, 14),
    ('Algodoneros de Guasave', 'Águilas de Mexicali', '2025-10-27T00:00:00Z'::timestamptz, '826089', 1, 3),
    ('Tomateros de Culiacán', 'Venados de Mazatlán', '2025-10-27T00:05:00Z'::timestamptz, '826015', 10, 2),
    ('Tucson Baseball Team', 'Yaquis de Obregón', '2025-10-27T00:10:00Z'::timestamptz, '826008', 2, 4),
    ('Venados de Mazatlán', 'Charros de Jalisco', '2025-10-29T02:00:00Z'::timestamptz, '826004', 4, 7),
    ('Yaquis de Obregón', 'Cañeros de Los Mochis', '2025-10-29T02:10:00Z'::timestamptz, '826003', 4, 0),
    ('Naranjeros de Hermosillo', 'Tomateros de Culiacán', '2025-10-29T02:30:00Z'::timestamptz, '825997', 0, 6),
    ('Águilas de Mexicali', 'Tucson Baseball Team', '2025-10-29T02:30:00Z'::timestamptz, '826007', 1, 8),
    ('Jaguares de Nayarit', 'Algodoneros de Guasave', '2025-10-29T02:30:00Z'::timestamptz, '826122', 5, 4),
    ('Venados de Mazatlán', 'Charros de Jalisco', '2025-10-30T02:00:00Z'::timestamptz, '825999', 6, 5),
    ('Yaquis de Obregón', 'Cañeros de Los Mochis', '2025-10-30T02:10:00Z'::timestamptz, '825998', 3, 1),
    ('Naranjeros de Hermosillo', 'Tomateros de Culiacán', '2025-10-30T02:30:00Z'::timestamptz, '826000', 5, 4),
    ('Águilas de Mexicali', 'Tucson Baseball Team', '2025-10-30T02:30:00Z'::timestamptz, '826002', 5, 4),
    ('Jaguares de Nayarit', 'Algodoneros de Guasave', '2025-10-30T02:30:00Z'::timestamptz, '826123', 1, 12),
    ('Venados de Mazatlán', 'Charros de Jalisco', '2025-10-31T02:00:00Z'::timestamptz, '825993', 7, 13),
    ('Yaquis de Obregón', 'Cañeros de Los Mochis', '2025-10-31T02:10:00Z'::timestamptz, '825994', 2, 3),
    ('Águilas de Mexicali', 'Tucson Baseball Team', '2025-10-31T02:30:00Z'::timestamptz, '825986', 6, 7),
    ('Naranjeros de Hermosillo', 'Tomateros de Culiacán', '2025-10-31T02:30:00Z'::timestamptz, '825995', 8, 9),
    ('Jaguares de Nayarit', 'Algodoneros de Guasave', '2025-10-31T02:30:00Z'::timestamptz, '826124', 15, 2),
    ('Charros de Jalisco', 'Naranjeros de Hermosillo', '2025-11-01T01:30:00Z'::timestamptz, '825990', 9, 1),
    ('Tomateros de Culiacán', 'Yaquis de Obregón', '2025-11-01T02:05:00Z'::timestamptz, '825989', 2, 6),
    ('Tucson Baseball Team', 'Cañeros de Los Mochis', '2025-11-01T02:30:00Z'::timestamptz, '825988', 1, 2),
    ('Águilas de Mexicali', 'Jaguares de Nayarit', '2025-11-01T02:30:00Z'::timestamptz, '825992', 2, 5),
    ('Algodoneros de Guasave', 'Venados de Mazatlán', '2025-11-01T02:30:00Z'::timestamptz, '826082', 2, 7),
    ('Charros de Jalisco', 'Naranjeros de Hermosillo', '2025-11-02T00:00:00Z'::timestamptz, '825982', 5, 4),
    ('Tucson Baseball Team', 'Cañeros de Los Mochis', '2025-11-02T01:00:00Z'::timestamptz, '825980', 4, 5),
    ('Águilas de Mexicali', 'Jaguares de Nayarit', '2025-11-02T01:00:00Z'::timestamptz, '825987', 10, 6),
    ('Algodoneros de Guasave', 'Venados de Mazatlán', '2025-11-02T01:00:00Z'::timestamptz, '826088', 11, 10),
    ('Tomateros de Culiacán', 'Yaquis de Obregón', '2025-11-02T01:05:00Z'::timestamptz, '825981', 4, 6),
    ('Charros de Jalisco', 'Naranjeros de Hermosillo', '2025-11-02T23:00:00Z'::timestamptz, '825985', 9, 7),
    ('Tucson Baseball Team', 'Cañeros de Los Mochis', '2025-11-03T00:00:00Z'::timestamptz, '825970', 4, 7),
    ('Águilas de Mexicali', 'Jaguares de Nayarit', '2025-11-03T00:00:00Z'::timestamptz, '825979', 1, 2),
    ('Algodoneros de Guasave', 'Venados de Mazatlán', '2025-11-03T00:00:00Z'::timestamptz, '826087', 5, 4),
    ('Tomateros de Culiacán', 'Yaquis de Obregón', '2025-11-03T00:05:00Z'::timestamptz, '825984', 6, 2),
    ('Venados de Mazatlán', 'Águilas de Mexicali', '2025-11-05T02:00:00Z'::timestamptz, '825975', 2, 1),
    ('Yaquis de Obregón', 'Charros de Jalisco', '2025-11-05T02:10:00Z'::timestamptz, '825976', 8, 6),
    ('Cañeros de Los Mochis', 'Tomateros de Culiacán', '2025-11-05T02:30:00Z'::timestamptz, '825968', 8, 5),
    ('Jaguares de Nayarit', 'Tucson Baseball Team', '2025-11-05T02:30:00Z'::timestamptz, '825969', 10, 2),
    ('Naranjeros de Hermosillo', 'Algodoneros de Guasave', '2025-11-05T02:30:00Z'::timestamptz, '826125', 9, 3),
    ('Venados de Mazatlán', 'Águilas de Mexicali', '2025-11-06T02:00:00Z'::timestamptz, '825974', 0, 3),
    ('Yaquis de Obregón', 'Charros de Jalisco', '2025-11-06T02:10:00Z'::timestamptz, '825966', 6, 5),
    ('Jaguares de Nayarit', 'Tucson Baseball Team', '2025-11-06T02:30:00Z'::timestamptz, '825973', 3, 5),
    ('Cañeros de Los Mochis', 'Tomateros de Culiacán', '2025-11-06T02:30:00Z'::timestamptz, '825977', 5, 10),
    ('Naranjeros de Hermosillo', 'Algodoneros de Guasave', '2025-11-06T02:30:00Z'::timestamptz, '826117', 1, 2),
    ('Venados de Mazatlán', 'Águilas de Mexicali', '2025-11-07T02:00:00Z'::timestamptz, '825960', 0, 2),
    ('Yaquis de Obregón', 'Charros de Jalisco', '2025-11-07T02:10:00Z'::timestamptz, '825961', 2, 0),
    ('Cañeros de Los Mochis', 'Tomateros de Culiacán', '2025-11-07T02:30:00Z'::timestamptz, '825963', 3, 1),
    ('Jaguares de Nayarit', 'Tucson Baseball Team', '2025-11-07T02:30:00Z'::timestamptz, '825964', 4, 2),
    ('Naranjeros de Hermosillo', 'Algodoneros de Guasave', '2025-11-07T02:30:00Z'::timestamptz, '826121', 5, 8),
    ('Charros de Jalisco', 'Cañeros de Los Mochis', '2025-11-08T01:30:00Z'::timestamptz, '825959', 5, 8),
    ('Tucson Baseball Team', 'Tomateros de Culiacán', '2025-11-08T02:05:00Z'::timestamptz, '825951', 3, 2),
    ('Jaguares de Nayarit', 'Venados de Mazatlán', '2025-11-08T02:30:00Z'::timestamptz, '825965', 6, 8),
    ('Algodoneros de Guasave', 'Yaquis de Obregón', '2025-11-08T02:30:00Z'::timestamptz, '826086', 1, 5),
    ('Águilas de Mexicali', 'Naranjeros de Hermosillo', '2025-11-08T03:30:00Z'::timestamptz, '825958', 4, 6),
    ('Charros de Jalisco', 'Cañeros de Los Mochis', '2025-11-09T00:00:00Z'::timestamptz, '825954', 6, 3),
    ('Jaguares de Nayarit', 'Venados de Mazatlán', '2025-11-09T01:00:00Z'::timestamptz, '825949', 5, 8),
    ('Algodoneros de Guasave', 'Yaquis de Obregón', '2025-11-09T01:00:00Z'::timestamptz, '826085', 4, 6),
    ('Tucson Baseball Team', 'Tomateros de Culiacán', '2025-11-09T01:05:00Z'::timestamptz, '825953', 5, 4),
    ('Águilas de Mexicali', 'Naranjeros de Hermosillo', '2025-11-09T02:00:00Z'::timestamptz, '825955', 3, 6),
    ('Charros de Jalisco', 'Cañeros de Los Mochis', '2025-11-09T23:00:00Z'::timestamptz, '825952', 1, 0),
    ('Jaguares de Nayarit', 'Venados de Mazatlán', '2025-11-09T23:00:00Z'::timestamptz, '825956', 2, 0),
    ('Águilas de Mexicali', 'Naranjeros de Hermosillo', '2025-11-10T00:00:00Z'::timestamptz, '825950', 2, 3),
    ('Algodoneros de Guasave', 'Yaquis de Obregón', '2025-11-10T00:00:00Z'::timestamptz, '826084', 7, 0),
    ('Tucson Baseball Team', 'Tomateros de Culiacán', '2025-11-10T00:05:00Z'::timestamptz, '825947', 4, 5),
    ('Venados de Mazatlán', 'Tucson Baseball Team', '2025-11-12T02:00:00Z'::timestamptz, '825943', 5, 3),
    ('Tomateros de Culiacán', 'Charros de Jalisco', '2025-11-12T02:05:00Z'::timestamptz, '825942', 9, 8),
    ('Yaquis de Obregón', 'Águilas de Mexicali', '2025-11-12T02:10:00Z'::timestamptz, '825939', 3, 2),
    ('Naranjeros de Hermosillo', 'Jaguares de Nayarit', '2025-11-12T02:30:00Z'::timestamptz, '825945', 7, 6),
    ('Cañeros de Los Mochis', 'Algodoneros de Guasave', '2025-11-12T02:30:00Z'::timestamptz, '826118', 7, 3),
    ('Venados de Mazatlán', 'Tucson Baseball Team', '2025-11-13T02:00:00Z'::timestamptz, '825935', 1, 2),
    ('Tomateros de Culiacán', 'Charros de Jalisco', '2025-11-13T02:05:00Z'::timestamptz, '825936', 7, 5),
    ('Yaquis de Obregón', 'Águilas de Mexicali', '2025-11-13T02:10:00Z'::timestamptz, '825937', 4, 6),
    ('Naranjeros de Hermosillo', 'Jaguares de Nayarit', '2025-11-13T02:30:00Z'::timestamptz, '825944', 3, 10),
    ('Cañeros de Los Mochis', 'Algodoneros de Guasave', '2025-11-13T02:30:00Z'::timestamptz, '826119', 8, 11),
    ('Venados de Mazatlán', 'Tucson Baseball Team', '2025-11-14T02:00:00Z'::timestamptz, '825927', 4, 5),
    ('Tomateros de Culiacán', 'Charros de Jalisco', '2025-11-14T02:05:00Z'::timestamptz, '825931', 9, 4),
    ('Yaquis de Obregón', 'Águilas de Mexicali', '2025-11-14T02:10:00Z'::timestamptz, '825933', 5, 4),
    ('Naranjeros de Hermosillo', 'Jaguares de Nayarit', '2025-11-14T02:30:00Z'::timestamptz, '825938', 2, 1)
  ) AS t(home, away, ts, ext, hs, as_) LOOP
    g := g + 1;
    v_winner := CASE WHEN rec.hs > rec.as_ THEN rec.home ELSE rec.away END;
    v_lock := rec.ts - interval '10 minutes';
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status, result_data, result_confirmed, result_confirmed_by)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      rec.ts, v_lock, 'resulted',
      jsonb_build_object('score', jsonb_build_object('home_team', rec.home, 'away_team', rec.away,
        'home_score', rec.hs, 'away_score', rec.as_), 'home', rec.hs, 'away', rec.as_),
      true, v_admin) RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)))
    RETURNING id INTO v_ept;
    FOR i IN 1..COALESCE(array_length(v_fans, 1), 0) LOOP
      v_pick := CASE WHEN ((i*31 + g*17) % 100) < (46 + i*3) THEN v_winner
        ELSE (CASE WHEN v_winner = rec.home THEN rec.away ELSE rec.home END) END;
      INSERT INTO public.predictions (event_id, event_prediction_type_id, user_id, prediction_type,
        prediction_data, is_correct, is_partial, points_awarded, submitted_at, updated_at)
      VALUES (v_event, v_ept, v_fans[i], 'winner', jsonb_build_object('value', v_pick),
        v_pick = v_winner, false, CASE WHEN v_pick = v_winner THEN 2 ELSE 0 END,
        v_lock - interval '1 hour', v_lock - interval '1 hour')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  g := 0;
  FOR rec IN SELECT * FROM (VALUES
    ('Cañeros de Los Mochis', 'Algodoneros de Guasave', 2, 'demo-lmp-u1'),
    ('Charros de Jalisco', 'Tucson Baseball Team', 3, 'demo-lmp-u2'),
    ('Venados de Mazatlán', 'Naranjeros de Hermosillo', 4, 'demo-lmp-u3')
  ) AS t(home, away, days, ext) LOOP
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      now() + make_interval(days => rec.days), now() + make_interval(days => rec.days) - interval '10 minutes', 'upcoming')
    RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)));
  END LOOP;
  RAISE NOTICE '[ligas-demo] % seeded % resulted games', v_slug, g;
END $$;

-- ── LVBP ──────────────────────────────────────────────
DO $$
DECLARE
  v_slug     text := 'lvbp';
  v_provider text := 'winter/lvbp';
  v_admin uuid; v_tour uuid; v_comp uuid; v_class uuid;
  v_event uuid; v_ept uuid; v_winner text; v_lock timestamptz;
  v_fans uuid[]; v_pick text; g int := 0; i int; rec record;
BEGIN
  SELECT id INTO v_admin FROM public.users WHERE is_super_admin = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_tour FROM public.sporting_tournaments WHERE slug LIKE v_slug || '-%' ORDER BY starts_at DESC LIMIT 1;
  IF v_tour IS NULL THEN RAISE NOTICE '[ligas-demo] % : no tournament', v_slug; RETURN; END IF;
  SELECT id INTO v_comp FROM public.competitions
    WHERE tournament_id = v_tour AND type='open' AND status='active' AND product_mode='predictsport_full'
    ORDER BY instance_number ASC LIMIT 1;
  IF v_comp IS NULL THEN RAISE NOTICE '[ligas-demo] % : no live open instance', v_slug; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE competition_id = v_comp AND external_event_id = '829812') THEN
    RAISE NOTICE '[ligas-demo] % : already seeded, skipping', v_slug; RETURN; END IF;
  SELECT id INTO v_class FROM public.classifications
    WHERE competition_id = v_comp AND classification_type='leaderboard' ORDER BY created_at LIMIT 1;
  SELECT array_agg(u.id ORDER BY u.email) INTO v_fans FROM public.users u
    JOIN public.competition_members m ON m.user_id = u.id AND m.competition_id = v_comp
    WHERE u.email LIKE 'seed-fan-%@synthetic.predictsport.local';
  IF v_fans IS NULL THEN v_fans := ARRAY[]::uuid[]; END IF;
  IF v_class IS NOT NULL THEN
    INSERT INTO public.classification_memberships (classification_id, competition_id, user_id, status)
    SELECT v_class, v_comp, uid, 'active' FROM unnest(v_fans) AS uid
    ON CONFLICT (classification_id, user_id) DO NOTHING;
  END IF;
  FOR rec IN SELECT * FROM (VALUES
    ('Cardenales de Lara', 'Tigres de Aragua', '2025-10-15T23:00:00Z'::timestamptz, '829812', 3, 8),
    ('Aguilas del Zulia', 'Tiburones de La Guaira', '2025-10-16T23:00:00Z'::timestamptz, '829758', 5, 1),
    ('Navegantes del Magallanes', 'Caribes de Anzoategui', '2025-10-16T23:00:00Z'::timestamptz, '829785', 1, 3),
    ('Bravos de Margarita', 'Leones del Caracas', '2025-10-16T23:00:00Z'::timestamptz, '829925', 6, 2),
    ('Tigres de Aragua', 'Cardenales de Lara', '2025-10-16T23:00:00Z'::timestamptz, '829953', 9, 8),
    ('Aguilas del Zulia', 'Tiburones de La Guaira', '2025-10-17T23:00:00Z'::timestamptz, '829755', 4, 13),
    ('Cardenales de Lara', 'Navegantes del Magallanes', '2025-10-17T23:00:00Z'::timestamptz, '829813', 1, 0),
    ('Bravos de Margarita', 'Leones del Caracas', '2025-10-17T23:00:00Z'::timestamptz, '829924', 6, 13),
    ('Tigres de Aragua', 'Caribes de Anzoategui', '2025-10-17T23:00:00Z'::timestamptz, '829952', 3, 2),
    ('Leones del Caracas', 'Caribes de Anzoategui', '2025-10-18T21:00:00Z'::timestamptz, '829897', 3, 2),
    ('Cardenales de Lara', 'Tiburones de La Guaira', '2025-10-18T21:30:00Z'::timestamptz, '829811', 6, 3),
    ('Aguilas del Zulia', 'Navegantes del Magallanes', '2025-10-18T23:00:00Z'::timestamptz, '829756', 7, 6),
    ('Bravos de Margarita', 'Tigres de Aragua', '2025-10-18T23:00:00Z'::timestamptz, '829922', 1, 2),
    ('Cardenales de Lara', 'Tiburones de La Guaira', '2025-10-19T20:00:00Z'::timestamptz, '829810', 9, 16),
    ('Leones del Caracas', 'Caribes de Anzoategui', '2025-10-19T21:00:00Z'::timestamptz, '829896', 11, 9),
    ('Bravos de Margarita', 'Tigres de Aragua', '2025-10-19T21:00:00Z'::timestamptz, '829923', 3, 1),
    ('Aguilas del Zulia', 'Navegantes del Magallanes', '2025-10-19T23:00:00Z'::timestamptz, '829754', 1, 8),
    ('Tiburones de La Guaira', 'Leones del Caracas', '2025-10-21T22:30:00Z'::timestamptz, '829842', 6, 5),
    ('Navegantes del Magallanes', 'Cardenales de Lara', '2025-10-21T23:00:00Z'::timestamptz, '829782', 2, 6),
    ('Caribes de Anzoategui', 'Bravos de Margarita', '2025-10-21T23:00:00Z'::timestamptz, '829868', 2, 10),
    ('Tiburones de La Guaira', 'Aguilas del Zulia', '2025-10-22T22:30:00Z'::timestamptz, '829840', 7, 15),
    ('Caribes de Anzoategui', 'Bravos de Margarita', '2025-10-22T23:00:00Z'::timestamptz, '829869', 3, 2),
    ('Tigres de Aragua', 'Cardenales de Lara', '2025-10-22T23:00:00Z'::timestamptz, '829950', 9, 4),
    ('Caribes de Anzoategui', 'Aguilas del Zulia', '2025-10-23T23:00:00Z'::timestamptz, '829866', 19, 4),
    ('Cardenales de Lara', 'Navegantes del Magallanes', '2025-10-24T23:00:00Z'::timestamptz, '829809', 8, 7),
    ('Tiburones de La Guaira', 'Leones del Caracas', '2025-10-24T23:00:00Z'::timestamptz, '829839', 3, 5),
    ('Caribes de Anzoategui', 'Aguilas del Zulia', '2025-10-24T23:00:00Z'::timestamptz, '829867', 15, 7),
    ('Tigres de Aragua', 'Bravos de Margarita', '2025-10-24T23:00:00Z'::timestamptz, '829949', 6, 3),
    ('Tigres de Aragua', 'Cardenales de Lara', '2025-10-25T21:00:00Z'::timestamptz, '829948', 5, 4),
    ('Navegantes del Magallanes', 'Bravos de Margarita', '2025-10-25T21:30:00Z'::timestamptz, '829784', 5, 4),
    ('Tiburones de La Guaira', 'Aguilas del Zulia', '2025-10-25T21:30:00Z'::timestamptz, '829837', 3, 4),
    ('Caribes de Anzoategui', 'Leones del Caracas', '2025-10-25T21:30:00Z'::timestamptz, '829864', 7, 4),
    ('Tiburones de La Guaira', 'Bravos de Margarita', '2025-10-26T17:00:00Z'::timestamptz, '829838', 6, 3),
    ('Cardenales de Lara', 'Aguilas del Zulia', '2025-10-26T20:00:00Z'::timestamptz, '829808', 2, 4),
    ('Caribes de Anzoategui', 'Leones del Caracas', '2025-10-26T20:00:00Z'::timestamptz, '829865', 11, 10),
    ('Tigres de Aragua', 'Navegantes del Magallanes', '2025-10-26T21:00:00Z'::timestamptz, '829947', 3, 2),
    ('Aguilas del Zulia', 'Cardenales de Lara', '2025-10-28T23:00:00Z'::timestamptz, '829753', 3, 1),
    ('Navegantes del Magallanes', 'Caribes de Anzoategui', '2025-10-28T23:00:00Z'::timestamptz, '829783', 2, 1),
    ('Leones del Caracas', 'Tigres de Aragua', '2025-10-28T23:00:00Z'::timestamptz, '829895', 7, 5),
    ('Bravos de Margarita', 'Tiburones de La Guaira', '2025-10-28T23:00:00Z'::timestamptz, '829921', 5, 1),
    ('Aguilas del Zulia', 'Cardenales de Lara', '2025-10-29T23:00:00Z'::timestamptz, '829751', 2, 11),
    ('Leones del Caracas', 'Navegantes del Magallanes', '2025-10-29T23:00:00Z'::timestamptz, '829894', 3, 4),
    ('Bravos de Margarita', 'Tiburones de La Guaira', '2025-10-29T23:00:00Z'::timestamptz, '829920', 4, 3),
    ('Tigres de Aragua', 'Caribes de Anzoategui', '2025-10-29T23:00:00Z'::timestamptz, '829946', 6, 5),
    ('Cardenales de Lara', 'Tigres de Aragua', '2025-10-30T23:00:00Z'::timestamptz, '829806', 6, 4),
    ('Leones del Caracas', 'Tiburones de La Guaira', '2025-10-30T23:00:00Z'::timestamptz, '829893', 6, 10),
    ('Bravos de Margarita', 'Navegantes del Magallanes', '2025-10-30T23:00:00Z'::timestamptz, '829919', 10, 9),
    ('Tiburones de La Guaira', 'Tigres de Aragua', '2025-10-31T23:00:00Z'::timestamptz, '829836', 3, 5),
    ('Leones del Caracas', 'Cardenales de Lara', '2025-10-31T23:00:00Z'::timestamptz, '829892', 6, 5),
    ('Bravos de Margarita', 'Navegantes del Magallanes', '2025-10-31T23:00:00Z'::timestamptz, '829917', 4, 3),
    ('Aguilas del Zulia', 'Caribes de Anzoategui', '2025-11-01T20:00:00Z'::timestamptz, '829750', 3, 0),
    ('Aguilas del Zulia', 'Caribes de Anzoategui', '2025-11-01T20:05:00Z'::timestamptz, '829752', 0, 2),
    ('Tigres de Aragua', 'Tiburones de La Guaira', '2025-11-01T21:00:00Z'::timestamptz, '829945', 4, 6),
    ('Navegantes del Magallanes', 'Leones del Caracas', '2025-11-01T23:00:00Z'::timestamptz, '829780', 5, 4),
    ('Bravos de Margarita', 'Cardenales de Lara', '2025-11-01T23:00:00Z'::timestamptz, '829918', 4, 10),
    ('Aguilas del Zulia', 'Caribes de Anzoategui', '2025-11-02T21:00:00Z'::timestamptz, '829748', 5, 2),
    ('Bravos de Margarita', 'Cardenales de Lara', '2025-11-02T21:00:00Z'::timestamptz, '829916', 5, 4),
    ('Navegantes del Magallanes', 'Tiburones de La Guaira', '2025-11-02T21:30:00Z'::timestamptz, '829781', 3, 4),
    ('Leones del Caracas', 'Tigres de Aragua', '2025-11-02T23:00:00Z'::timestamptz, '829890', 5, 10),
    ('Tiburones de La Guaira', 'Tigres de Aragua', '2025-11-04T22:30:00Z'::timestamptz, '829834', 17, 6),
    ('Navegantes del Magallanes', 'Bravos de Margarita', '2025-11-04T23:00:00Z'::timestamptz, '829779', 3, 10),
    ('Caribes de Anzoategui', 'Cardenales de Lara', '2025-11-04T23:00:00Z'::timestamptz, '829862', 4, 11),
    ('Leones del Caracas', 'Aguilas del Zulia', '2025-11-04T23:00:00Z'::timestamptz, '829891', 16, 3),
    ('Tiburones de La Guaira', 'Aguilas del Zulia', '2025-11-05T22:30:00Z'::timestamptz, '829835', 3, 7),
    ('Navegantes del Magallanes', 'Bravos de Margarita', '2025-11-05T23:00:00Z'::timestamptz, '829778', 4, 10),
    ('Caribes de Anzoategui', 'Cardenales de Lara', '2025-11-05T23:00:00Z'::timestamptz, '829863', 3, 2),
    ('Leones del Caracas', 'Tigres de Aragua', '2025-11-05T23:00:00Z'::timestamptz, '829889', 7, 3),
    ('Navegantes del Magallanes', 'Aguilas del Zulia', '2025-11-06T23:00:00Z'::timestamptz, '829776', 2, 7),
    ('Leones del Caracas', 'Bravos de Margarita', '2025-11-06T23:00:00Z'::timestamptz, '829888', 10, 9),
    ('Tigres de Aragua', 'Tiburones de La Guaira', '2025-11-06T23:00:00Z'::timestamptz, '829944', 2, 1),
    ('Cardenales de Lara', 'Bravos de Margarita', '2025-11-07T23:00:00Z'::timestamptz, '829807', 2, 6),
    ('Tiburones de La Guaira', 'Caribes de Anzoategui', '2025-11-07T23:00:00Z'::timestamptz, '829833', 2, 3),
    ('Leones del Caracas', 'Aguilas del Zulia', '2025-11-07T23:00:00Z'::timestamptz, '829887', 8, 5),
    ('Tigres de Aragua', 'Navegantes del Magallanes', '2025-11-07T23:00:00Z'::timestamptz, '829943', 4, 0),
    ('Navegantes del Magallanes', 'Leones del Caracas', '2025-11-08T21:30:00Z'::timestamptz, '829777', 2, 3),
    ('Tiburones de La Guaira', 'Caribes de Anzoategui', '2025-11-08T21:30:00Z'::timestamptz, '829832', 4, 0),
    ('Cardenales de Lara', 'Bravos de Margarita', '2025-11-08T23:00:00Z'::timestamptz, '829804', 9, 6),
    ('Tigres de Aragua', 'Aguilas del Zulia', '2025-11-08T23:00:00Z'::timestamptz, '829942', 13, 3),
    ('Tiburones de La Guaira', 'Bravos de Margarita', '2025-11-09T20:00:00Z'::timestamptz, '829831', 9, 2),
    ('Leones del Caracas', 'Navegantes del Magallanes', '2025-11-09T20:00:00Z'::timestamptz, '829886', 4, 11),
    ('Tigres de Aragua', 'Caribes de Anzoategui', '2025-11-09T21:00:00Z'::timestamptz, '829941', 0, 4),
    ('Cardenales de Lara', 'Aguilas del Zulia', '2025-11-09T22:00:00Z'::timestamptz, '829805', 3, 6),
    ('Aguilas del Zulia', 'Tigres de Aragua', '2025-11-11T23:00:00Z'::timestamptz, '829747', 2, 0),
    ('Navegantes del Magallanes', 'Tiburones de La Guaira', '2025-11-11T23:00:00Z'::timestamptz, '829774', 4, 0),
    ('Bravos de Margarita', 'Caribes de Anzoategui', '2025-11-11T23:00:00Z'::timestamptz, '829915', 7, 2),
    ('Tiburones de La Guaira', 'Navegantes del Magallanes', '2025-11-12T22:30:00Z'::timestamptz, '829830', 7, 2),
    ('Aguilas del Zulia', 'Tigres de Aragua', '2025-11-12T23:00:00Z'::timestamptz, '829746', 10, 7),
    ('Bravos de Margarita', 'Caribes de Anzoategui', '2025-11-12T23:00:00Z'::timestamptz, '829913', 3, 8),
    ('Navegantes del Magallanes', 'Leones del Caracas', '2025-11-13T23:00:00Z'::timestamptz, '829775', 12, 9),
    ('Cardenales de Lara', 'Tigres de Aragua', '2025-11-13T23:00:00Z'::timestamptz, '829802', 5, 3)
  ) AS t(home, away, ts, ext, hs, as_) LOOP
    g := g + 1;
    v_winner := CASE WHEN rec.hs > rec.as_ THEN rec.home ELSE rec.away END;
    v_lock := rec.ts - interval '10 minutes';
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status, result_data, result_confirmed, result_confirmed_by)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      rec.ts, v_lock, 'resulted',
      jsonb_build_object('score', jsonb_build_object('home_team', rec.home, 'away_team', rec.away,
        'home_score', rec.hs, 'away_score', rec.as_), 'home', rec.hs, 'away', rec.as_),
      true, v_admin) RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)))
    RETURNING id INTO v_ept;
    FOR i IN 1..COALESCE(array_length(v_fans, 1), 0) LOOP
      v_pick := CASE WHEN ((i*31 + g*17) % 100) < (46 + i*3) THEN v_winner
        ELSE (CASE WHEN v_winner = rec.home THEN rec.away ELSE rec.home END) END;
      INSERT INTO public.predictions (event_id, event_prediction_type_id, user_id, prediction_type,
        prediction_data, is_correct, is_partial, points_awarded, submitted_at, updated_at)
      VALUES (v_event, v_ept, v_fans[i], 'winner', jsonb_build_object('value', v_pick),
        v_pick = v_winner, false, CASE WHEN v_pick = v_winner THEN 2 ELSE 0 END,
        v_lock - interval '1 hour', v_lock - interval '1 hour')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  g := 0;
  FOR rec IN SELECT * FROM (VALUES
    ('Caribes de Anzoategui', 'Tiburones de La Guaira', 2, 'demo-lvbp-u1'),
    ('Cardenales de Lara', 'Bravos de Margarita', 3, 'demo-lvbp-u2'),
    ('Tigres de Aragua', 'Navegantes del Magallanes', 4, 'demo-lvbp-u3')
  ) AS t(home, away, days, ext) LOOP
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      now() + make_interval(days => rec.days), now() + make_interval(days => rec.days) - interval '10 minutes', 'upcoming')
    RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)));
  END LOOP;
  RAISE NOTICE '[ligas-demo] % seeded % resulted games', v_slug, g;
END $$;

-- ── LIDOM ──────────────────────────────────────────────
DO $$
DECLARE
  v_slug     text := 'lidom';
  v_provider text := 'winter/lidom';
  v_admin uuid; v_tour uuid; v_comp uuid; v_class uuid;
  v_event uuid; v_ept uuid; v_winner text; v_lock timestamptz;
  v_fans uuid[]; v_pick text; g int := 0; i int; rec record;
BEGIN
  SELECT id INTO v_admin FROM public.users WHERE is_super_admin = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_tour FROM public.sporting_tournaments WHERE slug LIKE v_slug || '-%' ORDER BY starts_at DESC LIMIT 1;
  IF v_tour IS NULL THEN RAISE NOTICE '[ligas-demo] % : no tournament', v_slug; RETURN; END IF;
  SELECT id INTO v_comp FROM public.competitions
    WHERE tournament_id = v_tour AND type='open' AND status='active' AND product_mode='predictsport_full'
    ORDER BY instance_number ASC LIMIT 1;
  IF v_comp IS NULL THEN RAISE NOTICE '[ligas-demo] % : no live open instance', v_slug; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE competition_id = v_comp AND external_event_id = '826269') THEN
    RAISE NOTICE '[ligas-demo] % : already seeded, skipping', v_slug; RETURN; END IF;
  SELECT id INTO v_class FROM public.classifications
    WHERE competition_id = v_comp AND classification_type='leaderboard' ORDER BY created_at LIMIT 1;
  SELECT array_agg(u.id ORDER BY u.email) INTO v_fans FROM public.users u
    JOIN public.competition_members m ON m.user_id = u.id AND m.competition_id = v_comp
    WHERE u.email LIKE 'seed-fan-%@synthetic.predictsport.local';
  IF v_fans IS NULL THEN v_fans := ARRAY[]::uuid[]; END IF;
  IF v_class IS NOT NULL THEN
    INSERT INTO public.classification_memberships (classification_id, competition_id, user_id, status)
    SELECT v_class, v_comp, uid, 'active' FROM unnest(v_fans) AS uid
    ON CONFLICT (classification_id, user_id) DO NOTHING;
  END IF;
  FOR rec IN SELECT * FROM (VALUES
    ('Tigres del Licey', 'Leones del Escogido', '2025-10-15T23:30:00Z'::timestamptz, '826269', 4, 3),
    ('Estrellas Orientales', 'Toros del Este', '2025-10-15T23:30:00Z'::timestamptz, '826343', 7, 3),
    ('Aguilas Cibaenas', 'Gigantes del Cibao', '2025-10-15T23:30:00Z'::timestamptz, '826369', 4, 3),
    ('Toros del Este', 'Aguilas Cibaenas', '2025-10-16T23:30:00Z'::timestamptz, '826244', 4, 11),
    ('Estrellas Orientales', 'Leones del Escogido', '2025-10-17T23:30:00Z'::timestamptz, '826347', 8, 7),
    ('Aguilas Cibaenas', 'Toros del Este', '2025-10-17T23:30:00Z'::timestamptz, '826368', 7, 14),
    ('Leones del Escogido', 'Tigres del Licey', '2025-10-18T20:00:00Z'::timestamptz, '826293', 2, 8),
    ('Toros del Este', 'Estrellas Orientales', '2025-10-18T23:30:00Z'::timestamptz, '826242', 3, 7),
    ('Leones del Escogido', 'Toros del Este', '2025-10-19T20:00:00Z'::timestamptz, '826289', 3, 4),
    ('Aguilas Cibaenas', 'Tigres del Licey', '2025-10-19T20:00:00Z'::timestamptz, '826367', 4, 0),
    ('Estrellas Orientales', 'Gigantes del Cibao', '2025-10-19T21:00:00Z'::timestamptz, '826342', 9, 4),
    ('Gigantes del Cibao', 'Tigres del Licey', '2025-10-20T23:00:00Z'::timestamptz, '826317', 4, 7),
    ('Leones del Escogido', 'Estrellas Orientales', '2025-10-20T23:15:00Z'::timestamptz, '826294', 2, 0),
    ('Gigantes del Cibao', 'Leones del Escogido', '2025-10-27T23:00:00Z'::timestamptz, '826322', 2, 10),
    ('Estrellas Orientales', 'Aguilas Cibaenas', '2025-10-27T23:30:00Z'::timestamptz, '826338', 5, 6),
    ('Leones del Escogido', 'Gigantes del Cibao', '2025-10-28T23:15:00Z'::timestamptz, '826290', 7, 5),
    ('Toros del Este', 'Tigres del Licey', '2025-10-28T23:30:00Z'::timestamptz, '826243', 2, 8),
    ('Aguilas Cibaenas', 'Estrellas Orientales', '2025-10-28T23:30:00Z'::timestamptz, '826365', 15, 10),
    ('Tigres del Licey', 'Toros del Este', '2025-10-29T23:30:00Z'::timestamptz, '826264', 3, 6),
    ('Estrellas Orientales', 'Aguilas Cibaenas', '2025-10-29T23:30:00Z'::timestamptz, '826340', 8, 9),
    ('Gigantes del Cibao', 'Estrellas Orientales', '2025-10-31T23:00:00Z'::timestamptz, '826313', 3, 1),
    ('Toros del Este', 'Leones del Escogido', '2025-10-31T23:30:00Z'::timestamptz, '826239', 3, 2),
    ('Tigres del Licey', 'Aguilas Cibaenas', '2025-10-31T23:30:00Z'::timestamptz, '826263', 0, 3),
    ('Leones del Escogido', 'Toros del Este', '2025-11-01T20:00:00Z'::timestamptz, '826288', 12, 3),
    ('Aguilas Cibaenas', 'Tigres del Licey', '2025-11-01T22:00:00Z'::timestamptz, '826357', 4, 1),
    ('Estrellas Orientales', 'Gigantes del Cibao', '2025-11-01T23:30:00Z'::timestamptz, '826339', 7, 8),
    ('Tigres del Licey', 'Leones del Escogido', '2025-11-02T21:00:00Z'::timestamptz, '826262', 5, 10),
    ('Estrellas Orientales', 'Toros del Este', '2025-11-02T21:00:00Z'::timestamptz, '826333', 2, 7),
    ('Gigantes del Cibao', 'Estrellas Orientales', '2025-11-03T23:00:00Z'::timestamptz, '826316', 8, 6),
    ('Toros del Este', 'Gigantes del Cibao', '2025-11-04T23:30:00Z'::timestamptz, '826237', 4, 7),
    ('Tigres del Licey', 'Estrellas Orientales', '2025-11-04T23:30:00Z'::timestamptz, '826258', 6, 11),
    ('Gigantes del Cibao', 'Aguilas Cibaenas', '2025-11-05T23:00:00Z'::timestamptz, '826320', 2, 5),
    ('Leones del Escogido', 'Tigres del Licey', '2025-11-05T23:15:00Z'::timestamptz, '826282', 5, 1),
    ('Estrellas Orientales', 'Toros del Este', '2025-11-05T23:30:00Z'::timestamptz, '826337', 7, 4),
    ('Tigres del Licey', 'Aguilas Cibaenas', '2025-11-06T23:30:00Z'::timestamptz, '826265', 7, 1),
    ('Tigres del Licey', 'Toros del Este', '2025-11-07T23:30:00Z'::timestamptz, '826261', 0, 9),
    ('Estrellas Orientales', 'Leones del Escogido', '2025-11-07T23:30:00Z'::timestamptz, '826336', 5, 3),
    ('Aguilas Cibaenas', 'Gigantes del Cibao', '2025-11-07T23:30:00Z'::timestamptz, '826356', 6, 2),
    ('Tigres del Licey', 'Estrellas Orientales', '2025-11-08T21:00:00Z'::timestamptz, '826266', 5, 2),
    ('Gigantes del Cibao', 'Aguilas Cibaenas', '2025-11-08T21:00:00Z'::timestamptz, '826312', 7, 4),
    ('Toros del Este', 'Leones del Escogido', '2025-11-08T23:30:00Z'::timestamptz, '826240', 3, 2),
    ('Leones del Escogido', 'Tigres del Licey', '2025-11-09T20:00:00Z'::timestamptz, '826287', 2, 4),
    ('Aguilas Cibaenas', 'Gigantes del Cibao', '2025-11-09T20:00:00Z'::timestamptz, '826361', 7, 3),
    ('Toros del Este', 'Estrellas Orientales', '2025-11-09T21:00:00Z'::timestamptz, '826235', 10, 4),
    ('Leones del Escogido', 'Toros del Este', '2025-11-10T20:00:00Z'::timestamptz, '826286', 4, 12),
    ('Estrellas Orientales', 'Tigres del Licey', '2025-11-10T21:00:00Z'::timestamptz, '826335', 4, 0),
    ('Toros del Este', 'Estrellas Orientales', '2025-11-11T23:30:00Z'::timestamptz, '826236', 5, 9),
    ('Tigres del Licey', 'Leones del Escogido', '2025-11-11T23:30:00Z'::timestamptz, '826260', 0, 5),
    ('Aguilas Cibaenas', 'Gigantes del Cibao', '2025-11-11T23:30:00Z'::timestamptz, '826355', 6, 1),
    ('Gigantes del Cibao', 'Leones del Escogido', '2025-11-12T20:00:00Z'::timestamptz, '826315', 2, 1),
    ('Gigantes del Cibao', 'Leones del Escogido', '2025-11-12T23:00:00Z'::timestamptz, '826311', 3, 5),
    ('Estrellas Orientales', 'Aguilas Cibaenas', '2025-11-12T23:30:00Z'::timestamptz, '826334', 3, 5)
  ) AS t(home, away, ts, ext, hs, as_) LOOP
    g := g + 1;
    v_winner := CASE WHEN rec.hs > rec.as_ THEN rec.home ELSE rec.away END;
    v_lock := rec.ts - interval '10 minutes';
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status, result_data, result_confirmed, result_confirmed_by)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      rec.ts, v_lock, 'resulted',
      jsonb_build_object('score', jsonb_build_object('home_team', rec.home, 'away_team', rec.away,
        'home_score', rec.hs, 'away_score', rec.as_), 'home', rec.hs, 'away', rec.as_),
      true, v_admin) RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)))
    RETURNING id INTO v_ept;
    FOR i IN 1..COALESCE(array_length(v_fans, 1), 0) LOOP
      v_pick := CASE WHEN ((i*31 + g*17) % 100) < (46 + i*3) THEN v_winner
        ELSE (CASE WHEN v_winner = rec.home THEN rec.away ELSE rec.home END) END;
      INSERT INTO public.predictions (event_id, event_prediction_type_id, user_id, prediction_type,
        prediction_data, is_correct, is_partial, points_awarded, submitted_at, updated_at)
      VALUES (v_event, v_ept, v_fans[i], 'winner', jsonb_build_object('value', v_pick),
        v_pick = v_winner, false, CASE WHEN v_pick = v_winner THEN 2 ELSE 0 END,
        v_lock - interval '1 hour', v_lock - interval '1 hour')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  g := 0;
  FOR rec IN SELECT * FROM (VALUES
    ('Toros del Este', 'Gigantes del Cibao', 2, 'demo-lidom-u1'),
    ('Tigres del Licey', 'Estrellas Orientales', 3, 'demo-lidom-u2'),
    ('Aguilas Cibaenas', 'Leones del Escogido', 4, 'demo-lidom-u3')
  ) AS t(home, away, days, ext) LOOP
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      now() + make_interval(days => rec.days), now() + make_interval(days => rec.days) - interval '10 minutes', 'upcoming')
    RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)));
  END LOOP;
  RAISE NOTICE '[ligas-demo] % seeded % resulted games', v_slug, g;
END $$;

-- ── LBPRC ──────────────────────────────────────────────
DO $$
DECLARE
  v_slug     text := 'lbprc';
  v_provider text := 'winter/lbprc';
  v_admin uuid; v_tour uuid; v_comp uuid; v_class uuid;
  v_event uuid; v_ept uuid; v_winner text; v_lock timestamptz;
  v_fans uuid[]; v_pick text; g int := 0; i int; rec record;
BEGIN
  SELECT id INTO v_admin FROM public.users WHERE is_super_admin = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_tour FROM public.sporting_tournaments WHERE slug LIKE v_slug || '-%' ORDER BY starts_at DESC LIMIT 1;
  IF v_tour IS NULL THEN RAISE NOTICE '[ligas-demo] % : no tournament', v_slug; RETURN; END IF;
  SELECT id INTO v_comp FROM public.competitions
    WHERE tournament_id = v_tour AND type='open' AND status='active' AND product_mode='predictsport_full'
    ORDER BY instance_number ASC LIMIT 1;
  IF v_comp IS NULL THEN RAISE NOTICE '[ligas-demo] % : no live open instance', v_slug; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE competition_id = v_comp AND external_event_id = '826644') THEN
    RAISE NOTICE '[ligas-demo] % : already seeded, skipping', v_slug; RETURN; END IF;
  SELECT id INTO v_class FROM public.classifications
    WHERE competition_id = v_comp AND classification_type='leaderboard' ORDER BY created_at LIMIT 1;
  SELECT array_agg(u.id ORDER BY u.email) INTO v_fans FROM public.users u
    JOIN public.competition_members m ON m.user_id = u.id AND m.competition_id = v_comp
    WHERE u.email LIKE 'seed-fan-%@synthetic.predictsport.local';
  IF v_fans IS NULL THEN v_fans := ARRAY[]::uuid[]; END IF;
  IF v_class IS NOT NULL THEN
    INSERT INTO public.classification_memberships (classification_id, competition_id, user_id, status)
    SELECT v_class, v_comp, uid, 'active' FROM unnest(v_fans) AS uid
    ON CONFLICT (classification_id, user_id) DO NOTHING;
  END IF;
  FOR rec IN SELECT * FROM (VALUES
    ('Indios de Mayaguez', 'Senadores de San Juan', '2025-11-06T23:21:00Z'::timestamptz, '826644', 4, 1),
    ('Senadores de San Juan', 'Cangrejeros de Santurce', '2025-11-07T23:21:00Z'::timestamptz, '826639', 2, 4),
    ('Criollos de Caguas', 'Gigantes de Carolina', '2025-11-07T23:21:00Z'::timestamptz, '826642', 1, 6),
    ('Leones de Ponce', 'Indios de Mayaguez', '2025-11-07T23:21:00Z'::timestamptz, '826643', 0, 1),
    ('Gigantes de Carolina', 'Indios de Mayaguez', '2025-11-08T23:21:00Z'::timestamptz, '826634', 1, 0),
    ('Leones de Ponce', 'Senadores de San Juan', '2025-11-08T23:21:00Z'::timestamptz, '826640', 9, 5),
    ('Cangrejeros de Santurce', 'Criollos de Caguas', '2025-11-08T23:21:00Z'::timestamptz, '826641', 4, 3),
    ('Senadores de San Juan', 'Leones de Ponce', '2025-11-09T20:21:00Z'::timestamptz, '826636', 1, 2),
    ('Indios de Mayaguez', 'Gigantes de Carolina', '2025-11-09T20:21:00Z'::timestamptz, '826637', 2, 4),
    ('Criollos de Caguas', 'Cangrejeros de Santurce', '2025-11-09T20:21:00Z'::timestamptz, '826638', 3, 7),
    ('Indios de Mayaguez', 'Leones de Ponce', '2025-11-11T23:21:00Z'::timestamptz, '826630', 2, 4),
    ('Senadores de San Juan', 'Cangrejeros de Santurce', '2025-11-11T23:21:00Z'::timestamptz, '826633', 2, 3),
    ('Gigantes de Carolina', 'Criollos de Caguas', '2025-11-11T23:21:00Z'::timestamptz, '826635', 4, 0),
    ('Leones de Ponce', 'Criollos de Caguas', '2025-11-12T23:21:00Z'::timestamptz, '826631', 1, 0),
    ('Cangrejeros de Santurce', 'Gigantes de Carolina', '2025-11-12T23:21:00Z'::timestamptz, '826632', 7, 6),
    ('Cangrejeros de Santurce', 'Leones de Ponce', '2025-11-13T23:21:00Z'::timestamptz, '826626', 3, 1),
    ('Gigantes de Carolina', 'Indios de Mayaguez', '2025-11-13T23:21:00Z'::timestamptz, '826628', 0, 1),
    ('Criollos de Caguas', 'Senadores de San Juan', '2025-11-13T23:21:00Z'::timestamptz, '826629', 6, 9),
    ('Cangrejeros de Santurce', 'Gigantes de Carolina', '2025-11-18T23:21:00Z'::timestamptz, '826623', 5, 6),
    ('Leones de Ponce', 'Senadores de San Juan', '2025-11-18T23:21:00Z'::timestamptz, '826624', 3, 0),
    ('Criollos de Caguas', 'Indios de Mayaguez', '2025-11-18T23:21:00Z'::timestamptz, '826625', 2, 1),
    ('Indios de Mayaguez', 'Cangrejeros de Santurce', '2025-11-19T23:21:00Z'::timestamptz, '826619', 2, 7),
    ('Leones de Ponce', 'Gigantes de Carolina', '2025-11-19T23:21:00Z'::timestamptz, '826620', 1, 10),
    ('Senadores de San Juan', 'Criollos de Caguas', '2025-11-19T23:21:00Z'::timestamptz, '826621', 0, 2),
    ('Senadores de San Juan', 'Leones de Ponce', '2025-11-20T23:21:00Z'::timestamptz, '826616', 3, 5),
    ('Indios de Mayaguez', 'Criollos de Caguas', '2025-11-20T23:21:00Z'::timestamptz, '826618', 2, 5),
    ('Gigantes de Carolina', 'Cangrejeros de Santurce', '2025-11-20T23:21:00Z'::timestamptz, '826622', 6, 17),
    ('Leones de Ponce', 'Indios de Mayaguez', '2025-11-21T19:00:00Z'::timestamptz, '826610', 0, 5),
    ('Criollos de Caguas', 'Gigantes de Carolina', '2025-11-21T23:21:00Z'::timestamptz, '826615', 3, 5),
    ('Cangrejeros de Santurce', 'Senadores de San Juan', '2025-11-21T23:21:00Z'::timestamptz, '826617', 3, 12),
    ('Senadores de San Juan', 'Gigantes de Carolina', '2025-11-22T23:21:00Z'::timestamptz, '826612', 4, 0),
    ('Indios de Mayaguez', 'Cangrejeros de Santurce', '2025-11-22T23:21:00Z'::timestamptz, '826613', 0, 1),
    ('Criollos de Caguas', 'Leones de Ponce', '2025-11-22T23:21:00Z'::timestamptz, '826614', 4, 11),
    ('Leones de Ponce', 'Criollos de Caguas', '2025-11-23T20:21:00Z'::timestamptz, '826605', 2, 6),
    ('Cangrejeros de Santurce', 'Indios de Mayaguez', '2025-11-23T20:21:00Z'::timestamptz, '826611', 5, 2),
    ('Gigantes de Carolina', 'Senadores de San Juan', '2025-11-23T21:21:00Z'::timestamptz, '826606', 3, 4),
    ('Senadores de San Juan', 'Criollos de Caguas', '2025-11-25T23:21:00Z'::timestamptz, '826607', 1, 9),
    ('Indios de Mayaguez', 'Cangrejeros de Santurce', '2025-11-25T23:21:00Z'::timestamptz, '826608', 7, 2),
    ('Gigantes de Carolina', 'Leones de Ponce', '2025-11-25T23:21:00Z'::timestamptz, '826609', 0, 1),
    ('Indios de Mayaguez', 'Gigantes de Carolina', '2025-11-26T23:21:00Z'::timestamptz, '826598', 5, 1),
    ('Senadores de San Juan', 'Criollos de Caguas', '2025-11-26T23:21:00Z'::timestamptz, '826603', 2, 1),
    ('Leones de Ponce', 'Cangrejeros de Santurce', '2025-11-26T23:21:00Z'::timestamptz, '826604', 2, 0),
    ('Indios de Mayaguez', 'Senadores de San Juan', '2025-11-28T23:21:00Z'::timestamptz, '826600', 3, 1),
    ('Gigantes de Carolina', 'Leones de Ponce', '2025-11-28T23:21:00Z'::timestamptz, '826601', 0, 2),
    ('Cangrejeros de Santurce', 'Criollos de Caguas', '2025-11-28T23:21:00Z'::timestamptz, '826602', 5, 3),
    ('Leones de Ponce', 'Indios de Mayaguez', '2025-11-29T23:21:00Z'::timestamptz, '826591', 3, 4),
    ('Senadores de San Juan', 'Cangrejeros de Santurce', '2025-11-29T23:21:00Z'::timestamptz, '826592', 3, 6),
    ('Criollos de Caguas', 'Gigantes de Carolina', '2025-11-29T23:21:00Z'::timestamptz, '826599', 6, 1),
    ('Cangrejeros de Santurce', 'Senadores de San Juan', '2025-11-30T20:21:00Z'::timestamptz, '826593', 3, 1),
    ('Gigantes de Carolina', 'Criollos de Caguas', '2025-11-30T20:21:00Z'::timestamptz, '826594', 1, 4),
    ('Indios de Mayaguez', 'Leones de Ponce', '2025-11-30T20:21:00Z'::timestamptz, '826595', 4, 3),
    ('Cangrejeros de Santurce', 'Senadores de San Juan', '2025-11-30T20:26:00Z'::timestamptz, '826596', 1, 3),
    ('Gigantes de Carolina', 'Criollos de Caguas', '2025-11-30T20:26:00Z'::timestamptz, '826597', 4, 1),
    ('Cangrejeros de Santurce', 'Criollos de Caguas', '2025-12-02T23:21:00Z'::timestamptz, '826585', 0, 4),
    ('Leones de Ponce', 'Gigantes de Carolina', '2025-12-02T23:21:00Z'::timestamptz, '826588', 8, 4),
    ('Gigantes de Carolina', 'Senadores de San Juan', '2025-12-04T23:21:00Z'::timestamptz, '826584', 1, 5),
    ('Criollos de Caguas', 'Leones de Ponce', '2025-12-04T23:21:00Z'::timestamptz, '826586', 1, 0),
    ('Cangrejeros de Santurce', 'Indios de Mayaguez', '2025-12-04T23:21:00Z'::timestamptz, '826587', 8, 4),
    ('Gigantes de Carolina', 'Cangrejeros de Santurce', '2025-12-05T23:21:00Z'::timestamptz, '826579', 2, 0),
    ('Senadores de San Juan', 'Indios de Mayaguez', '2025-12-05T23:21:00Z'::timestamptz, '826582', 2, 4),
    ('Leones de Ponce', 'Criollos de Caguas', '2025-12-05T23:21:00Z'::timestamptz, '826583', 3, 7)
  ) AS t(home, away, ts, ext, hs, as_) LOOP
    g := g + 1;
    v_winner := CASE WHEN rec.hs > rec.as_ THEN rec.home ELSE rec.away END;
    v_lock := rec.ts - interval '10 minutes';
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status, result_data, result_confirmed, result_confirmed_by)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      rec.ts, v_lock, 'resulted',
      jsonb_build_object('score', jsonb_build_object('home_team', rec.home, 'away_team', rec.away,
        'home_score', rec.hs, 'away_score', rec.as_), 'home', rec.hs, 'away', rec.as_),
      true, v_admin) RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)))
    RETURNING id INTO v_ept;
    FOR i IN 1..COALESCE(array_length(v_fans, 1), 0) LOOP
      v_pick := CASE WHEN ((i*31 + g*17) % 100) < (46 + i*3) THEN v_winner
        ELSE (CASE WHEN v_winner = rec.home THEN rec.away ELSE rec.home END) END;
      INSERT INTO public.predictions (event_id, event_prediction_type_id, user_id, prediction_type,
        prediction_data, is_correct, is_partial, points_awarded, submitted_at, updated_at)
      VALUES (v_event, v_ept, v_fans[i], 'winner', jsonb_build_object('value', v_pick),
        v_pick = v_winner, false, CASE WHEN v_pick = v_winner THEN 2 ELSE 0 END,
        v_lock - interval '1 hour', v_lock - interval '1 hour')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  g := 0;
  FOR rec IN SELECT * FROM (VALUES
    ('Indios de Mayaguez', 'Gigantes de Carolina', 2, 'demo-lbprc-u1'),
    ('Criollos de Caguas', 'Senadores de San Juan', 3, 'demo-lbprc-u2'),
    ('Cangrejeros de Santurce', 'Leones de Ponce', 4, 'demo-lbprc-u3')
  ) AS t(home, away, days, ext) LOOP
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      now() + make_interval(days => rec.days), now() + make_interval(days => rec.days) - interval '10 minutes', 'upcoming')
    RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)));
  END LOOP;
  RAISE NOTICE '[ligas-demo] % seeded % resulted games', v_slug, g;
END $$;

-- ── SERIE DEL CARIBE (structure only — real Feb-2026 box scores unavailable) ──
DO $$
DECLARE v_provider text := 'winter/caribbean'; v_tour uuid; v_comp uuid;
  v_event uuid; d int := 1; rec record;
BEGIN
  SELECT id INTO v_tour FROM public.sporting_tournaments WHERE slug LIKE 'sdc-%' ORDER BY starts_at DESC LIMIT 1;
  IF v_tour IS NULL THEN RAISE NOTICE '[ligas-demo] sdc : no tournament'; RETURN; END IF;
  SELECT id INTO v_comp FROM public.competitions
    WHERE tournament_id = v_tour AND type='open' AND status='active' AND product_mode='predictsport_full'
    ORDER BY instance_number ASC LIMIT 1;
  IF v_comp IS NULL THEN RAISE NOTICE '[ligas-demo] sdc : no live open instance'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE competition_id = v_comp AND external_event_id = 'demo-sdc-1') THEN
    RAISE NOTICE '[ligas-demo] sdc : already seeded'; RETURN; END IF;
  FOR rec IN SELECT * FROM (VALUES
    ('México', 'Venezuela', 1, 'demo-sdc-1'),
    ('México', 'República Dominicana', 2, 'demo-sdc-2'),
    ('México', 'Puerto Rico', 3, 'demo-sdc-3'),
    ('México', 'Panamá', 4, 'demo-sdc-4'),
    ('México', 'Colombia', 5, 'demo-sdc-5'),
    ('Venezuela', 'República Dominicana', 6, 'demo-sdc-6'),
    ('Venezuela', 'Puerto Rico', 7, 'demo-sdc-7'),
    ('Venezuela', 'Panamá', 8, 'demo-sdc-8'),
    ('Venezuela', 'Colombia', 9, 'demo-sdc-9'),
    ('República Dominicana', 'Puerto Rico', 10, 'demo-sdc-10'),
    ('República Dominicana', 'Panamá', 11, 'demo-sdc-11'),
    ('República Dominicana', 'Colombia', 12, 'demo-sdc-12'),
    ('Puerto Rico', 'Panamá', 13, 'demo-sdc-13'),
    ('Puerto Rico', 'Colombia', 14, 'demo-sdc-14'),
    ('Panamá', 'Colombia', 15, 'demo-sdc-15')
  ) AS t(home, away, n, ext) LOOP
    INSERT INTO public.events (competition_id, tournament_id, event_name, sport, provider_league,
      external_event_id, start_time, lock_time, status)
    VALUES (v_comp, v_tour, rec.home || ' v ' || rec.away, 'baseball', v_provider, rec.ext,
      now() + make_interval(days => rec.n), now() + make_interval(days => rec.n) - interval '10 minutes', 'upcoming')
    RETURNING id INTO v_event;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event, 'winner', 2, jsonb_build_object('options', jsonb_build_array(rec.home, rec.away)));
  END LOOP;
  RAISE NOTICE '[ligas-demo] sdc seeded round-robin (upcoming)';
END $$;
