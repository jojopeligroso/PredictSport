-- Rename league-specific sport identifiers to generic sport names
-- mlb → baseball, nfl → american_football, nba → basketball, nhl → ice_hockey

-- Events table
UPDATE events SET sport = 'baseball' WHERE sport = 'mlb';
UPDATE events SET sport = 'american_football' WHERE sport = 'nfl';
UPDATE events SET sport = 'basketball' WHERE sport = 'nba';
UPDATE events SET sport = 'ice_hockey' WHERE sport = 'nhl';

-- Sporting events pool (if any)
UPDATE sporting_events SET sport = 'baseball' WHERE sport = 'mlb';
UPDATE sporting_events SET sport = 'american_football' WHERE sport = 'nfl';
UPDATE sporting_events SET sport = 'basketball' WHERE sport = 'nba';
UPDATE sporting_events SET sport = 'ice_hockey' WHERE sport = 'nhl';

-- Update sport CHECK constraint on events if one exists
-- (The constraint may not exist if using text type — this is a no-op safety measure)
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'events' AND constraint_name = 'events_sport_check'
  ) THEN
    ALTER TABLE events DROP CONSTRAINT events_sport_check;
    ALTER TABLE events ADD CONSTRAINT events_sport_check CHECK (
      sport IN (
        'formula_1', 'soccer', 'golf', 'rugby', 'rugby_league', 'tennis',
        'gaa', 'gaelic_football', 'hurling', 'horse_racing', 'snooker',
        'cricket', 'athletics', 'baseball', 'american_football', 'basketball', 'ice_hockey'
      )
    );
  END IF;
END $$;
