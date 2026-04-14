begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, extensions;

select plan(7);

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
    '00000000-0000-0000-0000-000000000021',
    'authenticated',
    'authenticated',
    'exports-owner@example.com',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Exports Owner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    'authenticated',
    'authenticated',
    'exports-other@example.com',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Exports Other"}',
    now(),
    now()
  );

insert into public.exports (
  id,
  user_id,
  target_type,
  target_id,
  format,
  content
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000021',
    'resume_bullets',
    '10000000-0000-0000-0000-000000000001',
    'json',
    '{"targetType":"resume_bullets","roleVariantId":"10000000-0000-0000-0000-000000000001","bulletCount":1}'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000022',
    'evidence_snapshot',
    null,
    'json',
    '{"targetType":"evidence_snapshot","evidenceCount":1}'
  );

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000021","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.exports),
  1,
  'authenticated owner sees only their own export rows'
);

select is(
  (
    select count(*)::integer
    from public.exports
    where user_id = '00000000-0000-0000-0000-000000000021'
  ),
  1,
  'owner export history starts with one visible saved row'
);

select lives_ok(
  $$
    insert into public.exports (
      user_id,
      target_type,
      target_id,
      format,
      content
    )
    values (
      '00000000-0000-0000-0000-000000000021',
      'evidence_snapshot',
      null,
      'json',
      '{"targetType":"evidence_snapshot","evidenceCount":2}'
    );
  $$,
  'authenticated owner can insert their own export rows'
);

select is(
  (
    select count(*)::integer
    from public.exports
    where user_id = '00000000-0000-0000-0000-000000000021'
  ),
  2,
  'owner sees saved export history grow after insert'
);

select throws_ok(
  $$
    insert into public.exports (
      user_id,
      target_type,
      target_id,
      format,
      content
    )
    values (
      '00000000-0000-0000-0000-000000000022',
      'resume_bullets',
      '10000000-0000-0000-0000-000000000001',
      'markdown',
      '# blocked'
    );
  $$,
  '42501',
  null,
  'authenticated owner cannot insert export rows for another user'
);

select throws_ok(
  $$
    insert into public.exports (
      user_id,
      target_type,
      target_id,
      format,
      content
    )
    values (
      '00000000-0000-0000-0000-000000000021',
      'evidence_snapshot',
      '10000000-0000-0000-0000-000000000001',
      'json',
      '{}'
    );
  $$,
  '23514',
  null,
  'evidence snapshots reject non-null target ids'
);

reset role;
set local role anon;

select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.exports),
  0,
  'anonymous role cannot read export history'
);

select * from finish();
rollback;
