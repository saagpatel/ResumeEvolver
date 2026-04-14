begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, extensions;

select plan(10);

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
    '00000000-0000-0000-0000-000000000301',
    'authenticated',
    'authenticated',
    'rpc-owner@example.com',
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'authenticated',
    'authenticated',
    'rpc-other@example.com',
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.save_manual_evidence(
      null,
      'manual_note',
      'RPC create',
      'Created through the RPC path',
      'ResumeEvolver',
      null,
      null,
      '[{"label":"Project home","url":"https://example.com","linkType":"project"}]'::jsonb
    );
  $$,
  'owner can create manual evidence through the RPC path'
);

select is(
  (
    select count(*)::integer
    from public.evidence_items
    where user_id = '00000000-0000-0000-0000-000000000301'
      and title = 'RPC create'
  ),
  1,
  'rpc create writes an evidence row'
);

select is(
  (
    select count(*)::integer
    from public.evidence_links
    where evidence_item_id = (
      select id
      from public.evidence_items
      where user_id = '00000000-0000-0000-0000-000000000301'
        and title = 'RPC create'
      limit 1
    )
  ),
  1,
  'rpc create writes linked evidence rows atomically'
);

select throws_ok(
  $$
    select public.save_manual_evidence(
      null,
      'manual_note',
      'Bad range',
      'This should fail',
      null,
      '2026-04-13T12:00:00Z'::timestamptz,
      '2026-04-13T11:00:00Z'::timestamptz,
      '[]'::jsonb
    );
  $$,
  '22023',
  null,
  'rpc rejects invalid time ranges'
);

select throws_ok(
  $$
    select public.save_manual_evidence(
      null,
      'github_pr',
      'Wrong type',
      'This should fail',
      null,
      null,
      null,
      '[]'::jsonb
    );
  $$,
  '22023',
  null,
  'rpc rejects non-manual evidence types'
);

select throws_ok(
  $$
    select public.save_manual_evidence(
      null,
      'certification',
      'Missing cert link',
      'This should fail',
      null,
      null,
      null,
      '[{"label":"Repo","url":"https://example.com","linkType":"github"}]'::jsonb
    );
  $$,
  '22023',
  null,
  'rpc enforces certification link requirements'
);

select lives_ok(
  $$
    select public.save_manual_evidence(
      (
        select id
        from public.evidence_items
        where user_id = '00000000-0000-0000-0000-000000000301'
          and title = 'RPC create'
        limit 1
      ),
      'manual_note',
      'RPC update',
      'Still editable before approval',
      'ResumeEvolver',
      null,
      null,
      '[{"label":"Updated project","url":"https://example.com/updated","linkType":"project"}]'::jsonb
    );
  $$,
  'rpc allows owner updates while evidence is still editable'
);

select is(
  (
    select title
    from public.evidence_items
    where user_id = '00000000-0000-0000-0000-000000000301'
      and title = 'RPC update'
    limit 1
  ),
  'RPC update',
  'rpc update changes the evidence row before approval'
);

update public.evidence_items
set
  verification_status = 'approved',
  approval_status = 'approved_private'
where user_id = '00000000-0000-0000-0000-000000000301'
  and title = 'RPC update';

create temporary table temp_manual_evidence_context (
  owner_evidence_id uuid not null
) on commit drop;

insert into temp_manual_evidence_context (owner_evidence_id)
select id
from public.evidence_items
where user_id = '00000000-0000-0000-0000-000000000301'
  and title = 'RPC update'
limit 1;

select throws_ok(
  $$
    select public.save_manual_evidence(
      (select owner_evidence_id from temp_manual_evidence_context limit 1),
      'manual_note',
      'Read-only edit',
      'This should fail',
      null,
      null,
      null,
      '[]'::jsonb
    );
  $$,
  '22023',
  null,
  'rpc rejects updates once the evidence item becomes approved and read-only'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000302","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.save_manual_evidence(
      (select owner_evidence_id from temp_manual_evidence_context limit 1),
      'manual_note',
      'Cross-user overwrite',
      'This should fail',
      null,
      null,
      null,
      '[]'::jsonb
    );
  $$,
  'P0002',
  null,
  'rpc blocks cross-user edits'
);

select * from finish();
rollback;
