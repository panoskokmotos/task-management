-- ─────────────────────────────────────────────────────────────
-- Task OS — Supabase cloud-sync setup
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- ─────────────────────────────────────────────────────────────

-- One row per user holding the entire app state as JSON.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only read/write their own row.
alter table public.app_state enable row level security;

drop policy if exists "app_state select own" on public.app_state;
create policy "app_state select own"
  on public.app_state for select
  using (auth.uid() = user_id);

drop policy if exists "app_state insert own" on public.app_state;
create policy "app_state insert own"
  on public.app_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "app_state update own" on public.app_state;
create policy "app_state update own"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Setup steps:
--
-- 1) Create a free project at https://supabase.com
-- 2) SQL Editor → paste this file → Run.
-- 3) (Recommended) Authentication → Providers → Email:
--      turn OFF "Confirm email" for the fastest single-user setup,
--      OR leave it on and confirm via the email you'll receive.
-- 4) Project Settings → API → copy:
--      • Project URL      (e.g. https://abcd1234.supabase.co)
--      • anon public key  (the long eyJ... token — safe for browser use; RLS protects data)
-- 5) In Task OS → Settings → Cloud Sync (Supabase):
--      paste the URL + anon key, enter an email + password, click "Connect & Sync".
--    The first connect signs up/in and creates your row; data then syncs across devices.
--
-- To let OTHERS sign up (hosted product mode) instead of pasting keys:
--  • Authentication → Providers → enable Email and Google.
--  • Authentication → URL Configuration → add your site URL to the redirect allow-list.
--  • Paste the Project URL + anon key into APP_CONFIG at the top of index.html's
--    script. Users then get the Sign up / Log in screen — no key pasting.
--
-- Notes:
--  • The anon key is meant to be public; Row Level Security above ensures a user
--    can only ever touch their own row.
--  • Conflict resolution is last-write-wins by the app's internal _updatedAt timestamp.
--  • localStorage remains the offline cache, so the app keeps working with no connection.
-- ─────────────────────────────────────────────────────────────
