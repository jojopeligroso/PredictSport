-- Per-classification display visibility (ADR 0011)
--
-- Adds opt-in pseudonymity to the public leaderboard on a per-classification
-- basis. Format is always public at the query layer; this migration only
-- adds the storage shape.

alter table public.classification_memberships
  add column if not exists display_visibility text not null default 'public'
    check (display_visibility in ('public', 'private')),
  add column if not exists pseudonym text;

-- Pseudonym is unique within a classification so two users can't collide on
-- "Mystery Otter" in the same leaderboard. NULL pseudonyms (the default for
-- all existing rows) are excluded from the uniqueness constraint via the
-- partial index.
create unique index if not exists classification_memberships_pseudonym_unique
  on public.classification_memberships (classification_id, pseudonym)
  where pseudonym is not null;

comment on column public.classification_memberships.display_visibility is
  'public (default) shows users.display_name on standings; private shows pseudonym to non-self viewers. Format classification ignores this at the query layer.';

comment on column public.classification_memberships.pseudonym is
  'Stable Mystery {Animal} handle. Generated lazily on first toggle to private. Kept once written so toggling public/private repeatedly returns the same handle.';
