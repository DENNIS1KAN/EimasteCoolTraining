-- Security tests for supabase/schema.sql. Run by scripts/test-db.sh after stubs.sql and schema.sql.
-- Each block impersonates someone (SET ROLE + the JWT claims PostgREST would set) and asserts what they
-- may read and write. Any failed assertion raises an exception, which stops the run (ON_ERROR_STOP).
-- Writes use ect_test.upsert(), which issues the same INSERT ... ON CONFLICT (id) DO UPDATE as PostgREST.

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ============================================================================================ helpers

drop schema if exists ect_test cascade;
create schema ect_test;
grant usage on schema ect_test to public;

create table ect_test.users (name text primary key, id uuid not null, email text not null);
insert into ect_test.users values
  ('dennis', '00000000-0000-4000-8000-0000000000d1', 'dennis-aaaaaa@test.local'),
  ('stelios', '00000000-0000-4000-8000-0000000000a1', 'stelios-bbbbbb@test.local'),
  ('thanos', '00000000-0000-4000-8000-0000000000a2', 'thanos-cccccc@test.local'),
  ('thanos2', '00000000-0000-4000-8000-0000000000a3', 'thanos-dddddd@test.local'),
  ('mallory', '00000000-0000-4000-8000-0000000000e1', 'mallory@test.local');
insert into auth.users (id, email) select id, email from ect_test.users;

-- Become someone (null = signed out). Call as the superuser, then SET ROLE.
create procedure ect_test.act(p_name text) language plpgsql as $$
declare
  u ect_test.users;
begin
  if p_name is null then
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claim.email', '', false);
    return;
  end if;
  select * into strict u from ect_test.users where name = p_name;
  perform set_config('request.jwt.claim.sub', u.id::text, false);
  perform set_config('request.jwt.claim.email', u.email, false);
end $$;

create function ect_test.pass(p_label text) returns void language plpgsql as $$
begin
  raise notice 'PASS %', p_label;
end $$;

create function ect_test.eq(p_actual text, p_expected text, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected %, got %', p_label, coalesce(p_expected, 'NULL'), coalesce(p_actual, 'NULL');
  end if;
  raise notice 'PASS %', p_label;
end $$;

-- The statement must fail with an error whose message or SQLSTATE matches p_expect (a regex).
create function ect_test.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
declare
  v_msg text;
  v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_state = returned_sqlstate;
    if v_msg !~* p_expect and v_state !~* p_expect then
      raise exception 'FAIL %: expected an error matching "%", got [%] %', p_label, p_expect, v_state, v_msg;
    end if;
    raise notice 'PASS %', p_label;
    return;
  end;
  raise exception 'FAIL %: expected an error matching "%", but it succeeded: %', p_label, p_expect, p_sql;
end $$;

-- Rows visible to the current role.
create function ect_test.count(p_sql text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute format('select count(*) from (%s) s', p_sql) into n;
  return n;
end $$;

-- Rows changed by an UPDATE/DELETE as the current role (RLS silently skips rows it hides).
create function ect_test.affected(p_sql text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- PostgREST-style upsert of a JSON row.
create function ect_test.upsert(p_table text, p_row jsonb) returns void language plpgsql as $$
declare
  v_cols text;
  v_sets text;
begin
  select string_agg(quote_ident(k), ', '), string_agg(format('%1$I = excluded.%1$I', k), ', ')
    into v_cols, v_sets
  from jsonb_object_keys(p_row) k;
  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (id) do update set %3$s',
    p_table, v_cols, v_sets) using p_row;
end $$;

create function ect_test.upsert_sql(p_table text, p_row jsonb) returns text language sql as $$
  select format('select ect_test.upsert(%L, %L::jsonb)', p_table, p_row::text)
$$;

-- A member-owned row as the app writes it: columns + the domain object in data.
create function ect_test.owned(p_id text, p_member uuid, p_date text default null, p_data jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'member_id', p_member, 'updated_at', 1000)
    || case when p_date is null then '{}'::jsonb else jsonb_build_object('date', p_date) end
    || jsonb_build_object('data',
         jsonb_build_object('id', p_id, 'memberId', p_member, 'updatedAt', 1000)
         || case when p_date is null then '{}'::jsonb else jsonb_build_object('date', p_date) end
         || p_data)
$$;

create function ect_test.cheer(p_id text, p_from uuid, p_to uuid, p_data jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'from_id', p_from, 'to_id', p_to, 'created_at', 1000, 'updated_at', 1000,
    'data', jsonb_build_object('id', p_id, 'fromId', p_from, 'toId', p_to, 'kind', 'kudos', 'text', 'Beast mode',
      'emoji', '🔥', 'ref', null, 'createdAt', 1000, 'seenAt', null, 'updatedAt', 1000) || p_data)
$$;

-- Test-only peeks behind RLS.
create function ect_test.m(p_slug text) returns uuid language sql security definer as $$
  select id from public.members where slug = p_slug
$$;
create function ect_test.invite(p_slug text) returns text language sql security definer as $$
  select i.code from public.member_invites i join public.members m on m.id = i.member_id where m.slug = p_slug
$$;
create function ect_test.member_raw(p_slug text) returns public.members language sql security definer as $$
  select * from public.members where slug = p_slug
$$;

-- An unrelated bucket for the storage tests.
insert into storage.buckets (id, name, public) values ('other', 'other', false) on conflict do nothing;

-- ============================================================================================ install

do $$
begin
  perform ect_test.eq((select count(*) from public.members)::text, '3', 'seed: 3 members after two runs');
  perform ect_test.eq((select count(*) from public.member_invites)::text, '3', 'seed: every member has one invite');
  perform ect_test.eq(
    (select count(*) from public.member_invites where code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{12}$')::text, '3',
    'invite codes: 12 chars, uppercase, no 0/O/1/I');
  perform ect_test.eq((select count(distinct c)::text from (select public.gen_invite_code() c from generate_series(1, 2000)) g), '2000',
    'invite codes: no repeats in 2000');
  perform ect_test.eq((select count(distinct substr(c, k, 1))::text
                         from (select public.gen_invite_code() c from generate_series(1, 400)) g, generate_series(1, 12) k), '32',
    'invite codes: every symbol is used');
  perform ect_test.eq((select string_agg(slug || ':' || role || ':' || (data->>'color') || ':' || (data->>'competes'), ',' order by slug)
                         from public.members),
    'dennis:coach:aqua:true,stelios:athlete:blue:true,thanos:athlete:orange:true', 'seed: roles, colors, everyone competes');
  perform ect_test.eq((select data->>'programId' || '/' || (data->'settings'->>'unit') || '/' || (data->'settings'->>'weightVisibility')
                         from public.members where slug = 'stelios'), 'bts-12/kg/exact', 'seed: default profile data');
  perform ect_test.eq((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public')::text,
    '7', 'realtime: the 7 data tables are published once');
  perform ect_test.eq((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'member_invites')::text,
    '0', 'realtime: invites are not published');
  perform ect_test.eq((select public::text || '/' || file_size_limit || '/' || array_length(allowed_mime_types, 1)
                         from storage.buckets where id = 'meal-plans'), 'false/15728640/7', 'storage: private 15 MB meal-plans bucket');
  perform ect_test.eq((select count(*) from pg_policies where schemaname = 'storage' and policyname like 'ect_meal_plans_%')::text,
    '4', 'storage: 4 object policies');
  perform ect_test.eq((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname = 'public' and c.relkind = 'r')::text, 'true', 'RLS enabled on every public table');
  perform ect_test.eq((select bool_or(has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete'))
                         from unnest(array['members', 'member_invites', 'programs', 'workout_logs', 'weights', 'meal_plans',
                                           'checkins', 'cheers']) t)::text, 'false', 'grants: anon has no table access');
  perform ect_test.eq(has_table_privilege('authenticated', 'public.members', 'truncate')::text, 'false',
    'grants: no TRUNCATE for API users');
  perform ect_test.eq(has_function_privilege('anon', 'public.login_profiles()', 'execute')::text, 'true',
    'grants: anon may call login_profiles');
  perform ect_test.eq((has_function_privilege('anon', 'public.claim_invite(text,text)', 'execute')
                       or has_function_privilege('anon', 'public.create_member(text,text,text,text)', 'execute')
                       or has_function_privilege('anon', 'public.reset_invite(uuid,boolean)', 'execute'))::text, 'false',
    'grants: anon may not call the other RPCs');
  perform ect_test.eq(has_function_privilege('authenticated', 'public.gen_invite_code()', 'execute')::text, 'false',
    'grants: internal helpers are not callable');
  perform ect_test.eq((has_function_privilege('authenticated', 'public.patch_member(uuid,jsonb,bigint)', 'execute')
                       and not has_function_privilege('anon', 'public.patch_member(uuid,jsonb,bigint)', 'execute'))::text, 'true',
    'grants: patch_member is for signed-in users only');
  perform ect_test.eq((has_table_privilege('authenticated', 'public.invite_attempts', 'select,insert,update,delete')
                       or has_table_privilege('anon', 'public.invite_attempts', 'select,insert,update,delete'))::text, 'false',
    'grants: invite attempts are not reachable through the API');
  perform ect_test.eq((select count(*) from pg_trigger where tgname = 'stale_write_guard')::text, '7',
    'stale-write guard on the 7 data tables');
end $$;

-- ============================================================================================ anon

call ect_test.act(null);
set role anon;
do $$
declare
  t text;
begin
  foreach t in array array['members', 'member_invites', 'programs', 'workout_logs', 'weights', 'meal_plans', 'checkins', 'cheers'] loop
    perform ect_test.fails(format('select * from public.%I', t), 'permission denied', 'anon cannot read ' || t);
  end loop;
  perform ect_test.fails($q$insert into public.members (slug, role) values ('evil', 'coach')$q$, 'permission denied',
    'anon cannot insert members');
  perform ect_test.eq((select count(*) from public.login_profiles())::text, '3', 'anon lists login profiles');
  perform ect_test.eq((select string_agg(name || ':' || color || ':' || joined, ',' order by slug) from public.login_profiles()),
    'Dennis:aqua:false,Stelios:blue:false,Thanos:orange:false', 'login profiles: name, color, not joined');
  perform ect_test.fails($q$select public.claim_invite('dennis', 'AAAAAA')$q$, 'permission denied', 'anon cannot claim invites');
  perform ect_test.fails($q$select * from storage.objects$q$, 'permission denied', 'anon cannot list files');
end $$;
reset role;

-- ============================================================================================ outsider

-- mallory has an auth account (e.g. signed up with a wrong code) but no squad member.
call ect_test.act('mallory');
set role authenticated;
do $$
begin
  perform ect_test.eq(public.is_member()::text, 'false', 'outsider is not a member');
  perform ect_test.eq(ect_test.count('select * from public.members')::text, '0', 'outsider sees no members');
  perform ect_test.eq(ect_test.count('select * from public.member_invites')::text, '0', 'outsider sees no invites');
  perform ect_test.fails(ect_test.upsert_sql('workout_logs', ect_test.owned('x__bts-12__w1d0', ect_test.m('stelios'))),
    'row-level security', 'outsider cannot write logs');
  perform ect_test.eq(public.claim_invite('dennis', 'ZZZZZZ')::text, null, 'join: wrong code is refused');
  perform ect_test.eq(public.claim_invite('nobody', 'ZZZZZZ')::text, null, 'join: unknown member is refused');
  perform ect_test.eq(public.claim_invite('dennis', '')::text, null, 'join: empty code is refused');
  perform ect_test.eq(public.claim_invite('thanos', 'ZZZZZZZZZZZZ')::text, null, 'join: 4th wrong code');
  perform ect_test.eq(public.claim_invite('stelios', 'ZZZZZZZZZZZZ')::text, null, 'join: 5th wrong code');
  perform ect_test.fails(format('select public.claim_invite(%L, %L)', 'thanos', ect_test.invite('thanos')), 'too_many_attempts',
    'join: after 5 wrong codes in an hour even the right code is refused');
  perform ect_test.eq(((ect_test.member_raw('thanos')).user_id is null)::text, 'true', 'join: a throttled claim links nothing');
  perform ect_test.fails($q$select public.create_member('evil', 'Evil', 'coach', 'red')$q$, 'forbidden',
    'outsider cannot create members');
end $$;
reset role;

-- ============================================================================================ joining

call ect_test.act('dennis');
set role authenticated;
do $$
declare
  v_old text := ect_test.invite('dennis');
  v_id uuid;
begin
  v_id := public.claim_invite(' Dennis ', '  ' || lower(v_old) || ' ');
  perform ect_test.eq(v_id::text, ect_test.m('dennis')::text, 'join: right code works (any case, spaces trimmed)');
  perform ect_test.eq((ect_test.invite('dennis') <> v_old)::text, 'true', 'join: invite code rotates after use');
  perform ect_test.eq((select login_email || ':' || joined from public.login_profiles() where slug = 'dennis'),
    'dennis-aaaaaa@test.local:true', 'join: login e-mail recorded, profile shows joined');
  perform ect_test.eq(public.claim_invite('dennis', 'whatever')::text, v_id::text, 'join: repeating a claim as the same user is harmless');
  perform ect_test.eq(public.is_coach()::text, 'true', 'dennis is the coach');
  perform ect_test.fails(format('select public.claim_invite(%L, %L)', 'stelios', ect_test.invite('stelios')), 'already_linked',
    'join: one login cannot claim a second member');
end $$;
reset role;

call ect_test.act('mallory');
set role authenticated;
do $$
begin
  perform ect_test.fails(format('select public.claim_invite(%L, %L)', 'dennis', ect_test.invite('dennis')), 'already_joined',
    'join: a joined member cannot be claimed again');
end $$;
reset role;

call ect_test.act('stelios');
set role authenticated;
select ect_test.eq(public.claim_invite('stelios', ect_test.invite('stelios'))::text, ect_test.m('stelios')::text, 'stelios joins');
reset role;

call ect_test.act('thanos');
set role authenticated;
select ect_test.eq(public.claim_invite('thanos', ect_test.invite('thanos'))::text, ect_test.m('thanos')::text, 'thanos joins');
reset role;

-- ============================================================================================ athlete

call ect_test.act('stelios');
set role authenticated;
do $$
declare
  me uuid := ect_test.m('stelios');
  thanos uuid := ect_test.m('thanos');
  m public.members;
begin
  perform ect_test.eq(ect_test.count('select * from public.members')::text, '3', 'athlete sees the squad');

  -- own profile: editable fields change, protected ones do not
  perform ect_test.eq(ect_test.affected(format(
    $q$update public.members set role = 'coach', slug = 'boss', user_id = %L, login_email = 'x@y',
         data = data || '{"name":"Stelios K","goal":"Bench 100","heightCm":181,"coachNote":"hacked","coachNoteAt":5,"competes":false,
                           "settings":{"unit":"lb","machines":{"Leg Press":"Hammer"},"weightVisibility":"exact"}}'::jsonb,
         updated_at = 9000000002000
       where id = %L$q$, '00000000-0000-4000-8000-0000000000e1', me))::text, '1', 'athlete updates own profile row');
  m := ect_test.member_raw('stelios');
  perform ect_test.eq(m.role || '/' || m.slug, 'athlete/stelios', 'athlete cannot change own role or slug');
  perform ect_test.eq(m.user_id::text || '/' || m.login_email, '00000000-0000-4000-8000-0000000000a1/stelios-bbbbbb@test.local',
    'athlete cannot re-link the login');
  perform ect_test.eq((m.data->>'coachNote') || '/' || coalesce(m.data->>'coachNoteAt', 'null') || '/' || (m.data->>'competes'),
    '/null/true', 'athlete cannot change coachNote, coachNoteAt or competes');
  perform ect_test.eq((m.data->>'name') || '/' || (m.data->>'goal') || '/' || (m.data->>'heightCm') || '/'
                      || (m.data->'settings'->>'unit') || '/' || (m.data->'settings'->'machines'->>'Leg Press') || '/' || m.updated_at,
    'Stelios K/Bench 100/181/lb/Hammer/9000000002000', 'athlete changes name, goal, settings');

  perform ect_test.eq(ect_test.affected(format(
    $q$update public.members set data = data || '{"name":"Hacked"}'::jsonb where id = %L$q$, thanos))::text, '0',
    'athlete cannot edit someone else''s profile');
  perform ect_test.fails($q$insert into public.members (slug, role) values ('evil', 'coach')$q$, 'row-level security',
    'athlete cannot add members');
  perform ect_test.eq(ect_test.affected(format('delete from public.members where id = %L', thanos))::text, '0',
    'athlete cannot delete members');

  perform ect_test.eq(ect_test.count('select * from public.member_invites')::text, '0', 'athlete cannot read invites');
  perform ect_test.eq(ect_test.affected($q$update public.member_invites set code = 'AAAAAA'$q$)::text, '0',
    'athlete cannot change invites');
  perform ect_test.fails(format('select public.reset_invite(%L, true)', thanos), 'forbidden', 'athlete cannot reset invites');
  perform ect_test.fails($q$select public.create_member('evil', 'Evil', 'athlete', 'red')$q$, 'forbidden',
    'athlete cannot create members');
  perform ect_test.fails($q$select public.gen_invite_code()$q$, 'permission denied', 'athlete cannot mint invite codes');

  -- own rows
  perform ect_test.upsert('workout_logs', ect_test.owned(me || '__bts-12__w1d0', me, null, '{"week":1,"day":0,"done":true}'));
  perform ect_test.upsert('workout_logs', ect_test.owned(me || '__bts-12__w1d0', me, null, '{"week":1,"day":0,"note":"PR!"}'));
  perform ect_test.eq(ect_test.count(format('select * from public.workout_logs where member_id = %L and data->>''note'' = ''PR!''', me))::text,
    '1', 'athlete writes and re-writes own workout log');
  perform ect_test.upsert('weights', ect_test.owned(me || '__2026-09-01', me, '2026-09-01', '{"kg":82.4}'));
  perform ect_test.upsert('checkins', ect_test.owned(me || '__2026-09-01', me, '2026-09-01', '{"rating":"on"}'));
  perform ect_test.upsert('meal_plans', ect_test.owned('plan-stelios-self', me, null, '{"title":"My plan","meals":[]}'));
  perform ect_test.pass('athlete writes own weight, check-in and meal plan');
  perform ect_test.eq(ect_test.affected(format('delete from public.checkins where id = %L', me || '__2026-09-01'))::text, '1',
    'athlete deletes own check-in');

  -- other people's rows
  perform ect_test.fails(ect_test.upsert_sql('workout_logs', ect_test.owned(thanos || '__bts-12__w1d0', thanos)),
    'row-level security', 'athlete cannot write someone else''s log');
  perform ect_test.fails(ect_test.upsert_sql('weights', ect_test.owned(thanos || '__2026-09-01', thanos, '2026-09-01', '{"kg":1}')),
    'row-level security', 'athlete cannot write someone else''s weight');
  perform ect_test.fails(ect_test.upsert_sql('checkins', ect_test.owned(thanos || '__2026-09-01', thanos, '2026-09-01')),
    'row-level security', 'athlete cannot write someone else''s check-in');
  perform ect_test.fails(ect_test.upsert_sql('meal_plans', ect_test.owned('plan-x', thanos)), 'row-level security',
    'athlete cannot write someone else''s meal plan');
  perform ect_test.fails(ect_test.upsert_sql('programs',
    jsonb_build_object('id', 'custom', 'data', '{"id":"custom","name":"Mine"}'::jsonb, 'updated_at', 1)),
    'row-level security', 'athlete cannot write programs');

  -- integrity checks
  perform ect_test.fails(ect_test.upsert_sql('workout_logs',
    ect_test.owned(me || '__bts-12__w1d1', me, null, jsonb_build_object('memberId', thanos))), 'workout_logs_data_check',
    'integrity: data.memberId must match member_id');
  perform ect_test.fails(ect_test.upsert_sql('weights',
    ect_test.owned(me || '__2026-09-02', me, '2026-09-02', '{"date":"2026-09-03"}')), 'weights_data_check',
    'integrity: data.date must match date');
  perform ect_test.fails(ect_test.upsert_sql('weights', ect_test.owned('dup-weight', me, '2026-09-01')), 'weights_member_id_date_key',
    'integrity: one weight per member per day');

  -- cheers
  perform ect_test.upsert('cheers', ect_test.cheer('cheer-1', me, thanos));
  perform ect_test.pass('athlete sends a cheer');
  perform ect_test.fails(ect_test.upsert_sql('cheers', ect_test.cheer('cheer-forged', thanos, me)), 'row-level security',
    'athlete cannot send a cheer as someone else');
  perform ect_test.fails(ect_test.upsert_sql('cheers',
    ect_test.cheer('cheer-2', me, thanos, jsonb_build_object('toId', me))), 'cheers_data_check',
    'integrity: cheer data must match from/to');

  -- storage
  insert into storage.objects (bucket_id, name) values ('meal-plans', me || '/plan.pdf');
  perform ect_test.pass('athlete uploads into own folder');
  perform ect_test.fails(format($q$insert into storage.objects (bucket_id, name) values ('meal-plans', %L)$q$, thanos || '/x.pdf'),
    'row-level security', 'athlete cannot upload into someone else''s folder');
  perform ect_test.fails(format($q$insert into storage.objects (bucket_id, name) values ('other', %L)$q$, me || '/x.pdf'),
    'row-level security', 'athlete cannot upload into other buckets');
  perform ect_test.fails($q$insert into storage.objects (bucket_id, name) values ('meal-plans', 'loose.pdf')$q$,
    'row-level security', 'athlete cannot upload outside a member folder');
end $$;
reset role;

call ect_test.act('thanos');
set role authenticated;
do $$
declare
  me uuid := ect_test.m('thanos');
  stelios uuid := ect_test.m('stelios');
begin
  perform ect_test.eq(ect_test.affected(format(
    $q$update public.members set data = jsonb_set(data, '{settings,weightVisibility}', '"private"') where id = %L$q$, me))::text,
    '1', 'thanos makes his weight private');
  perform ect_test.upsert('weights', ect_test.owned(me || '__2026-09-01', me, '2026-09-01', '{"kg":95.1}'));
  perform ect_test.eq(ect_test.count('select * from public.weights where member_id = ' || quote_literal(me))::text, '1',
    'private weights stay visible to their owner');
  perform ect_test.eq(ect_test.count('select * from public.weights where member_id = ' || quote_literal(stelios))::text, '1',
    'shared weights are visible to the squad');

  -- a log id collision must not let him overwrite Stelios's log
  perform ect_test.fails(ect_test.upsert_sql('workout_logs', ect_test.owned(stelios || '__bts-12__w1d0', me)),
    'row-level security', 'athlete cannot hijack another member''s row id');
  perform ect_test.eq(ect_test.affected(format('delete from public.workout_logs where member_id = %L', stelios))::text, '0',
    'athlete cannot delete someone else''s log');

  -- cheers addressed to him: he may mark them seen, nothing else. The app sends a plain UPDATE here: an upsert
  -- is also an INSERT attempt, which the insert policy refuses for cheers from someone else.
  perform ect_test.fails(ect_test.upsert_sql('cheers', ect_test.cheer('cheer-1', stelios, me, '{"seenAt":1}')), 'row-level security',
    'recipient cannot upsert a cheer (must update)');
  perform ect_test.eq(ect_test.affected(
    $q$update public.cheers set data = data || '{"seenAt":4242,"text":"edited","updatedAt":4243}', updated_at = 4243 where id = 'cheer-1'$q$)::text,
    '1', 'recipient updates a cheer addressed to him');
  perform ect_test.eq((select (data->>'seenAt') || '/' || (data->>'text') || '/' || (data->>'updatedAt') || '/' || updated_at
                         from public.cheers where id = 'cheer-1'),
    '4242/Beast mode/4243/4243', 'recipient marks a cheer seen but cannot edit it');
  perform ect_test.eq(ect_test.affected($q$update public.cheers set to_id = from_id where id = 'cheer-1'$q$)::text || '/'
                      || (select to_id::text from public.cheers where id = 'cheer-1'), '1/' || me,
    'recipient cannot re-address a cheer');
  perform ect_test.eq(ect_test.affected($q$delete from public.cheers where id = 'cheer-1'$q$)::text, '0',
    'recipient cannot delete a cheer');

  perform ect_test.eq(ect_test.count($q$select * from storage.objects where bucket_id = 'meal-plans'$q$)::text, '0',
    'athlete cannot see someone else''s files');
  perform ect_test.eq(ect_test.affected($q$delete from storage.objects where bucket_id = 'meal-plans'$q$)::text, '0',
    'athlete cannot delete someone else''s files');
end $$;
reset role;

call ect_test.act('stelios');
set role authenticated;
do $$
declare
  thanos uuid := ect_test.m('thanos');
begin
  perform ect_test.eq(ect_test.count('select * from public.weights where member_id = ' || quote_literal(thanos))::text, '0',
    'private weights are hidden from squad mates');
  perform ect_test.eq(ect_test.count('select * from public.cheers')::text, '1', 'squad sees cheers');
  perform ect_test.eq(ect_test.count('select * from public.meal_plans')::text, '1', 'squad sees meal plans (for adherence)');
  perform ect_test.eq(ect_test.affected($q$update storage.objects set name = name where bucket_id = 'meal-plans'$q$)::text, '1',
    'athlete can update own files');
end $$;
reset role;

-- ============================================================================================ coach

call ect_test.act('dennis');
set role authenticated;
do $$
declare
  me uuid := ect_test.m('dennis');
  stelios uuid := ect_test.m('stelios');
  thanos uuid := ect_test.m('thanos');
  v_code text;
  v_new uuid;
  m public.members;
begin
  perform ect_test.eq(ect_test.count('select * from public.weights where member_id = ' || quote_literal(thanos))::text, '1',
    'coach sees private weights');
  perform ect_test.eq(ect_test.count('select * from public.member_invites')::text, '3', 'coach reads invites');
  perform ect_test.eq(ect_test.affected(format($q$update public.member_invites set code = 'KLMNPQ' where member_id = %L$q$, stelios))::text,
    '1', 'coach can set an invite code');

  perform ect_test.eq(ect_test.affected(format(
    $q$update public.members set data = data || '{"coachNote":"Great week","coachNoteAt":111,"competes":false,"programStart":"2026-09-07"}'::jsonb
       where id = %L$q$, stelios))::text, '1', 'coach edits an athlete');
  m := ect_test.member_raw('stelios');
  perform ect_test.eq((m.data->>'coachNote') || '/' || (m.data->>'coachNoteAt') || '/' || (m.data->>'competes') || '/' || (m.data->>'programStart'),
    'Great week/111/false/2026-09-07', 'coach sets coachNote, competes and program start');
  perform ect_test.eq(ect_test.affected(format($q$update public.members set role = 'coach', user_id = null where id = %L$q$, stelios))::text,
    '1', 'coach changes a role');
  m := ect_test.member_raw('stelios');
  perform ect_test.eq(m.role || '/' || (m.user_id is not null), 'coach/true', 'coach can change roles but not logins');
  perform ect_test.eq(ect_test.affected(format($q$update public.members set role = 'athlete' where id = %L$q$, stelios))::text, '1',
    'coach changes the role back');

  perform ect_test.upsert('programs', jsonb_build_object('id', 'custom-1', 'created_by', me,
    'data', '{"id":"custom-1","name":"Deload","weeks":[],"builtIn":false}'::jsonb, 'updated_at', 1));
  perform ect_test.upsert('workout_logs', ect_test.owned(stelios || '__bts-12__w1d1', stelios));
  perform ect_test.upsert('meal_plans', ect_test.owned('plan-thanos', thanos, null, '{"title":"Cut","meals":[]}'));
  perform ect_test.pass('coach writes programs, logs and meal plans for others');

  perform ect_test.eq(ect_test.count($q$select * from storage.objects where bucket_id = 'meal-plans'$q$)::text, '1',
    'coach sees everyone''s files');
  insert into storage.objects (bucket_id, name) values ('meal-plans', thanos || '/diet.pdf');
  perform ect_test.pass('coach uploads into an athlete''s folder');

  perform ect_test.eq(ect_test.affected($q$update public.cheers set data = data || '{"text":"x"}' where id = 'cheer-1'$q$)::text, '0',
    'coach cannot edit cheers between others');
  perform ect_test.eq(ect_test.affected($q$delete from public.cheers where id = 'cheer-1'$q$)::text, '0',
    'coach cannot delete cheers between others');

  v_new := public.create_member(' Eleni ', 'Eleni', 'athlete', 'green');
  m := ect_test.member_raw('eleni');
  perform ect_test.eq(m.id::text, v_new::text, 'coach creates a member');
  perform ect_test.eq(m.role || '/' || (m.data->>'name') || '/' || (m.data->>'color') || '/' || (m.data->>'competes') || '/'
                      || (m.data->>'programId') || '/' || coalesce(m.data->>'programStart', 'null') || '/'
                      || (m.data->'settings')::text,
    'athlete/Eleni/green/true/bts-12/null/{"unit": "kg", "machines": {}, "weightVisibility": "exact"}',
    'new member gets default profile data');
  perform ect_test.eq((ect_test.invite('eleni') ~ '^[A-Z2-9]{12}$')::text, 'true', 'new member gets an invite');
  perform ect_test.fails($q$select public.create_member('eleni', 'Eleni', 'athlete', 'green')$q$, 'slug_taken', 'member handles are unique');
  perform ect_test.fails($q$select public.create_member('E', 'E', 'athlete', 'green')$q$, 'invalid_slug', 'member handles are validated');
  perform ect_test.fails($q$select public.create_member('ok-slug', 'X', 'admin', 'green')$q$, 'invalid_role', 'roles are validated');
  perform ect_test.eq(ect_test.affected(format('delete from public.members where id = %L', v_new))::text, '1', 'coach removes a member');
  perform ect_test.eq(ect_test.count('select * from public.member_invites where member_id = ' || quote_literal(v_new))::text, '0',
    'removing a member removes the invite');

  v_code := public.reset_invite(thanos, false);
  perform ect_test.eq(v_code, ect_test.invite('thanos'), 'reset_invite issues a new code');
  perform ect_test.eq((ect_test.member_raw('thanos')).user_id::text, '00000000-0000-4000-8000-0000000000a2',
    'reset without detach keeps the login');
  v_code := public.reset_invite(thanos, true);
  perform ect_test.eq(v_code || '/' || coalesce((ect_test.member_raw('thanos')).user_id::text, 'null') || '/'
                      || coalesce((ect_test.member_raw('thanos')).login_email, 'null'),
    ect_test.invite('thanos') || '/null/null', 'reset_invite with detach unlinks the login');
  perform ect_test.eq((select joined::text from public.login_profiles() where slug = 'thanos'), 'false', 'detached member shows as not joined');
  perform ect_test.fails(format('select public.reset_invite(%L, false)', gen_random_uuid()), 'not_found', 'reset_invite: unknown member');
end $$;
reset role;

-- ============================================================================================ re-join

call ect_test.act('thanos');
set role authenticated;
do $$
begin
  perform ect_test.eq(ect_test.count('select * from public.members')::text, '0', 'a detached login loses access');
  perform ect_test.fails(ect_test.upsert_sql('weights', ect_test.owned(ect_test.m('thanos') || '__2026-09-05', ect_test.m('thanos'), '2026-09-05')),
    'row-level security', 'a detached login cannot write');
end $$;
reset role;

call ect_test.act('thanos2');
set role authenticated;
do $$
declare
  me uuid;
begin
  me := public.claim_invite('thanos', ect_test.invite('thanos'));
  perform ect_test.eq(me::text, ect_test.m('thanos')::text, 'the new login re-joins with the new code');
  perform ect_test.eq(ect_test.count('select * from public.weights where member_id = ' || quote_literal(me))::text, '1',
    'the re-joined member keeps their history');
end $$;
reset role;

-- ============================================================================================ sync

-- Profiles are merged field by field: the coach and the athlete editing at the same time keep both edits.
call ect_test.act('dennis');
set role authenticated;
do $$
declare
  stelios uuid := ect_test.m('stelios');
  m public.members;
  v_at bigint := (ect_test.member_raw('stelios')).updated_at;
begin
  m := public.patch_member(stelios, '{"programStart":"2026-09-23","goal":"Lose 5 kg"}'::jsonb, v_at + 10);
  perform ect_test.eq((m.data->>'programStart') || '/' || (m.data->>'goal') || '/' || (m.updated_at = v_at + 10),
    '2026-09-23/Lose 5 kg/true', 'patch_member: coach sets a start date and a goal, gets the stored profile back');
end $$;
reset role;

call ect_test.act('stelios');
set role authenticated;
do $$
declare
  me uuid := ect_test.m('stelios');
  thanos uuid := ect_test.m('thanos');
  m public.members;
  v_at bigint := (ect_test.member_raw('stelios')).updated_at;
begin
  -- a queued edit from before the coach's change, stamped earlier
  m := public.patch_member(me, '{"settings":{"machines":{"Leg Press":"Technogym"}}}'::jsonb, v_at - 5);
  perform ect_test.eq((m.data->>'programStart') || '/' || (m.data->>'goal') || '/' || (m.data->'settings'->'machines'->>'Leg Press')
                      || '/' || (m.data->'settings'->>'unit') || '/' || (m.data->'settings'->>'weightVisibility')
                      || '/' || (m.updated_at = v_at + 1),
    '2026-09-23/Lose 5 kg/Technogym/lb/exact/true', 'patch_member: an older athlete edit keeps the coach''s fields and other settings');
  m := public.patch_member(me, '{"coachNote":"I am great","competes":false,"name":"Stelios"}'::jsonb, v_at + 100);
  perform ect_test.eq((m.data->>'coachNote') || '/' || (m.data->>'competes') || '/' || (m.data->>'name'), 'Great week/false/Stelios',
    'patch_member: coach-owned fields stay protected');
  perform ect_test.eq((select count(*) from public.patch_member(thanos, '{"name":"Hacked"}'::jsonb, v_at + 200))::text, '0',
    'patch_member: nobody else''s profile');
  perform ect_test.eq((ect_test.member_raw('thanos')).data->>'name', 'Thanos', 'patch_member: the other profile is untouched');

  -- whole-row tables: last writer wins on updated_at
  perform ect_test.upsert('workout_logs',
    ect_test.owned(me || '__sync', me, null, '{"note":"new"}') || '{"updated_at":5000}'::jsonb);
  perform ect_test.upsert('workout_logs',
    ect_test.owned(me || '__sync', me, null, '{"note":"stale"}') || '{"updated_at":4000}'::jsonb);
  perform ect_test.eq((select (data->>'note') || '/' || updated_at from public.workout_logs where id = me || '__sync'), 'new/5000',
    'last writer wins: an older write does not replace a newer row');
  perform ect_test.upsert('workout_logs',
    ect_test.owned(me || '__sync', me, null, '{"note":"newer"}') || '{"updated_at":6000}'::jsonb);
  perform ect_test.eq((select (data->>'note') || '/' || updated_at from public.workout_logs where id = me || '__sync'), 'newer/6000',
    'last writer wins: a newer write replaces it');
end $$;
reset role;

-- ============================================================================================ trusted admin

-- The SQL editor (no user JWT) may fix anything, e.g. promote a member.
call ect_test.act(null);
do $$
begin
  update public.members set role = 'coach' where slug = 'thanos';
  perform ect_test.eq((ect_test.member_raw('thanos')).role, 'coach', 'SQL editor can change roles');
  update public.members set role = 'athlete' where slug = 'thanos';
end $$;
