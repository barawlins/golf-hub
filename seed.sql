-- 1. Add logo_url column to teams (in case they want custom images later)
alter table public.teams add column if not exists logo_url text;

-- 2. Insert 3 Placeholder Teams (Using specific UUIDs so we can link players to them)
insert into public.teams (id, name, color_hex, total_points)
values 
  ('11111111-1111-1111-1111-111111111111', 'Team 1', '#4ade80', 0),
  ('22222222-2222-2222-2222-222222222222', 'Team 2', '#60a5fa', 0),
  ('33333333-3333-3333-3333-333333333333', 'Team 3', '#f87171', 0)
on conflict (id) do nothing;

-- 3. Insert 9 Placeholder Players
-- Notice the 3 'commissioner' roles. They will have access to the Admin Panel.
insert into public.players (team_id, name, pin, role)
values
  -- Team 1
  ('11111111-1111-1111-1111-111111111111', 'Admin Player 1', '1111', 'commissioner'),
  ('11111111-1111-1111-1111-111111111111', 'Player 2', '0000', 'player'),
  ('11111111-1111-1111-1111-111111111111', 'Player 3', '0000', 'player'),
  
  -- Team 2
  ('22222222-2222-2222-2222-222222222222', 'Admin Player 4', '2222', 'commissioner'),
  ('22222222-2222-2222-2222-222222222222', 'Player 5', '0000', 'player'),
  ('22222222-2222-2222-2222-222222222222', 'Player 6', '0000', 'player'),
  
  -- Team 3
  ('33333333-3333-3333-3333-333333333333', 'Admin Player 7', '3333', 'commissioner'),
  ('33333333-3333-3333-3333-333333333333', 'Player 8', '0000', 'player'),
  ('33333333-3333-3333-3333-333333333333', 'Player 9', '0000', 'player');
