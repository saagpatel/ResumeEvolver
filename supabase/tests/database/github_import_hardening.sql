begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, extensions;

select plan(5);

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
values (
  '00000000-0000-0000-0000-000000000501',
  'authenticated',
  'authenticated',
  'github-import-owner@example.com',
  '{"provider":"github","providers":["github"]}',
  '{"display_name":"GitHub Import Owner"}',
  now(),
  now()
);

select lives_ok(
  $$
    insert into public.evidence_items (
      user_id,
      type,
      title,
      raw_input,
      source_system,
      source_external_id,
      source_url
    )
    values (
      '00000000-0000-0000-0000-000000000501',
      'github_pr',
      'Imported GitHub pull request',
      'Normalized pull request body',
      'github',
      '12345',
      'https://github.com/example/repo/pull/12345'
    );
  $$,
  'github evidence accepts safe https source URLs'
);

select throws_ok(
  $$
    insert into public.evidence_items (
      user_id,
      type,
      title,
      raw_input,
      source_system,
      source_external_id,
      source_url
    )
    values (
      '00000000-0000-0000-0000-000000000501',
      'github_issue',
      'Unsafe source url issue',
      'Should fail',
      'github',
      '12346',
      'javascript:alert(1)'
    );
  $$,
  '23514',
  null,
  'github evidence rejects unsafe source URLs at the database boundary'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}',
  true
);

select is(
  (
    select verification_status
    from public.evidence_items
    where source_external_id = '12345'
  ),
  'unreviewed'::public.verification_status,
  'imported GitHub evidence defaults to unreviewed'
);

select is(
  (
    select approval_status
    from public.evidence_items
    where source_external_id = '12345'
  ),
  'draft'::public.approval_status,
  'imported GitHub evidence defaults to draft'
);

select is(
  (select count(*)::integer from public.evidence_items),
  1,
  'only the valid imported GitHub row persists'
);

select * from finish();
rollback;
