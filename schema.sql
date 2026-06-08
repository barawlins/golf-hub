-- Golf Tournament Hub Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Teams Table
create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color_hex text not null,
  total_points float default 0
);

-- 2. Players Table
create table public.players (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references public.teams(id),
  name text not null,
  pin text not null,
  role text check (role in ('commissioner', 'player')) default 'player',
  handicap float default 0
);

-- 3. Rounds Table
create table public.rounds (
  id uuid primary key default uuid_generate_v4(),
  round_number int not null,
  status text check (status in ('pending', 'active', 'completed')) default 'pending'
);

-- 4. Matches Table
create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references public.rounds(id),
  course_id text,
  format text check (format in ('1v1', '2v1', '2v2', '1v1v1', 'nines')) not null,
  scoring_rule text check (scoring_rule in ('best_ball', 'aggregate', 'alternate_shot')),
  point_value float default 1,
  points_1st float,
  points_2nd float,
  points_3rd float,
  status text check (status in ('pending', 'in_progress', 'completed')) default 'pending'
);

-- 5. Match Participants (Maps players to matches)
create table public.match_participants (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id),
  player_id uuid references public.players(id),
  team_id uuid references public.teams(id)
);

-- 6. Hole Scores Table (For live strokes)
create table public.hole_scores (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id),
  player_id uuid references public.players(id),
  hole_number int not null,
  strokes int not null,
  bought_drives int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Realtime for the scores
alter publication supabase_realtime add table public.hole_scores;
alter publication supabase_realtime add table public.matches;
