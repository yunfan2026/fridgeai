-- ============================================================================
-- FridgeAI v2 — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member',   -- 'owner' | 'member'
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.items (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households(id) on delete cascade,
  name              text not null,
  category          text,                          -- produce | dairy | meat | pantry | frozen | beverage | petfood | other
  location          text not null default 'Fridge',-- Fridge | Freezer | Pantry
  quantity          numeric not null default 1,
  unit              text default 'pieces',
  tracking_type     text not null default 'count', -- 'count' | 'portion'
  portion_remaining numeric not null default 1,     -- 0..1, only meaningful for tracking_type='portion'
  expires_at        date,                           -- absolute date; days-left computed client-side
  expiry_source     text default 'estimate',        -- 'printed' | 'estimate'
  flags             text[] not null default '{}',   -- e.g. {alcohol}
  added_by          uuid references auth.users(id),
  added_at          timestamptz not null default now()
);
create index if not exists items_household_idx on public.items(household_id);

create table if not exists public.waste_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_name    text not null,
  reason       text not null,                       -- 'consumed' | 'thrown'
  qty          numeric default 1,
  portion      numeric,                             -- fraction consumed for portion items
  user_id      uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists waste_log_household_idx on public.waste_log(household_id);

-- Anonymized recognition-quality signal: what the user changed in the review step.
create table if not exists public.scan_feedback (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  mode         text,                                -- 'groceries' | 'receipt'
  detected     integer default 0,                   -- items the scanner returned
  kept         integer default 0,                   -- kept unedited
  edited       integer default 0,                   -- name/qty/date corrected
  deleted      integer default 0,                   -- removed as wrong
  created_at   timestamptz not null default now()
);

-- ── Membership helper (SECURITY DEFINER avoids RLS recursion) ────────────────

create or replace function public.user_households()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

-- ── Row-Level Security ──────────────────────────────────────────────────────

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.items             enable row level security;
alter table public.waste_log         enable row level security;
alter table public.scan_feedback     enable row level security;

-- households: readable by members (creation/joining happen via RPCs below)
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (id in (select public.user_households()));

-- household_members: a user sees their own membership rows and their households' rosters
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select using (user_id = auth.uid() or household_id in (select public.user_households()));

-- items: full CRUD scoped to the user's households
drop policy if exists items_all on public.items;
create policy items_all on public.items
  for all
  using (household_id in (select public.user_households()))
  with check (household_id in (select public.user_households()));

-- waste_log: same scope
drop policy if exists waste_all on public.waste_log;
create policy waste_all on public.waste_log
  for all
  using (household_id in (select public.user_households()))
  with check (household_id in (select public.user_households()));

-- scan_feedback: same scope
drop policy if exists feedback_all on public.scan_feedback;
create policy feedback_all on public.scan_feedback
  for all
  using (household_id in (select public.user_households()))
  with check (household_id in (select public.user_households()));

-- ── Household create / join RPCs (SECURITY DEFINER) ─────────────────────────

-- Short, unambiguous invite code (no 0/O/1/I).
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.households (name, invite_code)
    values (coalesce(nullif(trim(p_name), ''), 'My Household'), public.gen_invite_code())
    returning * into h;
  insert into public.household_members (household_id, user_id, role)
    values (h.id, auth.uid(), 'owner');
  return h;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into h from public.households
    where invite_code = upper(trim(p_code));
  if h.id is null then
    raise exception 'No household found for that code';
  end if;
  insert into public.household_members (household_id, user_id, role)
    values (h.id, auth.uid(), 'member')
    on conflict (household_id, user_id) do nothing;
  return h;
end;
$$;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Push live inserts/updates/deletes to roommates.
do $$
begin
  begin
    alter publication supabase_realtime add table public.items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.waste_log;
  exception when duplicate_object then null;
  end;
end $$;
