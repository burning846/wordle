-- Schema for the v2 player system. Applied by `npm run migrate`, and by the tests
-- against an in-process Postgres, so it has to stay plain portable SQL.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One row per device bound to a player. Only the hash is stored: a leaked database
-- must not hand out working credentials, and the raw token is shown once, to its own
-- device, and never again.
create table if not exists devices (
  token_hash text primary key,
  player_id uuid not null references players(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists devices_by_player on devices (player_id);

-- Single-use, short-lived code that binds a second device to an existing player.
-- This is what makes cross-device play possible without asking anyone to log in.
create table if not exists link_codes (
  code_hash text primary key,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists results (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  mode text not null check (mode in ('daily', 'practice')),
  length smallint not null check (length between 4 and 7),
  -- Difficulty belongs to practice alone; the daily word is the same for everyone.
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  day_index integer,
  answer text not null,
  guesses text[] not null check (cardinality(guesses) > 0),
  won boolean not null,
  hard_mode boolean not null default false,
  -- Milliseconds from the first keystroke to the last guess, when the client reports it.
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),

  constraint results_daily_has_day check ((mode = 'daily') = (day_index is not null)),
  constraint results_practice_has_difficulty check ((mode = 'practice') = (difficulty is not null))
);

-- A daily puzzle counts once per player, per length. This is the database half of the
-- duplicate protection the client already does in localStorage.
create unique index if not exists results_one_daily_per_player
  on results (player_id, length, day_index)
  where mode = 'daily';

create index if not exists results_leaderboard
  on results (day_index, length, cardinality(guesses), duration_ms)
  where mode = 'daily' and won;

create index if not exists results_player_history on results (player_id, created_at desc);
