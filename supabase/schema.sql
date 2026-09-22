-- =====================================================================================================
-- Eimaste Cool Training: database schema for Supabase
--
-- How to use: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- It is safe to run again (after an app update, or if something went wrong): nothing is duplicated and
-- no data is deleted. The result table at the end lists every member with their join link.
--
-- Design
-- - Every table keeps the app's object as-is in `data` (jsonb, camelCase like src/data/types.ts).
--   A few columns duplicate what security and uniqueness need (member_id, date, from_id, to_id).
-- - Row-level security: only signed-in squad members can read anything. Everyone writes only their own
--   rows; the coach may manage everyone. Visitors who are not signed in can only call login_profiles().
-- - Logins: members.user_id links a squad member to a Supabase Auth user. It is set by claim_invite()
--   (the friend opens their invite link and picks a password) and cleared by reset_invite(..., true).
-- =====================================================================================================

-- ----------------------------------------------------------------------------------------- tables

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  role text not null check (role in ('coach', 'athlete')),
  user_id uuid unique references auth.users on delete set null,
  login_email text,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  updated_at bigint not null default 0
);

-- Invite codes are only visible to the coach.
create table if not exists public.member_invites (
  member_id uuid primary key references public.members on delete cascade,
  code text not null
);

create table if not exists public.programs (
  id text primary key,
  created_by uuid references public.members on delete set null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at bigint not null
);

create table if not exists public.workout_logs (
  id text primary key,
  member_id uuid not null references public.members on delete cascade,
  data jsonb not null,
  updated_at bigint not null,
  constraint workout_logs_data_check check (jsonb_typeof(data) = 'object' and data->>'memberId' = member_id::text)
);

create table if not exists public.weights (
  id text primary key,
  member_id uuid not null references public.members on delete cascade,
  date date not null,
  data jsonb not null,
  updated_at bigint not null,
  unique (member_id, date),
  constraint weights_data_check check (
    jsonb_typeof(data) = 'object' and data->>'memberId' = member_id::text and (data->>'date')::date = date
  )
);

create table if not exists public.meal_plans (
  id text primary key,
  member_id uuid not null references public.members on delete cascade,
  data jsonb not null,
  updated_at bigint not null,
  constraint meal_plans_data_check check (jsonb_typeof(data) = 'object' and data->>'memberId' = member_id::text)
);

create table if not exists public.checkins (
  id text primary key,
  member_id uuid not null references public.members on delete cascade,
  date date not null,
  data jsonb not null,
  updated_at bigint not null,
  unique (member_id, date),
  constraint checkins_data_check check (
    jsonb_typeof(data) = 'object' and data->>'memberId' = member_id::text and (data->>'date')::date = date
  )
);

create table if not exists public.cheers (
  id text primary key,
  from_id uuid not null references public.members on delete cascade,
  to_id uuid not null references public.members on delete cascade,
  data jsonb not null,
  created_at bigint not null,
  updated_at bigint not null,
  constraint cheers_data_check check (
    jsonb_typeof(data) = 'object' and data->>'fromId' = from_id::text and data->>'toId' = to_id::text
  )
);

-- Foreign keys used by cascades and policies.
create index if not exists workout_logs_member_idx on public.workout_logs (member_id);
create index if not exists meal_plans_member_idx on public.meal_plans (member_id);
create index if not exists cheers_from_idx on public.cheers (from_id);
create index if not exists cheers_to_idx on public.cheers (to_id);
create index if not exists programs_created_by_idx on public.programs (created_by);

alter table public.members enable row level security;
alter table public.member_invites enable row level security;
alter table public.programs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.weights enable row level security;
alter table public.meal_plans enable row level security;
alter table public.checkins enable row level security;
alter table public.cheers enable row level security;

-- ----------------------------------------------------------------------------------------- helpers

create or replace function public.now_ms() returns bigint
language sql volatile set search_path = public as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- 6 characters, uppercase, without the look-alikes 0/O/1/I. 32 symbols, so every byte maps evenly.
create or replace function public.gen_invite_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(s.b, i) % 32 + 1, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) s, generate_series(0, 5) as i
$$;

-- Profile defaults for new members (mirrors the demo seed in the app).
create or replace function public.default_member_data(p_name text, p_role text, p_color text) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'name', p_name,
    'color', p_color,
    'competes', p_role = 'athlete',
    'goal', '',
    'goalWeightKg', null,
    'heightCm', null,
    'programId', 'bts-12',
    'programStart', null,
    'coachNote', '',
    'coachNoteAt', null,
    'settings', jsonb_build_object('unit', 'kg', 'machines', '{}'::jsonb, 'weightVisibility', 'change')
  )
$$;

create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from public.members m where m.user_id = auth.uid()
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_member_id() is not null
$$;

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'coach')
$$;

-- False when the member chose to keep their body weight private.
create or replace function public.weights_shared(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.data->'settings'->>'weightVisibility' from public.members m where m.id = p_member),
    'change'
  ) <> 'private'
$$;

-- ----------------------------------------------------------------------------------------- triggers

-- Guards what signed-in users may change on members. The SQL editor / service role (no user JWT) is trusted.
-- - user_id / login_email change only inside claim_invite() and reset_invite() (they set ect.allow_link).
-- - Non-coaches keep their role, slug and the coach-owned profile fields.
create or replace function public.members_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_coach_keys text[] := array['coachNote', 'coachNoteAt', 'competes'];
begin
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(current_setting('ect.allow_link', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.user_id := null;
      new.login_email := null;
    else
      new.user_id := old.user_id;
      new.login_email := old.login_email;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    if not public.is_coach() then
      new.role := old.role;
      new.slug := old.slug;
      new.data := (new.data - v_coach_keys)
        || (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
            from jsonb_each(old.data) e where e.key = any (v_coach_keys));
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members
  for each row execute function public.members_guard();

-- Every member gets an invite code as soon as they exist.
create or replace function public.members_create_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.member_invites (member_id, code)
  values (new.id, public.gen_invite_code())
  on conflict (member_id) do nothing;
  return null;
end
$$;

drop trigger if exists members_create_invite on public.members;
create trigger members_create_invite after insert on public.members
  for each row execute function public.members_create_invite();

-- The recipient of a cheer may only mark it as seen; nobody re-addresses a cheer.
create or replace function public.cheers_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.id := old.id;
  new.from_id := old.from_id;
  new.to_id := old.to_id;
  new.created_at := old.created_at;
  if old.from_id is distinct from public.current_member_id() then
    new.data := old.data || jsonb_build_object('seenAt', new.data->'seenAt', 'updatedAt', new.data->'updatedAt');
  end if;
  return new;
end
$$;

drop trigger if exists cheers_guard on public.cheers;
create trigger cheers_guard before update on public.cheers
  for each row execute function public.cheers_guard();

-- ----------------------------------------------------------------------------------------- RPCs

-- The login screen lists the squad before anyone signs in (names and colors only, never data).
drop function if exists public.login_profiles();
create function public.login_profiles()
returns table (id uuid, slug text, name text, color text, role text, joined boolean, login_email text)
language sql stable security definer set search_path = public as $$
  select m.id,
         m.slug,
         coalesce(nullif(m.data->>'name', ''), m.slug),
         coalesce(nullif(m.data->>'color', ''), 'blue'),
         m.role,
         m.user_id is not null,
         m.login_email
  from public.members m
  order by lower(coalesce(nullif(m.data->>'name', ''), m.slug))
$$;

-- A signed-up user claims a squad member with the invite code the coach shared.
create or replace function public.claim_invite(p_slug text, p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_member public.members%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_member from public.members where slug = lower(btrim(p_slug)) for update;
  if not found then
    raise exception 'invalid_invite';
  end if;
  if v_member.user_id = v_uid then
    return v_member.id; -- already ours (e.g. a retry after a lost response)
  end if;
  if v_member.user_id is not null then
    raise exception 'already_joined';
  end if;
  select i.code into v_code from public.member_invites i where i.member_id = v_member.id;
  if v_code is null or upper(btrim(coalesce(p_code, ''))) <> upper(btrim(v_code)) then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.members m where m.user_id = v_uid) then
    raise exception 'already_linked';
  end if;

  perform set_config('ect.allow_link', 'on', true);
  update public.members
     set user_id = v_uid, login_email = auth.email(), updated_at = greatest(updated_at + 1, public.now_ms())
   where id = v_member.id;
  perform set_config('ect.allow_link', 'off', true);

  -- A used link must not work twice.
  update public.member_invites set code = public.gen_invite_code() where member_id = v_member.id;
  return v_member.id;
end
$$;

-- Coach: new invite code for a member. p_detach also unlinks the current login ("forgot password").
create or replace function public.reset_invite(p_member uuid, p_detach boolean) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text := public.gen_invite_code();
begin
  if not public.is_coach() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members where id = p_member) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.member_invites (member_id, code) values (p_member, v_code)
  on conflict (member_id) do update set code = excluded.code;
  if p_detach then
    perform set_config('ect.allow_link', 'on', true);
    update public.members
       set user_id = null, login_email = null, updated_at = greatest(updated_at + 1, public.now_ms())
     where id = p_member;
    perform set_config('ect.allow_link', 'off', true);
  end if;
  return v_code;
end
$$;

-- Coach: add a squad member (an invite code is created by the members_create_invite trigger).
create or replace function public.create_member(p_slug text, p_name text, p_role text, p_color text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_id uuid;
begin
  if not public.is_coach() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,23}$' then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('coach', 'athlete') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if exists (select 1 from public.members where slug = v_slug) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;
  insert into public.members (slug, role, data, updated_at)
  values (
    v_slug,
    p_role,
    public.default_member_data(coalesce(nullif(btrim(p_name), ''), v_slug), p_role, coalesce(nullif(btrim(p_color), ''), 'blue')),
    public.now_ms()
  )
  returning id into v_id;
  return v_id;
end
$$;

-- ----------------------------------------------------------------------------------------- policies

-- Start from a clean slate so renamed or removed policies from older versions of this file disappear.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('members', 'member_invites', 'programs', 'workout_logs', 'weights', 'meal_plans', 'checkins', 'cheers')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- members
create policy members_select on public.members for select to authenticated
  using ((select public.is_member()));
create policy members_update on public.members for update to authenticated
  using (id = (select public.current_member_id()) or (select public.is_coach()))
  with check (id = (select public.current_member_id()) or (select public.is_coach()));
create policy members_insert on public.members for insert to authenticated
  with check ((select public.is_coach()));
create policy members_delete on public.members for delete to authenticated
  using ((select public.is_coach()));

-- member_invites (coach only)
create policy member_invites_select on public.member_invites for select to authenticated
  using ((select public.is_coach()));
create policy member_invites_update on public.member_invites for update to authenticated
  using ((select public.is_coach()))
  with check ((select public.is_coach()));

-- programs: everyone reads, the coach writes
create policy programs_select on public.programs for select to authenticated
  using ((select public.is_member()));
create policy programs_insert on public.programs for insert to authenticated
  with check ((select public.is_coach()));
create policy programs_update on public.programs for update to authenticated
  using ((select public.is_coach()))
  with check ((select public.is_coach()));
create policy programs_delete on public.programs for delete to authenticated
  using ((select public.is_coach()));

-- Member-owned tables: the squad reads, the owner (or the coach) writes.
do $$
declare
  t text;
  own text := 'member_id = (select public.current_member_id()) or (select public.is_coach())';
begin
  foreach t in array array['workout_logs', 'weights', 'meal_plans', 'checkins'] loop
    if t = 'weights' then
      execute format(
        'create policy %1$s_select on public.%1$I for select to authenticated using ((select public.is_member()) and (%2$s or public.weights_shared(member_id)))',
        t, own);
    else
      execute format('create policy %1$s_select on public.%1$I for select to authenticated using ((select public.is_member()))', t);
    end if;
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (%2$s)', t, own);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (%2$s) with check (%2$s)', t, own);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (%2$s)', t, own);
  end loop;
end $$;

-- cheers: sent as yourself; the recipient may mark them seen; only the sender deletes
create policy cheers_select on public.cheers for select to authenticated
  using ((select public.is_member()));
create policy cheers_insert on public.cheers for insert to authenticated
  with check (from_id = (select public.current_member_id()));
create policy cheers_update on public.cheers for update to authenticated
  using (from_id = (select public.current_member_id()) or to_id = (select public.current_member_id()))
  with check (from_id = (select public.current_member_id()) or to_id = (select public.current_member_id()));
create policy cheers_delete on public.cheers for delete to authenticated
  using (from_id = (select public.current_member_id()));

-- ----------------------------------------------------------------------------------------- privileges

revoke all on table public.members, public.member_invites, public.programs, public.workout_logs, public.weights,
  public.meal_plans, public.checkins, public.cheers from public, anon, authenticated;
grant select, insert, update, delete on table public.members, public.programs, public.workout_logs, public.weights,
  public.meal_plans, public.checkins, public.cheers to authenticated;
grant select, update (code) on table public.member_invites to authenticated;

revoke all on function public.now_ms(), public.gen_invite_code(), public.default_member_data(text, text, text),
  public.current_member_id(), public.is_member(), public.is_coach(), public.weights_shared(uuid),
  public.members_guard(), public.members_create_invite(), public.cheers_guard(), public.login_profiles(),
  public.claim_invite(text, text), public.reset_invite(uuid, boolean), public.create_member(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.current_member_id(), public.is_member(), public.is_coach(), public.weights_shared(uuid),
  public.claim_invite(text, text), public.reset_invite(uuid, boolean), public.create_member(text, text, text, text)
  to authenticated;
grant execute on function public.login_profiles() to anon, authenticated;

-- ----------------------------------------------------------------------------------------- storage

-- Meal plan attachments (PDFs and photos from the nutritionist). Private: files are opened with signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-plans', 'meal-plans', false, 15728640,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/gif', 'text/plain'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live under "<member id>/...": the owner and the coach have access.
drop policy if exists ect_meal_plans_select on storage.objects;
drop policy if exists ect_meal_plans_insert on storage.objects;
drop policy if exists ect_meal_plans_update on storage.objects;
drop policy if exists ect_meal_plans_delete on storage.objects;
create policy ect_meal_plans_select on storage.objects for select to authenticated
  using (bucket_id = 'meal-plans'
         and ((select public.is_coach()) or (storage.foldername(name))[1] = (select public.current_member_id())::text));
create policy ect_meal_plans_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-plans'
              and ((select public.is_coach()) or (storage.foldername(name))[1] = (select public.current_member_id())::text));
create policy ect_meal_plans_update on storage.objects for update to authenticated
  using (bucket_id = 'meal-plans'
         and ((select public.is_coach()) or (storage.foldername(name))[1] = (select public.current_member_id())::text))
  with check (bucket_id = 'meal-plans'
              and ((select public.is_coach()) or (storage.foldername(name))[1] = (select public.current_member_id())::text));
create policy ect_meal_plans_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meal-plans'
         and ((select public.is_coach()) or (storage.foldername(name))[1] = (select public.current_member_id())::text));

-- ----------------------------------------------------------------------------------------- realtime

-- Live updates: the app listens to every data table (member_invites stays private).
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found: live updates are off until it exists.';
    return;
  end if;
  foreach t in array array['members', 'programs', 'workout_logs', 'weights', 'meal_plans', 'checkins', 'cheers'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------------------- seed

insert into public.members (slug, role, data, updated_at) values
  ('dennis', 'coach', public.default_member_data('Dennis', 'coach', 'aqua'), 1),
  ('stelios', 'athlete', public.default_member_data('Stelios', 'athlete', 'blue'), 1),
  ('thanos', 'athlete', public.default_member_data('Thanos', 'athlete', 'orange'), 1)
on conflict (slug) do nothing;

-- Members created before the invite trigger existed (or whose invite was deleted by hand) get one now.
insert into public.member_invites (member_id, code)
select m.id, public.gen_invite_code() from public.members m
on conflict (member_id) do nothing;

-- ----------------------------------------------------------------------------------------- result

-- Join links: add each one to your site address, e.g. https://you.github.io/EimasteCoolTraining/#/join/dennis?code=ABC123
select coalesce(nullif(m.data->>'name', ''), m.slug) as name,
       m.role,
       m.user_id is not null as joined,
       '#/join/' || m.slug || '?code=' || i.code as join_link
from public.members m
left join public.member_invites i on i.member_id = m.id
order by (m.role = 'coach') desc, m.slug;
