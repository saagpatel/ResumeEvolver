begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, auth, extensions;

select plan(8);

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
    'ledger-owner@example.com',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Ledger Owner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'authenticated',
    'authenticated',
    'ledger-other@example.com',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Ledger Other"}',
    now(),
    now()
  );

insert into public.evidence_items (
  id,
  user_id,
  type,
  title,
  raw_input,
  source_system
)
values
  (
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000301',
    'manual_note',
    'Ledger owner evidence',
    'Owner evidence body',
    'manual'
  ),
  (
    '00000000-0000-0000-0000-000000000312',
    '00000000-0000-0000-0000-000000000302',
    'manual_note',
    'Ledger other evidence',
    'Other evidence body',
    'manual'
  );

insert into public.evidence_links (
  evidence_item_id,
  label,
  url,
  link_type
)
values
  (
    '00000000-0000-0000-0000-000000000311',
    'Owner proof',
    'https://example.com/owner-proof',
    'external'
  ),
  (
    '00000000-0000-0000-0000-000000000312',
    'Other proof',
    'https://example.com/other-proof',
    'external'
  );

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.evidence_links),
  1,
  'authenticated owner sees only links attached to owned evidence'
);

select is(
  (
    select count(*)::integer
    from public.evidence_items
    join public.evidence_links
      on public.evidence_links.evidence_item_id = public.evidence_items.id
  ),
  1,
  'owner can only read joined evidence-with-links rows for owned evidence'
);

select lives_ok(
  $$
    insert into public.evidence_links (
      evidence_item_id,
      label,
      url,
      link_type
    )
    values (
      '00000000-0000-0000-0000-000000000311',
      'Valid https link',
      'https://example.com/another-proof',
      'external'
    );
  $$,
  'owner can still insert valid https links for owned evidence'
);

select is(
  (select count(*)::integer from public.evidence_links),
  2,
  'valid https link insert is visible to the owner'
);

select throws_ok(
  $$
    insert into public.evidence_links (
      evidence_item_id,
      label,
      url,
      link_type
    )
    values (
      '00000000-0000-0000-0000-000000000311',
      'Unsafe link',
      'ftp://example.com/not-allowed',
      'external'
    );
  $$,
  '23514',
  null,
  'unsafe link schemes are rejected by the database'
);

select lives_ok(
  $$
    delete from public.evidence_items
    where id = '00000000-0000-0000-0000-000000000311';
  $$,
  'delete attempts no longer error even though no owner delete policy exists'
);

select is(
  (
    select count(*)::integer
    from public.evidence_items
    where id = '00000000-0000-0000-0000-000000000311'
  ),
  1,
  'owner delete attempt does not remove the evidence record'
);

reset role;
set local role anon;

select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.evidence_links),
  0,
  'anonymous role cannot read evidence links'
);

select * from finish();
rollback;
