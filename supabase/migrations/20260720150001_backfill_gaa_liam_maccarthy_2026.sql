-- Backfill All-Ireland SHC (Liam MacCarthy) 2026: 32 resulted matches
-- Sources: Wikipedia 2026 championship articles cross-checked vs RTÉ results,
-- GAA.ie match reports, Munster GAA, The42, Irish Times (2026-07-20).
-- result_data uses the GAA shape {home:{goals,points}, away:{goals,points}}
-- (src/lib/score-format.ts deriveWinnerFromScore). Round-robin winner EPTs
-- carry 3 options (home/away/Draw); knockout EPTs carry 2. 3 draw(s).
-- Throw-in times on resulted events are NOMINAL 15:00 IST (14:00Z); dates are
-- verified, per-match times were not sourced. Predictions: 8 synthetic seed
-- fans, deterministic picks (per-fan accuracy 45%-69.5%). All submitted_at
-- pre-date lock_time. round_id IS NULL — no triggers fire.
DO $$
DECLARE
  v_comp  uuid := 'be3a164a-8b8a-4153-af34-1f78a58b9513';
  v_tour  uuid := 'a0000000-0000-0000-0000-000000000207';
  v_admin uuid := '8c7e2e1b-0564-4d86-93e2-85ecf00f1e00';
  v_fans  uuid[] := ARRAY[
    '70a32e6f-a66c-436d-a122-2eaaf5508f8c',
    '1b91414c-220b-4ad2-8178-ac2fcc776234',
    '98db7995-8756-412d-962d-8386f4d81f43',
    '484084df-d216-43fd-95c3-fbdb4cbf3d89',
    'fa1f8a03-5ae3-4469-a75e-3d53f3eba881',
    '809f6bdc-fb82-4e38-aa62-defb6f730e43',
    '1a2847b8-c262-4c3f-8054-062565862546',
    '2c408bb4-1575-49a2-8bd3-c2c5329e319f'
  ]::uuid[];
  v_event_id uuid;
  v_ept_id   uuid;
  v_correct  text;
  v_lock     timestamptz;
  rec record;
  i int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.events WHERE tournament_id = v_tour) THEN
    RAISE NOTICE 'All-Ireland SHC (Liam MacCarthy) 2026 events already exist — skipping backfill';
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Munster Round Robin', 'Clare', 'Waterford', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-19-clare-waterford', 2, 33, 4, 21, true, ARRAY['Draw','Clare','Clare','Clare','Draw','Draw','Clare','Draw'], ARRAY[213,529,626,221,279,1341,274,793]),
      ('Munster Round Robin', 'Tipperary', 'Cork', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-19-tipperary-cork', 1, 22, 0, 29, true, ARRAY['Tipperary','Cork','Draw','Draw','Cork','Cork','Cork','Cork'], ARRAY[1086,178,1346,1213,304,1357,957,1049]),
      ('Munster Round Robin', 'Cork', 'Limerick', '2026-04-26 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-26-cork-limerick', 2, 22, 1, 23, true, ARRAY['Cork','Cork','Cork','Cork','Cork','Cork','Cork','Cork'], ARRAY[1318,1010,616,568,1255,904,476,94]),
      ('Munster Round Robin', 'Waterford', 'Tipperary', '2026-04-26 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-26-waterford-tipperary', 3, 24, 1, 30, true, ARRAY['Tipperary','Draw','Draw','Draw','Tipperary','Tipperary','Waterford','Draw'], ARRAY[1347,540,1182,833,1012,284,720,932]),
      ('Munster Round Robin', 'Clare', 'Limerick', '2026-05-03 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-03-clare-limerick', 1, 18, 2, 30, true, ARRAY['Clare','Limerick','Draw','Draw','Limerick','Draw','Draw','Limerick'], ARRAY[515,400,1333,1295,582,382,1018,428]),
      ('Munster Round Robin', 'Waterford', 'Cork', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-09-waterford-cork', 0, 25, 1, 26, true, ARRAY['Draw','Waterford','Cork','Draw','Cork','Cork','Waterford','Cork'], ARRAY[232,133,84,1178,1294,980,953,161]),
      ('Munster Round Robin', 'Tipperary', 'Clare', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-16-tipperary-clare', 0, 17, 1, 25, true, ARRAY['Tipperary','Clare','Tipperary','Clare','Clare','Tipperary','Clare','Clare'], ARRAY[315,1279,167,118,1167,1286,1184,566]),
      ('Munster Round Robin', 'Limerick', 'Waterford', '2026-05-17 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-17-limerick-waterford', 2, 29, 2, 20, true, ARRAY['Waterford','Waterford','Draw','Limerick','Limerick','Draw','Draw','Limerick'], ARRAY[622,496,1314,846,122,344,306,893]),
      ('Munster Round Robin', 'Cork', 'Clare', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-24-cork-clare', 1, 30, 1, 14, true, ARRAY['Clare','Draw','Cork','Clare','Cork','Cork','Cork','Cork'], ARRAY[762,254,1256,772,165,1073,663,876]),
      ('Munster Round Robin', 'Limerick', 'Tipperary', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-24-limerick-tipperary', 5, 27, 0, 25, true, ARRAY['Draw','Tipperary','Limerick','Limerick','Limerick','Limerick','Limerick','Limerick'], ARRAY[210,746,142,1407,80,123,557,407]),
      ('Leinster Round Robin', 'Galway', 'Kilkenny', '2026-04-18 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-18-galway-kilkenny', 3, 25, 1, 16, true, ARRAY['Draw','Galway','Galway','Draw','Galway','Galway','Galway','Galway'], ARRAY[464,1208,838,898,328,87,619,969]),
      ('Leinster Round Robin', 'Kildare', 'Wexford', '2026-04-18 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-18-kildare-wexford', 1, 14, 1, 22, true, ARRAY['Kildare','Wexford','Wexford','Wexford','Kildare','Kildare','Wexford','Wexford'], ARRAY[917,637,1150,315,1211,316,1114,699]),
      ('Leinster Round Robin', 'Offaly', 'Dublin', '2026-04-18 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-18-offaly-dublin', 4, 22, 2, 28, true, ARRAY['Draw','Offaly','Offaly','Offaly','Offaly','Offaly','Draw','Draw'], ARRAY[1150,699,988,1182,1006,444,86,1062]),
      ('Leinster Round Robin', 'Kilkenny', 'Wexford', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-25-kilkenny-wexford', 5, 21, 1, 16, true, ARRAY['Wexford','Draw','Draw','Kilkenny','Kilkenny','Kilkenny','Kilkenny','Kilkenny'], ARRAY[1415,1064,1339,612,331,914,1425,403]),
      ('Leinster Round Robin', 'Dublin', 'Kildare', '2026-04-26 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-26-dublin-kildare', 3, 24, 1, 19, true, ARRAY['Dublin','Kildare','Draw','Draw','Kildare','Draw','Dublin','Dublin'], ARRAY[295,233,186,515,91,59,81,1077]),
      ('Leinster Round Robin', 'Galway', 'Offaly', '2026-04-26 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-04-26-galway-offaly', 2, 26, 1, 18, true, ARRAY['Draw','Galway','Offaly','Offaly','Offaly','Draw','Galway','Galway'], ARRAY[693,1363,21,338,1338,1300,1066,899]),
      ('Leinster Round Robin', 'Kildare', 'Galway', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-09-kildare-galway', 1, 22, 4, 22, true, ARRAY['Kildare','Galway','Draw','Draw','Galway','Draw','Galway','Galway'], ARRAY[453,644,455,19,330,683,1159,1294]),
      ('Leinster Round Robin', 'Wexford', 'Dublin', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-09-wexford-dublin', 0, 22, 2, 21, true, ARRAY['Dublin','Draw','Draw','Draw','Dublin','Dublin','Dublin','Dublin'], ARRAY[1044,175,1040,1159,652,289,232,987]),
      ('Leinster Round Robin', 'Offaly', 'Kilkenny', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-10-offaly-kilkenny', 0, 24, 1, 21, true, ARRAY['Draw','Offaly','Draw','Draw','Draw','Draw','Draw','Draw'], ARRAY[399,93,898,1369,1384,1084,1293,758]),
      ('Leinster Round Robin', 'Galway', 'Dublin', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-16-galway-dublin', 0, 21, 3, 16, true, ARRAY['Dublin','Dublin','Dublin','Draw','Galway','Dublin','Galway','Dublin'], ARRAY[721,428,657,824,1205,1308,1172,1229]),
      ('Leinster Round Robin', 'Offaly', 'Wexford', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-16-offaly-wexford', 2, 21, 2, 15, true, ARRAY['Offaly','Offaly','Offaly','Offaly','Wexford','Offaly','Offaly','Offaly'], ARRAY[490,163,1439,1287,467,1094,736,363]),
      ('Leinster Round Robin', 'Kilkenny', 'Kildare', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-16-kilkenny-kildare', 4, 25, 0, 14, true, ARRAY['Kilkenny','Kildare','Kilkenny','Kildare','Kilkenny','Kilkenny','Kilkenny','Kilkenny'], ARRAY[1355,610,1140,89,1010,560,1290,1089]),
      ('Leinster Round Robin', 'Dublin', 'Kilkenny', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-24-dublin-kilkenny', 1, 26, 0, 22, true, ARRAY['Dublin','Kilkenny','Draw','Dublin','Kilkenny','Dublin','Dublin','Dublin'], ARRAY[924,1370,1313,1437,1225,509,1298,1425]),
      ('Leinster Round Robin', 'Kildare', 'Offaly', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-24-kildare-offaly', 0, 15, 1, 29, true, ARRAY['Draw','Kildare','Kildare','Draw','Draw','Offaly','Offaly','Offaly'], ARRAY[253,308,135,939,1367,1376,899,992]),
      ('Leinster Round Robin', 'Wexford', 'Galway', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-05-24-wexford-galway', 3, 20, 2, 31, true, ARRAY['Galway','Wexford','Draw','Draw','Wexford','Galway','Galway','Galway'], ARRAY[1122,851,1285,1099,562,911,331,717]),
      ('Provincial Finals', 'Dublin', 'Galway', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-06-06-dublin-galway', 4, 15, 4, 29, false, ARRAY['Dublin','Dublin','Galway','Galway','Galway','Dublin','Galway','Galway'], ARRAY[1101,1140,1300,1331,609,79,567,327]),
      ('Provincial Finals', 'Cork', 'Limerick', '2026-06-07 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-06-07-cork-limerick', 2, 17, 1, 21, false, ARRAY['Limerick','Cork','Cork','Limerick','Limerick','Cork','Limerick','Limerick'], ARRAY[890,502,1433,759,1032,539,753,1106]),
      ('All-Ireland Quarter-Finals', 'Clare', 'Dublin', '2026-06-20 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-06-20-clare-dublin', 0, 29, 0, 16, false, ARRAY['Dublin','Dublin','Dublin','Clare','Clare','Clare','Dublin','Clare'], ARRAY[1035,1277,145,36,328,1226,1389,515]),
      ('All-Ireland Quarter-Finals', 'Cork', 'Offaly', '2026-06-21 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-06-21-cork-offaly', 6, 25, 2, 11, false, ARRAY['Cork','Offaly','Offaly','Cork','Cork','Cork','Cork','Cork'], ARRAY[709,862,1289,309,568,537,856,401]),
      ('All-Ireland Semi-Finals', 'Cork', 'Galway', '2026-07-04 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-07-04-cork-galway', 1, 18, 2, 26, false, ARRAY['Cork','Cork','Cork','Galway','Galway','Cork','Galway','Galway'], ARRAY[1411,363,718,1003,634,1016,792,1357]),
      ('All-Ireland Semi-Finals', 'Limerick', 'Clare', '2026-07-05 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-07-05-limerick-clare', 1, 21, 1, 19, false, ARRAY['Limerick','Clare','Clare','Clare','Clare','Clare','Limerick','Limerick'], ARRAY[1076,1139,591,442,944,18,325,251]),
      ('All-Ireland Final', 'Limerick', 'Galway', '2026-07-19 14:00:00+00'::timestamptz, 'gaa-liammaccarthy-2026-07-19-limerick-galway', 1, 29, 1, 18, false, ARRAY['Galway','Galway','Limerick','Galway','Limerick','Limerick','Limerick','Limerick'], ARRAY[1000,396,1271,109,954,1300,1437,1034])
    ) AS t(stage_name, home_team, away_team, start_ts, ext_id, hg, hp, ag, ap, is_rr, picks, offs)
  LOOP
    v_lock := rec.start_ts - interval '10 minutes';
    v_correct := CASE
      WHEN rec.hg * 3 + rec.hp = rec.ag * 3 + rec.ap THEN 'Draw'
      WHEN rec.hg * 3 + rec.hp > rec.ag * 3 + rec.ap THEN rec.home_team
      ELSE rec.away_team END;

    INSERT INTO public.events (
      competition_id, tournament_id, event_name, sport,
      external_event_id, start_time, lock_time, status,
      result_data, result_confirmed, result_confirmed_by
    ) VALUES (
      v_comp, v_tour,
      rec.home_team || ' v ' || rec.away_team,
      'hurling',
      rec.ext_id,
      rec.start_ts, v_lock, 'resulted',
      jsonb_build_object(
        'home', jsonb_build_object('goals', rec.hg, 'points', rec.hp),
        'away', jsonb_build_object('goals', rec.ag, 'points', rec.ap)
      ),
      true, v_admin
    ) RETURNING id INTO v_event_id;

    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (
      v_event_id, 'winner', 2,
      CASE WHEN rec.is_rr
        THEN jsonb_build_object('options', jsonb_build_array(rec.home_team, rec.away_team, 'Draw'), 'allow_draw', true)
        ELSE jsonb_build_object('options', jsonb_build_array(rec.home_team, rec.away_team))
      END
    ) RETURNING id INTO v_ept_id;

    FOR i IN 1..8 LOOP
      INSERT INTO public.predictions (
        event_id, event_prediction_type_id, user_id, prediction_type,
        prediction_data, is_correct, is_partial, points_awarded,
        submitted_at, updated_at
      ) VALUES (
        v_event_id, v_ept_id, v_fans[i], 'winner',
        jsonb_build_object('value', rec.picks[i]),
        rec.picks[i] = v_correct, false,
        CASE WHEN rec.picks[i] = v_correct THEN 2 ELSE 0 END,
        v_lock - make_interval(mins => rec.offs[i]),
        v_lock - make_interval(mins => rec.offs[i])
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Backfilled All-Ireland SHC (Liam MacCarthy) 2026: 32 resulted events, 256 predictions';
END $$;
