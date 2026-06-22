-- =============================================================================
-- CollabCode — Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.
-- =============================================================================

-- Users (synced from Clerk via webhook or upserted on first API call)
create table if not exists public.users (
  id          text primary key,          -- Clerk user ID (user_xxxxxxxx)
  email       text unique not null,
  username    text,
  avatar_url  text,
  created_at  timestamptz default now() not null
);

-- Rooms
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    text not null references public.users(id) on delete cascade,
  language     text not null default 'javascript',
  invite_token text unique,              -- nanoid(12), null = no active invite
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

-- Room membership & roles
create table if not exists public.room_members (
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     text not null references public.users(id) on delete cascade,
  role        text not null default 'editor',  -- 'owner' | 'editor' | 'viewer'
  joined_at   timestamptz default now() not null,
  primary key (room_id, user_id),
  constraint valid_role check (role in ('owner', 'editor', 'viewer'))
);

-- Code snapshots (periodic saves of Yjs document state)
create table if not exists public.snippets (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  content     text not null default '',
  language    text not null default 'javascript',
  created_by  text references public.users(id) on delete set null,
  created_at  timestamptz default now() not null
);

-- Execution history
create table if not exists public.executions (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  triggered_by    text references public.users(id) on delete set null,
  language        text not null,
  source_code     text not null,
  stdin           text,
  stdout          text,
  stderr          text,
  status          text not null default 'queued',
  -- 'queued' | 'processing' | 'accepted' | 'wrong_answer' |
  -- 'time_limit_exceeded' | 'compilation_error' | 'runtime_error' | 'error'
  judge0_token    text,              -- null when using Piston; populated when swapped to Judge0
  execution_time  numeric,           -- seconds (null with Piston; Judge0 provides this)
  memory_used     numeric,           -- KB (null with Piston; Judge0 provides this)
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  constraint valid_status check (status in (
    'queued','processing','accepted','wrong_answer',
    'time_limit_exceeded','compilation_error','runtime_error','error','internal_error','exec_format_error'
  ))
);

-- =============================================================================
-- Indexes
-- =============================================================================
create index if not exists idx_rooms_owner       on public.rooms(owner_id);
create index if not exists idx_room_members_user on public.room_members(user_id);
create index if not exists idx_snippets_room     on public.snippets(room_id);
create index if not exists idx_executions_room   on public.executions(room_id);
create index if not exists idx_executions_status on public.executions(status);

-- =============================================================================
-- updated_at trigger helper
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

create or replace trigger executions_updated_at
  before update on public.executions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.users       enable row level security;
alter table public.rooms       enable row level security;
alter table public.room_members enable row level security;
alter table public.snippets    enable row level security;
alter table public.executions  enable row level security;

-- Users: only the owner can read/update their own row
create policy "users: own row" on public.users
  for all using (auth.uid()::text = id);

-- Rooms: visible to members only
create policy "rooms: members can read" on public.rooms
  for select using (
    exists (
      select 1 from public.room_members
      where room_id = rooms.id and user_id = auth.uid()::text
    )
  );

create policy "rooms: owner can update/delete" on public.rooms
  for all using (owner_id = auth.uid()::text);

-- Room members: members can see who else is in their rooms
create policy "room_members: visible to members" on public.room_members
  for select using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id and rm.user_id = auth.uid()::text
    )
  );

-- Snippets: room members can read; editors/owners can insert
create policy "snippets: members can read" on public.snippets
  for select using (
    exists (
      select 1 from public.room_members
      where room_id = snippets.room_id and user_id = auth.uid()::text
    )
  );

create policy "snippets: editors can insert" on public.snippets
  for insert with check (
    exists (
      select 1 from public.room_members
      where room_id = snippets.room_id
        and user_id = auth.uid()::text
        and role in ('owner','editor')
    )
  );

-- Executions: room members can read; editors/owners can insert
create policy "executions: members can read" on public.executions
  for select using (
    exists (
      select 1 from public.room_members
      where room_id = executions.room_id and user_id = auth.uid()::text
    )
  );

create policy "executions: editors can insert" on public.executions
  for insert with check (
    exists (
      select 1 from public.room_members
      where room_id = executions.room_id
        and user_id = auth.uid()::text
        and role in ('owner','editor')
    )
  );

-- =============================================================================
-- Migrations — run these if the schema already exists in your database
-- =============================================================================
alter table public.rooms
  add column if not exists invite_token text unique;