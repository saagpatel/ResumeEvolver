begin;
select plan(10);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'changelog-owner@example.com',
    crypt('password', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Changelog Owner"}'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'changelog-other@example.com',
    crypt('password', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Changelog Other"}'
  );

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.evidence_items (
  id,
  user_id,
  type,
  title,
  raw_input,
  source_system,
  proof_strength,
  verification_status,
  approval_status,
  time_start,
  time_end
)
values
  (
    '21000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'manual_note',
    'Approved April evidence',
    'Approved April evidence body',
    'manual',
    'strong',
    'approved',
    'approved_private',
    '2026-04-10T16:00:00.000Z',
    '2026-04-10T17:00:00.000Z'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000011',
    'manual_note',
    'Public-safe April evidence',
    'Public-safe April evidence body',
    'manual',
    'strong',
    'approved',
    'approved_public_safe',
    '2026-04-12T16:00:00.000Z',
    '2026-04-12T17:00:00.000Z'
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000011',
    'manual_note',
    'Unapproved April evidence',
    'Unapproved April evidence body',
    'manual',
    'weak',
    'structured',
    'draft',
    '2026-04-15T16:00:00.000Z',
    '2026-04-15T17:00:00.000Z'
  ),
  (
    '21000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000011',
    'manual_note',
    'Approved May evidence',
    'Approved May evidence body',
    'manual',
    'moderate',
    'approved',
    'approved_private',
    '2026-05-02T16:00:00.000Z',
    '2026-05-02T17:00:00.000Z'
  );

select lives_ok(
  $$
    select public.upsert_generated_changelog_entry(
      'monthly',
      '2026-04-01',
      '2026-04-30',
      '{"source":"ai","prompt_version":"changelog-generate.v1","model":"test","period_type":"monthly","period_start":"2026-04-01","period_end":"2026-04-30","selected_evidence_ids":["21000000-0000-0000-0000-000000000001"],"generated_at":"2026-04-14T00:00:00.000Z"}'::jsonb,
      'April changelog',
      '## Highlights\n- Shipped approved work.',
      array['21000000-0000-0000-0000-000000000001']::uuid[],
      false
    );
  $$,
  'upsert_generated_changelog_entry accepts approved in-period evidence'
);

select is(
  (
    select count(*)
    from public.changelog_entries
    where period_type = 'monthly'
      and period_start = '2026-04-01'
      and period_end = '2026-04-30'
  )::int,
  1,
  'one changelog draft row is inserted for the period'
);

select is(
  (
    select count(*)
    from public.changelog_entry_evidence
    where evidence_item_id = '21000000-0000-0000-0000-000000000001'
  )::int,
  1,
  'changelog provenance link is inserted'
);

update public.changelog_entries
set title = 'Edited April changelog',
    is_user_edited = true
where period_type = 'monthly'
  and period_start = '2026-04-01'
  and period_end = '2026-04-30';

select throws_ok(
  $$
    select public.upsert_generated_changelog_entry(
      'monthly',
      '2026-04-01',
      '2026-04-30',
      '{"source":"ai","prompt_version":"changelog-generate.v1","model":"test","period_type":"monthly","period_start":"2026-04-01","period_end":"2026-04-30","selected_evidence_ids":["21000000-0000-0000-0000-000000000001"],"generated_at":"2026-04-14T00:00:00.000Z"}'::jsonb,
      'Replacement changelog',
      '## Highlights\n- Replacement draft.',
      array['21000000-0000-0000-0000-000000000001']::uuid[],
      false
    );
  $$,
  'P0001',
  'Edited changelog drafts require explicit replaceEdited.',
  'edited drafts block regeneration by default'
);

select lives_ok(
  $$
    select public.upsert_generated_changelog_entry(
      'monthly',
      '2026-04-01',
      '2026-04-30',
      '{"source":"ai","prompt_version":"changelog-generate.v1","model":"test","period_type":"monthly","period_start":"2026-04-01","period_end":"2026-04-30","selected_evidence_ids":["21000000-0000-0000-0000-000000000002"],"generated_at":"2026-04-14T00:00:00.000Z"}'::jsonb,
      'Replacement changelog',
      '## Highlights\n- Replacement draft.',
      array['21000000-0000-0000-0000-000000000002']::uuid[],
      true
    );
  $$,
  'replaceEdited=true allows regeneration'
);

select ok(
  exists (
    select 1
    from public.changelog_entries
    where period_type = 'monthly'
      and period_start = '2026-04-01'
      and title = 'Replacement changelog'
      and is_user_edited = false
  ),
  'explicit replace resets the edited flag and updates the draft'
);

select throws_ok(
  $$
    select public.upsert_generated_changelog_entry(
      'monthly',
      '2026-04-01',
      '2026-04-30',
      '{"source":"ai"}'::jsonb,
      'Bad changelog',
      '## Highlights\n- Invalid evidence.',
      array['21000000-0000-0000-0000-000000000003']::uuid[],
      false
    );
  $$,
  '22023',
  'Generated changelog drafts referenced invalid approved evidence for the selected period.',
  'function rejects unapproved evidence'
);

select throws_ok(
  $$
    select public.upsert_generated_changelog_entry(
      'monthly',
      '2026-04-01',
      '2026-04-30',
      '{"source":"ai"}'::jsonb,
      'Bad changelog',
      '## Highlights\n- Invalid evidence.',
      array['21000000-0000-0000-0000-000000000004']::uuid[],
      false
    );
  $$,
  '22023',
  'Generated changelog drafts referenced invalid approved evidence for the selected period.',
  'function rejects out-of-period evidence'
);

select throws_ok(
  $$
    insert into public.changelog_entries (
      user_id,
      period_type,
      period_start,
      period_end,
      title,
      body,
      visibility,
      approval_status
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      'monthly',
      '2026-05-01',
      '2026-05-31',
      'Invalid visibility',
      'Body',
      'private',
      'approved_public_safe'
    );
  $$,
  '23514',
  null,
  'visibility must align with the changelog approval state'
);

select throws_ok(
  $$
    insert into public.changelog_entries (
      user_id,
      period_type,
      period_start,
      period_end,
      title,
      body,
      visibility,
      approval_status
    )
    values (
      '00000000-0000-0000-0000-000000000011',
      'monthly',
      '2026-06-01',
      '2026-06-30',
      'Invalid approval state',
      'Body',
      'private',
      'needs_more_proof'
    );
  $$,
  '23514',
  null,
  'changelog entries reject unsupported approval states'
);

select * from finish();
rollback;
