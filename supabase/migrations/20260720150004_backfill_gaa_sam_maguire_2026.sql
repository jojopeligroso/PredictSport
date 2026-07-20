-- Backfill All-Ireland SFC (Sam Maguire) 2026: 55 resulted matches + 1 upcoming (final)
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
  v_comp  uuid := 'da76208d-fc76-453d-a421-c5abb3e95432';
  v_tour  uuid := 'a0000000-0000-0000-0000-000000000205';
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
    RAISE NOTICE 'All-Ireland SFC (Sam Maguire) 2026 events already exist — skipping backfill';
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('Connacht SFC', 'London', 'Mayo', '2026-04-11 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-11-london-mayo', 1, 15, 0, 31, false, ARRAY['London','Mayo','Mayo','London','Mayo','London','Mayo','Mayo'], ARRAY[1064,1260,931,9,692,1222,1072,1315]),
      ('Connacht SFC', 'New York', 'Roscommon', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-new-york-roscommon', 1, 10, 5, 22, false, ARRAY['Roscommon','Roscommon','New York','Roscommon','Roscommon','Roscommon','Roscommon','Roscommon'], ARRAY[107,1335,1118,778,456,917,1004,343]),
      ('Connacht SFC', 'Sligo', 'Leitrim', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-sligo-leitrim', 1, 20, 3, 15, false, ARRAY['Sligo','Sligo','Leitrim','Sligo','Leitrim','Leitrim','Sligo','Leitrim'], ARRAY[1110,704,92,1175,927,66,787,987]),
      ('Connacht SFC', 'Leitrim', 'Galway', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-25-leitrim-galway', 2, 12, 1, 20, false, ARRAY['Leitrim','Leitrim','Galway','Leitrim','Galway','Galway','Leitrim','Galway'], ARRAY[970,1048,318,1086,1228,185,464,1181]),
      ('Connacht SFC', 'Mayo', 'Roscommon', '2026-04-26 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-26-mayo-roscommon', 1, 18, 2, 25, false, ARRAY['Mayo','Mayo','Mayo','Roscommon','Roscommon','Mayo','Roscommon','Roscommon'], ARRAY[157,1178,770,494,1032,1339,515,947]),
      ('Connacht SFC', 'Roscommon', 'Galway', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-10-roscommon-galway', 3, 21, 2, 22, false, ARRAY['Galway','Galway','Roscommon','Galway','Galway','Roscommon','Galway','Roscommon'], ARRAY[57,1278,1027,403,204,557,825,1282]),
      ('Leinster SFC', 'Offaly', 'Laois', '2026-04-11 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-11-offaly-laois', 0, 12, 3, 12, false, ARRAY['Offaly','Offaly','Laois','Laois','Laois','Offaly','Offaly','Laois'], ARRAY[184,245,170,1298,215,184,706,760]),
      ('Leinster SFC', 'Carlow', 'Wicklow', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-carlow-wicklow', 1, 7, 2, 15, false, ARRAY['Carlow','Wicklow','Carlow','Carlow','Wicklow','Wicklow','Wicklow','Wicklow'], ARRAY[736,770,157,775,919,1082,1018,465]),
      ('Leinster SFC', 'Longford', 'Westmeath', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-longford-westmeath', 1, 16, 5, 25, false, ARRAY['Westmeath','Westmeath','Westmeath','Westmeath','Longford','Westmeath','Westmeath','Longford'], ARRAY[221,1218,1434,674,849,591,358,1087]),
      ('Leinster SFC', 'Meath', 'Westmeath', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-19-meath-westmeath', 0, 25, 4, 18, false, ARRAY['Meath','Westmeath','Westmeath','Meath','Westmeath','Westmeath','Westmeath','Westmeath'], ARRAY[108,955,343,182,110,192,556,549]),
      ('Leinster SFC', 'Louth', 'Wexford', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-19-louth-wexford', 1, 25, 0, 11, false, ARRAY['Wexford','Wexford','Wexford','Wexford','Wexford','Wexford','Louth','Wexford'], ARRAY[919,347,1140,697,667,178,760,598]),
      ('Leinster SFC', 'Wicklow', 'Dublin', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-19-wicklow-dublin', 2, 14, 2, 16, false, ARRAY['Dublin','Wicklow','Dublin','Dublin','Dublin','Dublin','Dublin','Dublin'], ARRAY[331,1384,712,641,885,560,48,259]),
      ('Leinster SFC', 'Kildare', 'Laois', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-19-kildare-laois', 2, 20, 2, 15, false, ARRAY['Laois','Laois','Kildare','Kildare','Laois','Laois','Kildare','Kildare'], ARRAY[1382,860,687,1440,786,619,1050,949]),
      ('Leinster SFC', 'Louth', 'Dublin', '2026-05-02 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-02-louth-dublin', 0, 10, 0, 20, false, ARRAY['Louth','Louth','Dublin','Dublin','Louth','Dublin','Louth','Dublin'], ARRAY[1063,1036,261,299,261,739,1152,492]),
      ('Leinster SFC', 'Westmeath', 'Kildare', '2026-05-03 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-03-westmeath-kildare', 2, 21, 0, 23, false, ARRAY['Westmeath','Westmeath','Kildare','Westmeath','Westmeath','Westmeath','Westmeath','Westmeath'], ARRAY[155,1228,1378,658,56,1057,85,541]),
      ('Leinster SFC', 'Dublin', 'Westmeath', '2026-05-17 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-17-dublin-westmeath', 0, 26, 2, 28, false, ARRAY['Dublin','Dublin','Westmeath','Dublin','Westmeath','Westmeath','Westmeath','Dublin'], ARRAY[1363,951,680,607,1080,612,353,1352]),
      ('Munster SFC', 'Tipperary', 'Waterford', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-tipperary-waterford', 0, 15, 1, 7, false, ARRAY['Waterford','Waterford','Waterford','Waterford','Tipperary','Tipperary','Waterford','Tipperary'], ARRAY[208,1051,345,437,1217,512,1070,1376]),
      ('Munster SFC', 'Cork', 'Limerick', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-cork-limerick', 4, 16, 1, 16, false, ARRAY['Limerick','Cork','Cork','Limerick','Limerick','Limerick','Cork','Limerick'], ARRAY[85,885,1406,93,284,536,158,105]),
      ('Munster SFC', 'Clare', 'Kerry', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-25-clare-kerry', 1, 14, 2, 19, false, ARRAY['Clare','Kerry','Clare','Kerry','Clare','Kerry','Clare','Clare'], ARRAY[1234,1141,1310,1071,676,1433,1121,1144]),
      ('Munster SFC', 'Tipperary', 'Cork', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-25-tipperary-cork', 1, 12, 4, 18, false, ARRAY['Cork','Cork','Tipperary','Tipperary','Cork','Cork','Cork','Tipperary'], ARRAY[434,1212,638,164,456,367,240,477]),
      ('Munster SFC', 'Kerry', 'Cork', '2026-05-10 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-10-kerry-cork', 1, 23, 1, 15, false, ARRAY['Cork','Cork','Cork','Cork','Kerry','Cork','Kerry','Kerry'], ARRAY[1047,1275,901,774,550,465,208,1043]),
      ('Ulster SFC', 'Armagh', 'Tyrone', '2026-04-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-12-armagh-tyrone', 1, 17, 1, 16, false, ARRAY['Tyrone','Tyrone','Armagh','Armagh','Tyrone','Armagh','Tyrone','Armagh'], ARRAY[1190,581,638,1444,631,176,220,832]),
      ('Ulster SFC', 'Derry', 'Antrim', '2026-04-18 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-18-derry-antrim', 2, 23, 1, 13, false, ARRAY['Antrim','Antrim','Derry','Derry','Antrim','Derry','Antrim','Derry'], ARRAY[409,55,335,831,104,24,561,1391]),
      ('Ulster SFC', 'Cavan', 'Monaghan', '2026-04-19 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-19-cavan-monaghan', 2, 14, 0, 27, false, ARRAY['Monaghan','Monaghan','Cavan','Cavan','Monaghan','Monaghan','Monaghan','Monaghan'], ARRAY[601,496,121,1399,1162,876,339,636]),
      ('Ulster SFC', 'Fermanagh', 'Armagh', '2026-04-25 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-25-fermanagh-armagh', 1, 24, 2, 32, false, ARRAY['Fermanagh','Fermanagh','Fermanagh','Fermanagh','Armagh','Fermanagh','Fermanagh','Armagh'], ARRAY[354,1254,692,942,1098,1122,763,1322]),
      ('Ulster SFC', 'Donegal', 'Down', '2026-04-26 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-04-26-donegal-down', 1, 21, 3, 21, false, ARRAY['Down','Down','Down','Down','Down','Donegal','Donegal','Donegal'], ARRAY[999,496,201,69,957,95,1245,1273]),
      ('Ulster SFC', 'Derry', 'Monaghan', '2026-05-02 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-02-derry-monaghan', 3, 23, 1, 30, false, ARRAY['Derry','Monaghan','Monaghan','Monaghan','Derry','Monaghan','Monaghan','Monaghan'], ARRAY[1409,649,1191,967,685,828,634,1185]),
      ('Ulster SFC', 'Armagh', 'Down', '2026-05-03 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-03-armagh-down', 3, 33, 0, 14, false, ARRAY['Armagh','Down','Armagh','Down','Down','Armagh','Armagh','Down'], ARRAY[484,1352,1402,174,1286,756,1064,1043]),
      ('Ulster SFC', 'Monaghan', 'Armagh', '2026-05-17 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-17-monaghan-armagh', 0, 25, 2, 28, false, ARRAY['Armagh','Armagh','Armagh','Armagh','Armagh','Monaghan','Armagh','Armagh'], ARRAY[913,243,950,862,110,1338,48,1379]),
      ('Round 1', 'Galway', 'Kildare', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-23-galway-kildare', 3, 21, 0, 17, false, ARRAY['Galway','Kildare','Kildare','Kildare','Kildare','Galway','Galway','Kildare'], ARRAY[284,63,1185,1109,389,472,1156,1017]),
      ('Round 1', 'Cork', 'Meath', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-23-cork-meath', 0, 30, 1, 24, false, ARRAY['Meath','Cork','Cork','Meath','Meath','Cork','Meath','Cork'], ARRAY[649,1404,66,152,386,526,679,923]),
      ('Round 1', 'Kerry', 'Donegal', '2026-05-23 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-23-kerry-donegal', 0, 16, 2, 20, false, ARRAY['Kerry','Donegal','Kerry','Kerry','Donegal','Donegal','Donegal','Donegal'], ARRAY[1002,533,1107,554,464,250,328,1248]),
      ('Round 1', 'Roscommon', 'Tyrone', '2026-05-24 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-24-roscommon-tyrone', 2, 18, 3, 16, false, ARRAY['Roscommon','Roscommon','Tyrone','Tyrone','Roscommon','Roscommon','Roscommon','Tyrone'], ARRAY[328,1272,773,1253,1394,77,1336,535]),
      ('Round 1', 'Armagh', 'Derry', '2026-05-30 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-30-armagh-derry', 1, 18, 1, 13, false, ARRAY['Armagh','Armagh','Derry','Armagh','Armagh','Armagh','Derry','Derry'], ARRAY[1180,248,82,553,1055,594,1360,644]),
      ('Round 1', 'Westmeath', 'Cavan', '2026-05-30 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-30-westmeath-cavan', 1, 31, 3, 21, false, ARRAY['Cavan','Cavan','Cavan','Cavan','Cavan','Westmeath','Westmeath','Cavan'], ARRAY[537,701,684,973,258,891,550,655]),
      ('Round 1', 'Monaghan', 'Mayo', '2026-05-31 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-31-monaghan-mayo', 2, 20, 1, 24, false, ARRAY['Monaghan','Monaghan','Mayo','Mayo','Monaghan','Mayo','Mayo','Mayo'], ARRAY[98,1002,145,804,76,922,449,1362]),
      ('Round 1', 'Dublin', 'Louth', '2026-05-31 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-05-31-dublin-louth', 1, 24, 4, 18, false, ARRAY['Louth','Dublin','Louth','Dublin','Dublin','Louth','Louth','Louth'], ARRAY[1357,691,1238,186,360,1419,1032,912]),
      ('Round 2A', 'Donegal', 'Cork', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-13-donegal-cork', 1, 13, 0, 17, false, ARRAY['Cork','Donegal','Donegal','Donegal','Cork','Cork','Cork','Cork'], ARRAY[1040,389,1182,485,449,1097,1092,280]),
      ('Round 2A', 'Tyrone', 'Mayo', '2026-06-14 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-14-tyrone-mayo', 0, 22, 1, 18, false, ARRAY['Mayo','Mayo','Mayo','Tyrone','Tyrone','Tyrone','Tyrone','Tyrone'], ARRAY[823,39,1245,953,271,1380,1435,562]),
      ('Round 2A', 'Galway', 'Westmeath', '2026-06-14 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-14-galway-westmeath', 3, 21, 2, 21, false, ARRAY['Galway','Westmeath','Westmeath','Westmeath','Westmeath','Westmeath','Galway','Galway'], ARRAY[1152,923,1424,1317,322,655,1307,600]),
      ('Round 2A', 'Louth', 'Armagh', '2026-06-14 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-14-louth-armagh', 2, 20, 2, 19, false, ARRAY['Armagh','Armagh','Louth','Louth','Louth','Louth','Armagh','Louth'], ARRAY[1198,1205,60,354,102,157,833,998]),
      ('Round 2B', 'Derry', 'Meath', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-13-derry-meath', 1, 20, 1, 24, false, ARRAY['Derry','Meath','Derry','Meath','Meath','Derry','Meath','Meath'], ARRAY[258,1338,187,1270,1338,126,1422,1085]),
      ('Round 2B', 'Kildare', 'Kerry', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-13-kildare-kerry', 0, 17, 3, 22, false, ARRAY['Kerry','Kerry','Kildare','Kerry','Kerry','Kildare','Kildare','Kerry'], ARRAY[1045,192,469,625,593,308,903,396]),
      ('Round 2B', 'Monaghan', 'Roscommon', '2026-06-13 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-13-monaghan-roscommon', 1, 20, 0, 14, false, ARRAY['Monaghan','Monaghan','Monaghan','Monaghan','Monaghan','Monaghan','Monaghan','Roscommon'], ARRAY[659,1280,815,1202,602,536,122,159]),
      ('Round 2B', 'Cavan', 'Dublin', '2026-06-14 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-14-cavan-dublin', 0, 16, 1, 24, false, ARRAY['Dublin','Cavan','Cavan','Dublin','Cavan','Dublin','Dublin','Dublin'], ARRAY[835,644,1341,1400,1244,620,45,251]),
      ('Round 3', 'Kerry', 'Armagh', '2026-06-20 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-20-kerry-armagh', 4, 18, 0, 17, false, ARRAY['Armagh','Armagh','Kerry','Kerry','Kerry','Kerry','Kerry','Kerry'], ARRAY[1036,180,705,680,1066,419,198,582]),
      ('Round 3', 'Mayo', 'Meath', '2026-06-20 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-20-mayo-meath', 0, 22, 2, 13, false, ARRAY['Mayo','Mayo','Mayo','Meath','Meath','Mayo','Meath','Mayo'], ARRAY[40,263,1333,1163,539,82,486,330]),
      ('Round 3', 'Dublin', 'Donegal', '2026-06-21 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-21-dublin-donegal', 2, 26, 2, 22, false, ARRAY['Donegal','Dublin','Donegal','Dublin','Dublin','Dublin','Dublin','Dublin'], ARRAY[454,1124,1378,1373,60,140,528,509]),
      ('Round 3', 'Monaghan', 'Westmeath', '2026-06-21 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-21-monaghan-westmeath', 1, 28, 2, 19, false, ARRAY['Monaghan','Monaghan','Monaghan','Monaghan','Monaghan','Monaghan','Westmeath','Monaghan'], ARRAY[434,1316,1384,74,589,1083,306,49]),
      ('Quarter-Finals', 'Kerry', 'Tyrone', '2026-06-27 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-27-kerry-tyrone', 2, 25, 0, 27, false, ARRAY['Kerry','Kerry','Kerry','Tyrone','Kerry','Kerry','Kerry','Kerry'], ARRAY[434,928,1039,993,888,1307,620,789]),
      ('Quarter-Finals', 'Cork', 'Mayo', '2026-06-27 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-27-cork-mayo', 0, 18, 0, 23, false, ARRAY['Cork','Mayo','Cork','Cork','Cork','Mayo','Cork','Cork'], ARRAY[1097,677,434,265,1437,1201,1380,1370]),
      ('Quarter-Finals', 'Galway', 'Dublin', '2026-06-28 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-28-galway-dublin', 1, 21, 1, 25, false, ARRAY['Galway','Galway','Dublin','Dublin','Dublin','Galway','Dublin','Dublin'], ARRAY[916,1282,1008,69,678,1070,484,313]),
      ('Quarter-Finals', 'Louth', 'Monaghan', '2026-06-28 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-06-28-louth-monaghan', 0, 27, 2, 18, false, ARRAY['Monaghan','Monaghan','Monaghan','Louth','Monaghan','Monaghan','Monaghan','Louth'], ARRAY[1105,29,1374,1403,40,42,732,950]),
      ('Semi-Finals', 'Louth', 'Mayo', '2026-07-11 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-07-11-louth-mayo', 0, 15, 3, 23, false, ARRAY['Louth','Mayo','Louth','Louth','Mayo','Louth','Mayo','Mayo'], ARRAY[507,929,668,966,914,1142,1172,688]),
      ('Semi-Finals', 'Dublin', 'Kerry', '2026-07-12 14:00:00+00'::timestamptz, 'gaa-sammaguire-2026-07-12-dublin-kerry', 0, 20, 2, 18, false, ARRAY['Kerry','Dublin','Dublin','Kerry','Dublin','Kerry','Kerry','Kerry'], ARRAY[610,949,1250,462,1041,1252,1092,77])
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

    -- Upcoming pickable fixture (verified throw-in): Kerry v Mayo
    INSERT INTO public.events (
      competition_id, tournament_id, event_name, sport,
      external_event_id, start_time, lock_time, status
    ) VALUES (
      v_comp, v_tour, 'Kerry v Mayo', 'gaelic_football',
      'gaa-sammaguire-2026-07-26-kerry-mayo',
      '2026-07-26T14:30:00Z'::timestamptz, '2026-07-26T14:30:00Z'::timestamptz - interval '10 minutes', 'upcoming'
    ) RETURNING id INTO v_event_id;
    INSERT INTO public.event_prediction_types (event_id, prediction_type, points, config)
    VALUES (v_event_id, 'winner', 2,
      jsonb_build_object('options', jsonb_build_array('Kerry', 'Mayo')));

  RAISE NOTICE 'Backfilled All-Ireland SFC (Sam Maguire) 2026: 55 resulted events, 440 predictions, 1 upcoming';
END $$;
