-- Backfill Joe McDonagh Cup 2026: 16 resulted matches
-- Sources: Wikipedia 2026 championship articles cross-checked vs RTÉ results,
-- GAA.ie match reports, Munster GAA, The42, Irish Times (2026-07-20).
-- result_data uses the GAA shape {home:{goals,points}, away:{goals,points}}
-- (src/lib/score-format.ts deriveWinnerFromScore). Round-robin winner EPTs
-- carry 3 options (home/away/Draw); knockout EPTs carry 2. 0 draw(s).
-- Throw-in times on resulted events are NOMINAL 15:00 IST (14:00Z); dates are
-- verified, per-match times were not sourced. Predictions: 8 synthetic seed
-- fans, deterministic picks (per-fan accuracy 45%-69.5%). All submitted_at
-- pre-date lock_time. round_id IS NULL — no triggers fire.
DO $$
DECLARE
  v_comp  uuid := '27e76f35-2921-464d-bbf2-a8058760d159';
  v_tour  uuid := 'a0000000-0000-0000-0000-000000000208';
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
    RAISE NOTICE 'Joe McDonagh Cup 2026 events already exist — skipping backfill';
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Round Robin', 'Antrim', 'Down', '2026-04-18 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-04-18-antrim-down', 0, 23, 1, 22, true, ARRAY['Down','Down','Down','Down','Draw','Down','Down','Antrim'], ARRAY[133,85,438,247,142,1342,187,713]),
      ('Round Robin', 'Carlow', 'Laois', '2026-04-18 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-04-18-carlow-laois', 4, 17, 1, 17, true, ARRAY['Draw','Carlow','Carlow','Laois','Draw','Laois','Carlow','Draw'], ARRAY[1368,1013,1367,320,933,1074,1418,933]),
      ('Round Robin', 'London', 'Westmeath', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-04-19-london-westmeath', 0, 15, 1, 22, true, ARRAY['Westmeath','Westmeath','London','London','Draw','Westmeath','London','Draw'], ARRAY[116,308,68,975,1343,557,125,1389]),
      ('Round Robin', 'Down', 'London', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-04-25-down-london', 2, 23, 2, 17, true, ARRAY['Down','Draw','Down','Draw','Down','Draw','London','Down'], ARRAY[1246,644,49,251,1305,278,641,111]),
      ('Round Robin', 'Laois', 'Antrim', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-04-25-laois-antrim', 2, 23, 0, 22, true, ARRAY['Laois','Laois','Laois','Antrim','Laois','Laois','Laois','Draw'], ARRAY[1412,652,559,708,116,1370,1099,1133]),
      ('Round Robin', 'Westmeath', 'Carlow', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-04-25-westmeath-carlow', 1, 23, 4, 20, true, ARRAY['Carlow','Carlow','Carlow','Carlow','Carlow','Carlow','Draw','Carlow'], ARRAY[425,857,88,957,744,358,1111,1209]),
      ('Round Robin', 'Down', 'Carlow', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-09-down-carlow', 2, 17, 3, 17, true, ARRAY['Down','Carlow','Down','Draw','Draw','Down','Carlow','Draw'], ARRAY[1436,100,284,461,170,139,1113,809]),
      ('Round Robin', 'Westmeath', 'Laois', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-09-westmeath-laois', 2, 19, 5, 28, true, ARRAY['Draw','Laois','Westmeath','Laois','Draw','Laois','Westmeath','Westmeath'], ARRAY[1398,1423,752,1366,152,892,614,1197]),
      ('Round Robin', 'London', 'Antrim', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-10-london-antrim', 4, 9, 1, 22, true, ARRAY['Draw','Antrim','Antrim','Draw','Antrim','Antrim','London','London'], ARRAY[1039,127,451,545,1260,296,1043,355]),
      ('Round Robin', 'Antrim', 'Westmeath', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-16-antrim-westmeath', 2, 29, 2, 20, true, ARRAY['Antrim','Antrim','Westmeath','Antrim','Antrim','Antrim','Draw','Antrim'], ARRAY[917,791,343,1372,551,1017,847,1256]),
      ('Round Robin', 'Carlow', 'London', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-16-carlow-london', 5, 27, 0, 11, true, ARRAY['Carlow','Carlow','Carlow','Carlow','Carlow','Carlow','Draw','Draw'], ARRAY[607,24,1009,1231,790,1286,460,560]),
      ('Round Robin', 'Laois', 'Down', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-16-laois-down', 4, 28, 0, 27, true, ARRAY['Laois','Draw','Laois','Draw','Draw','Draw','Laois','Laois'], ARRAY[1146,1101,559,84,500,963,1391,35]),
      ('Round Robin', 'Antrim', 'Carlow', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-24-antrim-carlow', 3, 26, 1, 15, true, ARRAY['Antrim','Carlow','Antrim','Carlow','Carlow','Antrim','Antrim','Antrim'], ARRAY[1344,1129,1385,700,798,614,70,1021]),
      ('Round Robin', 'Down', 'Westmeath', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-24-down-westmeath', 1, 28, 1, 18, true, ARRAY['Down','Down','Down','Draw','Down','Down','Down','Down'], ARRAY[1156,731,1406,1377,1045,1164,642,467]),
      ('Round Robin', 'London', 'Laois', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-05-24-london-laois', 0, 19, 1, 29, true, ARRAY['Laois','London','Laois','Laois','Laois','Laois','Draw','Laois'], ARRAY[641,1236,139,1359,48,135,1209,677]),
      ('Final', 'Carlow', 'Laois', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-joemcdonagh-2026-06-06-carlow-laois', 1, 18, 1, 27, false, ARRAY['Carlow','Laois','Laois','Carlow','Laois','Laois','Laois','Laois'], ARRAY[819,1374,1296,128,1210,966,458,412])
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

  RAISE NOTICE 'Backfilled Joe McDonagh Cup 2026: 16 resulted events, 128 predictions';
END $$;
