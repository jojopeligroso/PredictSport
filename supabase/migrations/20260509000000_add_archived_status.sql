-- Add 'archived' to competition status check constraint
alter table public.competitions
  drop constraint if exists competitions_status_check;

alter table public.competitions
  add constraint competitions_status_check
  check (status in ('draft', 'active', 'completed', 'archived'));
