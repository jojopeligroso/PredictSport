-- Backfill Tailteann Cup 2026: 28 resulted matches
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
  v_comp  uuid := 'd45d5658-217f-46ff-aaaa-9104855e7d99';
  v_tour  uuid := 'a0000000-0000-0000-0000-000000000206';
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
    RAISE NOTICE 'Tailteann Cup 2026 events already exist — skipping backfill';
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Round 1', 'Clare', 'Offaly', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-09-clare-offaly', 1, 14, 1, 17, false, ARRAY['Clare','Clare','Offaly','Offaly','Offaly','Clare','Clare','Clare'], ARRAY[434,1054,461,1171,1171,833,665,847]),
      ('Round 1', 'Wexford', 'Limerick', '2026-05-09 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-09-wexford-limerick', 2, 19, 1, 11, false, ARRAY['Limerick','Limerick','Limerick','Wexford','Wexford','Limerick','Limerick','Wexford'], ARRAY[16,1178,46,141,1440,489,675,1257]),
      ('Round 1', 'Sligo', 'Tipperary', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-10-sligo-tipperary', 1, 12, 0, 17, false, ARRAY['Sligo','Tipperary','Sligo','Sligo','Tipperary','Tipperary','Tipperary','Sligo'], ARRAY[804,340,950,505,418,375,900,991]),
      ('Round 1', 'Carlow', 'Antrim', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-10-carlow-antrim', 2, 26, 6, 17, false, ARRAY['Antrim','Antrim','Antrim','Carlow','Carlow','Antrim','Carlow','Antrim'], ARRAY[772,407,1280,555,1361,796,522,404]),
      ('Round 1', 'Laois', 'Wicklow', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-10-laois-wicklow', 1, 23, 0, 19, false, ARRAY['Wicklow','Laois','Laois','Wicklow','Laois','Laois','Wicklow','Wicklow'], ARRAY[191,1342,1024,1199,552,1279,56,112]),
      ('Round 1', 'Waterford', 'London', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-10-waterford-london', 0, 10, 5, 12, false, ARRAY['Waterford','Waterford','Waterford','Waterford','Waterford','London','Waterford','Waterford'], ARRAY[892,1402,92,149,791,955,949,1053]),
      ('Round 1', 'Fermanagh', 'Longford', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-10-fermanagh-longford', 1, 24, 2, 17, false, ARRAY['Longford','Fermanagh','Longford','Longford','Longford','Fermanagh','Fermanagh','Fermanagh'], ARRAY[845,583,45,714,244,227,968,1114]),
      ('Round 1', 'Down', 'Leitrim', '2026-05-16 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-16-down-leitrim', 1, 27, 0, 16, false, ARRAY['Leitrim','Leitrim','Down','Down','Leitrim','Down','Leitrim','Down'], ARRAY[907,332,1406,1411,585,1227,1438,262]),
      ('Round 2A', 'London', 'Laois', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-23-london-laois', 1, 14, 1, 29, false, ARRAY['Laois','Laois','Laois','Laois','London','Laois','Laois','Laois'], ARRAY[1381,684,623,232,281,313,719,1269]),
      ('Round 2A', 'Offaly', 'Down', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-23-offaly-down', 3, 22, 1, 20, false, ARRAY['Down','Offaly','Offaly','Offaly','Offaly','Down','Down','Offaly'], ARRAY[262,826,318,205,1133,1102,207,839]),
      ('Round 2A', 'Antrim', 'Tipperary', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-24-antrim-tipperary', 4, 12, 2, 12, false, ARRAY['Tipperary','Tipperary','Tipperary','Antrim','Antrim','Tipperary','Antrim','Antrim'], ARRAY[252,1085,928,1435,958,197,522,1157]),
      ('Round 2A', 'Fermanagh', 'Wexford', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-24-fermanagh-wexford', 2, 20, 2, 13, false, ARRAY['Wexford','Wexford','Fermanagh','Fermanagh','Fermanagh','Fermanagh','Wexford','Fermanagh'], ARRAY[104,814,1132,954,1375,149,809,908]),
      ('Round 2B', 'Wicklow', 'Limerick', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-23-wicklow-limerick', 4, 17, 2, 14, false, ARRAY['Limerick','Limerick','Wicklow','Limerick','Limerick','Wicklow','Wicklow','Wicklow'], ARRAY[1148,568,1077,1156,42,628,624,225]),
      ('Round 2B', 'Clare', 'Longford', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-23-clare-longford', 1, 18, 2, 17, false, ARRAY['Clare','Clare','Clare','Longford','Longford','Longford','Clare','Longford'], ARRAY[545,771,1249,10,680,846,253,101]),
      ('Round 2B', 'Leitrim', 'Carlow', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-23-leitrim-carlow', 0, 22, 1, 13, false, ARRAY['Leitrim','Leitrim','Leitrim','Leitrim','Leitrim','Carlow','Carlow','Carlow'], ARRAY[1036,183,201,923,1405,1189,1057,1409]),
      ('Round 2B', 'Waterford', 'Sligo', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-05-24-waterford-sligo', 3, 12, 0, 29, false, ARRAY['Sligo','Waterford','Sligo','Waterford','Sligo','Waterford','Waterford','Sligo'], ARRAY[521,76,298,1319,150,298,910,599]),
      ('Round 3', 'London', 'Sligo', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-06-london-sligo', 0, 16, 2, 16, false, ARRAY['London','London','Sligo','Sligo','Sligo','London','Sligo','Sligo'], ARRAY[1104,1404,378,941,280,447,399,754]),
      ('Round 3', 'Leitrim', 'Wexford', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-06-leitrim-wexford', 1, 12, 0, 20, false, ARRAY['Leitrim','Wexford','Wexford','Leitrim','Wexford','Leitrim','Leitrim','Wexford'], ARRAY[615,1156,732,1329,586,498,814,1295]),
      ('Round 3', 'Wicklow', 'Tipperary', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-06-wicklow-tipperary', 1, 17, 0, 12, false, ARRAY['Wicklow','Tipperary','Wicklow','Wicklow','Tipperary','Tipperary','Wicklow','Wicklow'], ARRAY[477,48,907,828,575,1042,12,337]),
      ('Round 3', 'Longford', 'Down', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-06-longford-down', 1, 15, 4, 18, false, ARRAY['Longford','Down','Down','Down','Down','Longford','Down','Down'], ARRAY[574,1396,479,34,397,1189,1296,1259]),
      ('Preliminary Quarter-Final', 'Fermanagh', 'New York', '2026-06-06 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-06-fermanagh-new-york', 3, 27, 1, 13, false, ARRAY['New York','Fermanagh','Fermanagh','Fermanagh','New York','New York','Fermanagh','New York'], ARRAY[388,91,43,527,451,695,444,1271]),
      ('Quarter-Finals', 'Offaly', 'Wexford', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-13-offaly-wexford', 1, 22, 1, 17, false, ARRAY['Offaly','Wexford','Wexford','Offaly','Wexford','Wexford','Offaly','Wexford'], ARRAY[184,1278,672,1355,27,608,621,1007]),
      ('Quarter-Finals', 'Antrim', 'Wicklow', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-13-antrim-wicklow', 3, 15, 2, 19, false, ARRAY['Antrim','Antrim','Antrim','Wicklow','Wicklow','Antrim','Antrim','Wicklow'], ARRAY[653,950,755,1351,346,138,419,213]),
      ('Quarter-Finals', 'Laois', 'Down', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-13-laois-down', 0, 16, 2, 23, false, ARRAY['Down','Laois','Down','Down','Laois','Down','Laois','Laois'], ARRAY[1247,1053,1430,736,51,993,729,1389]),
      ('Quarter-Finals', 'Fermanagh', 'Sligo', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-13-fermanagh-sligo', 2, 25, 0, 9, false, ARRAY['Sligo','Fermanagh','Sligo','Sligo','Sligo','Fermanagh','Fermanagh','Fermanagh'], ARRAY[646,1152,1248,1083,839,473,347,721]),
      ('Semi-Finals', 'Down', 'Fermanagh', '2026-06-20 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-20-down-fermanagh', 2, 19, 1, 21, false, ARRAY['Fermanagh','Fermanagh','Fermanagh','Fermanagh','Down','Down','Fermanagh','Fermanagh'], ARRAY[1203,316,202,905,34,348,550,888]),
      ('Semi-Finals', 'Offaly', 'Wicklow', '2026-06-20 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-06-20-offaly-wicklow', 4, 15, 2, 26, false, ARRAY['Offaly','Wicklow','Offaly','Wicklow','Offaly','Wicklow','Offaly','Offaly'], ARRAY[130,1067,931,1196,333,1012,502,798]),
      ('Final', 'Down', 'Wicklow', '2026-07-11 14:00:00+00'::timestamptz, 'gaa-tailteann-2026-07-11-down-wicklow', 2, 16, 1, 21, false, ARRAY['Down','Down','Down','Down','Wicklow','Down','Down','Wicklow'], ARRAY[391,127,517,533,518,166,185,944])
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
      'gaelic_football',
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

  RAISE NOTICE 'Backfilled Tailteann Cup 2026: 28 resulted events, 224 predictions';
END $$;
