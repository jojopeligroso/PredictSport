# Data Model & Domain Rules

## Tables

```
users
  id                      uuid PK
  email                   text unique
  display_name            text
  avatar_url              text nullable
  is_super_admin          boolean (default false)
  notification_prefs      jsonb
  created_at              timestamp

competitions
  id                      uuid PK
  name                    text
  description             text nullable
  type                    text ('fixed' | 'open')
  visibility              text ('public' | 'private')
  status                  text ('draft' | 'active' | 'completed')
  scoring_rules           jsonb (preset name + overrides)
  lock_default_minutes    integer (default 5)
  allow_nominations       boolean (default true)
  created_by              uuid FK users
  invite_code             text unique
  created_at              timestamp

competition_members
  id                      uuid PK
  competition_id          uuid FK competitions
  user_id                 uuid FK users
  role                    text ('admin' | 'co_admin' | 'participant')
  joined_at               timestamp

events
  id                      uuid PK
  competition_id          uuid FK competitions
  event_name              text
  sport                   text
  start_time              timestamp
  lock_time               timestamp
  prediction_types        jsonb (which types are active + config)
  result_data             jsonb nullable (raw result from API or manual)
  result_confirmed        boolean (default false)
  result_confirmed_by     uuid FK nullable
  status                  text ('upcoming' | 'locked' | 'resulted' | 'postponed' | 'cancelled')
  nominated_by            uuid FK nullable
  external_event_id       text nullable (API reference)
  created_at              timestamp

predictions
  id                      uuid PK
  event_id                uuid FK events
  user_id                 uuid FK users
  prediction_type         text (which type this prediction is for)
  prediction_data         jsonb (flexible — structure depends on type)
  is_correct              boolean nullable
  is_partial              boolean (default false)
  points_awarded          integer (default 0)
  submitted_at            timestamp
  updated_at              timestamp

tiebreakers
  id                      uuid PK
  competition_id          uuid FK competitions
  question_text           text
  correct_value           integer nullable

tiebreaker_answers
  id                      uuid PK
  tiebreaker_id           uuid FK tiebreakers
  user_id                 uuid FK users
  value                   integer
  submitted_at            timestamp

event_nominations
  id                      uuid PK
  competition_id          uuid FK competitions
  nominated_by            uuid FK users
  event_name              text
  sport                   text
  proposed_date           date
  proposed_prediction_type text nullable
  status                  text ('pending' | 'approved' | 'rejected')
  admin_note              text nullable
  reviewed_by             uuid FK nullable
  created_at              timestamp

invite_tokens
  id                      uuid PK
  competition_id          uuid FK competitions
  token                   text unique
  created_by              uuid FK users
  expires_at              timestamp nullable
  max_uses                integer nullable
  use_count               integer (default 0)
  created_at              timestamp
```

## Key Domain Rules

1. **Prediction lock is server-side.** Client countdown is cosmetic. Supabase RLS or API route rejects submissions after `lock_time`.
2. **Predictions hidden until lock.** Other users' answers invisible before lock. Admin cannot see them either.
3. **After lock, all predictions visible.** Everyone can see what everyone else picked.
4. **Results: provisional then confirmed.** API-fetched results are provisional until admin confirms with one click. Manual results also go through confirmation.
5. **Scoring is automatic on confirmation.** Once admin confirms a result, points are calculated for all users immediately.
6. **Scoring rules immutable after competition starts.** Set at creation, cannot change mid-competition.
7. **Competition type immutable after creation.** Fixed stays fixed, open stays open.

## Roles

| Role | Scope | Key Power |
|------|-------|-----------|
| Super Admin | Global | Override scores, view all predictions, manage all users |
| Competition Admin | Per competition | Create/manage competitions, confirm results, approve nominations |
| Co-Admin | Per competition | Same as admin except cannot delete competition |
| Participant | Per competition | Submit predictions, nominate events, view leaderboard |

A user may hold different roles across different competitions simultaneously.
