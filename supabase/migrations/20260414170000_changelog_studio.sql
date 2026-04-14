do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'changelog_entries_allowed_approval_status'
  ) then
    alter table public.changelog_entries
      add constraint changelog_entries_allowed_approval_status
      check (
        approval_status in (
          'draft',
          'approved_private',
          'approved_public_safe',
          'do_not_use'
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'changelog_entries_visibility_matches_approval_status'
  ) then
    alter table public.changelog_entries
      add constraint changelog_entries_visibility_matches_approval_status
      check (
        (
          approval_status = 'approved_public_safe'
          and visibility = 'public_safe'
        )
        or (
          approval_status in ('draft', 'approved_private', 'do_not_use')
          and visibility = 'private'
        )
      );
  end if;
end
$$;

create unique index if not exists changelog_entries_user_period_unique_idx
  on public.changelog_entries (user_id, period_type, period_start, period_end);

create or replace function public.upsert_generated_changelog_entry(
  input_period_type public.period_type,
  input_period_start date,
  input_period_end date,
  input_generation_metadata jsonb,
  input_title text,
  input_body text,
  input_evidence_ids uuid[],
  input_replace_edited boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_entry_id uuid;
  existing_entry_is_user_edited boolean := false;
  entry_id uuid;
  selected_evidence_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if input_generation_metadata is null
    or jsonb_typeof(input_generation_metadata) <> 'object' then
    raise exception 'Changelog generation metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  if coalesce(nullif(btrim(input_title), ''), '') = '' then
    raise exception 'Generated changelog drafts need a title.'
      using errcode = '22023';
  end if;

  if coalesce(nullif(btrim(input_body), ''), '') = '' then
    raise exception 'Generated changelog drafts need a body.'
      using errcode = '22023';
  end if;

  if input_period_end < input_period_start then
    raise exception 'Changelog period end must not come before the period start.'
      using errcode = '22023';
  end if;

  if input_evidence_ids is null or cardinality(input_evidence_ids) = 0 then
    raise exception 'Generated changelog drafts need at least one approved evidence id.'
      using errcode = '22023';
  end if;

  select id, is_user_edited
  into existing_entry_id, existing_entry_is_user_edited
  from public.changelog_entries
  where user_id = current_user_id
    and period_type = input_period_type
    and period_start = input_period_start
    and period_end = input_period_end
  limit 1;

  if existing_entry_id is not null
    and existing_entry_is_user_edited
    and not input_replace_edited then
    raise exception 'Edited changelog drafts require explicit replaceEdited.'
      using errcode = 'P0001';
  end if;

  for selected_evidence_id in
    select distinct unnest(input_evidence_ids)
  loop
    if not exists (
      select 1
      from public.evidence_items
      where id = selected_evidence_id
        and user_id = current_user_id
        and verification_status = 'approved'
        and approval_status in ('approved_private', 'approved_public_safe')
        and coalesce(
          (time_end at time zone 'utc')::date,
          (time_start at time zone 'utc')::date,
          (created_at at time zone 'utc')::date
        ) between input_period_start and input_period_end
    ) then
      raise exception 'Generated changelog drafts referenced invalid approved evidence for the selected period.'
        using errcode = '22023';
    end if;
  end loop;

  insert into public.changelog_entries (
    user_id,
    period_type,
    period_start,
    period_end,
    title,
    body,
    visibility,
    approval_status,
    is_user_edited,
    generation_metadata
  )
  values (
    current_user_id,
    input_period_type,
    input_period_start,
    input_period_end,
    input_title,
    input_body,
    'private',
    'draft',
    false,
    input_generation_metadata
  )
  on conflict (user_id, period_type, period_start, period_end)
  do update
    set title = excluded.title,
        body = excluded.body,
        visibility = 'private',
        approval_status = 'draft',
        is_user_edited = false,
        generation_metadata = excluded.generation_metadata,
        updated_at = timezone('utc', now())
  returning id into entry_id;

  delete from public.changelog_entry_evidence
  where changelog_entry_id = entry_id;

  insert into public.changelog_entry_evidence (
    changelog_entry_id,
    evidence_item_id
  )
  select entry_id, distinct_evidence_id
  from (
    select distinct unnest(input_evidence_ids) as distinct_evidence_id
  ) as deduped;

  return entry_id;
end;
$$;

grant execute on function public.upsert_generated_changelog_entry(
  public.period_type,
  date,
  date,
  jsonb,
  text,
  text,
  uuid[],
  boolean
) to authenticated;
