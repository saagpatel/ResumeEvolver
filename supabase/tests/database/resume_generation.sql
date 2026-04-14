begin;
select plan(8);

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
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'resume-owner@example.com',
    crypt('password', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Resume Owner"}'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'resume-other@example.com',
    crypt('password', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Resume Other"}'
  );

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.role_variants (
  id,
  user_id,
  name
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Platform Engineer'
);

insert into public.evidence_items (
  id,
  user_id,
  type,
  title,
  raw_input,
  source_system,
  proof_strength,
  verification_status,
  approval_status
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'manual_note',
    'Approved evidence',
    'Approved evidence body',
    'manual',
    'strong',
    'approved',
    'approved_private'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'manual_note',
    'Unapproved evidence',
    'Unapproved evidence body',
    'manual',
    'weak',
    'structured',
    'draft'
  );

select ok(
  exists (
    select 1
    from public.resume_bullets
    where approval_status = 'draft'
  ) is not true,
  'resume bullets table starts empty'
);

select lives_ok(
  $$
    select public.replace_generated_resume_bullets(
      '10000000-0000-0000-0000-000000000001',
      '{"source":"ai","prompt_version":"resume-generate.v1","model":"test","role_variant_id":"10000000-0000-0000-0000-000000000001","selected_evidence_ids":["20000000-0000-0000-0000-000000000001"],"generated_at":"2026-04-14T00:00:00.000Z"}'::jsonb,
      '[{"draftText":"Built reliable release workflows.","claimType":"fact_backed","proofStrength":"strong","supportingEvidenceIds":["20000000-0000-0000-0000-000000000001"]}]'::jsonb
    );
  $$,
  'replace_generated_resume_bullets accepts approved evidence'
);

select is(
  (
    select count(*)
    from public.resume_bullets
    where role_variant_id = '10000000-0000-0000-0000-000000000001'
  )::int,
  1,
  'resume bullet row is inserted'
);

select is(
  (
    select count(*)
    from public.resume_bullet_evidence
    where evidence_item_id = '20000000-0000-0000-0000-000000000001'
  )::int,
  1,
  'resume bullet evidence link is inserted'
);

insert into public.resume_bullets (
  id,
  user_id,
  role_variant_id,
  draft_text,
  claim_type,
  proof_strength,
  approval_status,
  is_user_edited
)
values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Edited bullet survives.',
  'fact_backed',
  'strong',
  'approved_private',
  true
);

select lives_ok(
  $$
    select public.replace_generated_resume_bullets(
      '10000000-0000-0000-0000-000000000001',
      '{"source":"ai","prompt_version":"resume-generate.v1","model":"test","role_variant_id":"10000000-0000-0000-0000-000000000001","selected_evidence_ids":["20000000-0000-0000-0000-000000000001"],"generated_at":"2026-04-14T00:00:00.000Z"}'::jsonb,
      '[{"draftText":"Fresh model bullet.","claimType":"fact_backed","proofStrength":"strong","supportingEvidenceIds":["20000000-0000-0000-0000-000000000001"]}]'::jsonb
    );
  $$,
  'rerun replaces untouched generated bullets'
);

select ok(
  exists (
    select 1
    from public.resume_bullets
    where id = '30000000-0000-0000-0000-000000000001'
      and is_user_edited = true
  ),
  'user edited bullets are preserved'
);

select throws_ok(
  $$
    select public.replace_generated_resume_bullets(
      '10000000-0000-0000-0000-000000000001',
      '{"source":"ai"}'::jsonb,
      '[{"draftText":"Bad bullet.","claimType":"fact_backed","proofStrength":"weak","supportingEvidenceIds":["20000000-0000-0000-0000-000000000002"]}]'::jsonb
    );
  $$,
  '22023',
  'Generated resume bullets referenced invalid evidence.',
  'function rejects unapproved evidence'
);

select throws_ok(
  $$
    insert into public.resume_bullets (
      user_id,
      role_variant_id,
      draft_text,
      claim_type,
      proof_strength,
      approval_status
    )
    values (
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'Invalid status bullet',
      'fact_backed',
      'strong',
      'needs_more_proof'
    );
  $$,
  '23514',
  null,
  'resume bullets reject unsupported approval states'
);

select * from finish();
rollback;
