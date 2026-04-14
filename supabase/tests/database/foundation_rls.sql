begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, extensions;

select plan(16);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'evidence_items', 'evidence_items table exists');
select has_table('public', 'role_variants', 'role_variants table exists');
select has_table('public', 'resume_bullets', 'resume_bullets table exists');
select has_table('public', 'changelog_entries', 'changelog_entries table exists');
select has_table('public', 'exports', 'exports table exists');

select ok(
  exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and c.relrowsecurity
  ),
  'profiles has row-level security enabled'
);

select ok(
  exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'evidence_items'
      and c.relrowsecurity
  ),
  'evidence_items has row-level security enabled'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'owner@example.com',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Owner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'authenticated',
    'authenticated',
    'other@example.com',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Other"}',
    now(),
    now()
  );

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000202'
    )
  ),
  2,
  'auth user trigger creates profile rows'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000202'
    )
      and github_connected = false
  ),
  2,
  'profiles default github_connected to false'
);

insert into public.evidence_items (
  user_id,
  type,
  title,
  raw_input,
  source_system
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'manual_note',
    'Owner evidence',
    'Captured by owner',
    'manual'
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'manual_note',
    'Other evidence',
    'Captured by other',
    'manual'
  );

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'authenticated user sees only their own profile'
);

select is(
  (select count(*)::integer from public.evidence_items),
  1,
  'authenticated user sees only their own evidence'
);

select lives_ok(
  $$
    insert into public.evidence_items (
      user_id,
      type,
      title,
      raw_input,
      source_system
    )
    values (
      '00000000-0000-0000-0000-000000000101',
      'manual_note',
      'Owner follow-up',
      'Still owned by the same user',
      'manual'
    );
  $$,
  'authenticated user can insert their own evidence'
);

select is(
  (select count(*)::integer from public.evidence_items),
  2,
  'authenticated user can only see their own evidence rows after insert'
);

select throws_ok(
  $$
    insert into public.evidence_items (
      user_id,
      type,
      title,
      raw_input,
      source_system
    )
    values (
      '00000000-0000-0000-0000-000000000202',
      'manual_note',
      'Cross-user insert',
      'This should be rejected',
      'manual'
    );
  $$,
  '42501',
  null,
  'authenticated user cannot insert evidence for another user'
);

reset role;
set local role anon;

select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.evidence_items),
  0,
  'anonymous role cannot read evidence rows'
);

select * from finish();
rollback;
