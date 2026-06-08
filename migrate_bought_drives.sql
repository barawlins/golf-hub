-- Migration to support bought drives
alter table public.hole_scores add column if not exists bought_drives int default 0;
