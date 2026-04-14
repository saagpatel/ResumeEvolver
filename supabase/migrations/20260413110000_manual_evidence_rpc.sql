create or replace function public.save_manual_evidence(
  evidence_id uuid default null,
  input_type public.evidence_type default null,
  input_title text default null,
  input_raw_input text default null,
  input_project_name text default null,
  input_time_start timestamptz default null,
  input_time_end timestamptz default null,
  input_links jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_evidence_id uuid;
  existing_evidence public.evidence_items%rowtype;
  link_payload jsonb;
  has_cert_or_external boolean := false;
  has_project_link boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if input_type is null or input_title is null or input_raw_input is null then
    raise exception 'Manual evidence requires type, title, and raw input.'
      using errcode = '22023';
  end if;

  if input_type not in ('manual_note', 'certification', 'project_link', 'milestone') then
    raise exception 'Milestone 2 only accepts manual evidence types.'
      using errcode = '22023';
  end if;

  if input_time_end is not null
    and input_time_start is not null
    and input_time_end < input_time_start then
    raise exception 'End time cannot be before start time.'
      using errcode = '22023';
  end if;

  if input_links is null then
    input_links := '[]'::jsonb;
  end if;

  if jsonb_typeof(input_links) <> 'array' then
    raise exception 'Links payload must be a JSON array.'
      using errcode = '22023';
  end if;

  for link_payload in
    select value
    from jsonb_array_elements(input_links)
  loop
    if jsonb_typeof(link_payload) <> 'object' then
      raise exception 'Each link payload must be an object.'
        using errcode = '22023';
    end if;

    has_cert_or_external := has_cert_or_external
      or (link_payload ->> 'linkType') in ('cert', 'external');
    has_project_link := has_project_link
      or (link_payload ->> 'linkType') in ('project', 'external', 'github');
  end loop;

  if input_type = 'certification' and not has_cert_or_external then
    raise exception 'Certification evidence needs at least one cert or external link.'
      using errcode = '22023';
  end if;

  if input_type = 'project_link' and not has_project_link then
    raise exception 'Project-link evidence needs at least one project, external, or GitHub link.'
      using errcode = '22023';
  end if;

  if evidence_id is null then
    insert into public.evidence_items (
      user_id,
      type,
      title,
      raw_input,
      time_start,
      time_end,
      source_system,
      project_name,
      visibility_default
    )
    values (
      current_user_id,
      input_type,
      input_title,
      input_raw_input,
      input_time_start,
      input_time_end,
      'manual',
      input_project_name,
      'private'
    )
    returning id into target_evidence_id;

  else
    select *
    into existing_evidence
    from public.evidence_items
    where id = evidence_id
      and user_id = current_user_id
    for update;

    if not found then
      raise exception 'Evidence item not found.'
        using errcode = 'P0002';
    end if;

    if existing_evidence.source_system <> 'manual' then
      raise exception 'Only manual evidence can be saved here.'
        using errcode = '22023';
    end if;

    if not public.is_valid_evidence_state(
      existing_evidence.verification_status,
      existing_evidence.approval_status
    ) then
      raise exception 'Evidence item is in an invalid state.'
        using errcode = '22023';
    end if;

    if not (
      (existing_evidence.verification_status = 'unreviewed' and existing_evidence.approval_status = 'draft')
      or (existing_evidence.verification_status = 'structured' and existing_evidence.approval_status = 'draft')
      or (existing_evidence.verification_status = 'structured' and existing_evidence.approval_status = 'needs_more_proof')
    ) then
      raise exception 'Approved or rejected evidence is read-only in Milestone 2.'
        using errcode = '22023';
    end if;

    update public.evidence_items
    set
      type = input_type,
      title = input_title,
      raw_input = input_raw_input,
      project_name = input_project_name,
      time_start = input_time_start,
      time_end = input_time_end
    where id = evidence_id;

    target_evidence_id := evidence_id;
  end if;

  if input_links is not null then
    delete from public.evidence_links
    where evidence_item_id = target_evidence_id;

    for link_payload in
      select value
      from jsonb_array_elements(input_links)
    loop
      insert into public.evidence_links (
        evidence_item_id,
        label,
        url,
        link_type
      )
      values (
        target_evidence_id,
        link_payload ->> 'label',
        link_payload ->> 'url',
        (link_payload ->> 'linkType')::public.link_type
      );
    end loop;
  end if;

  return target_evidence_id;
end;
$$;

grant execute on function public.save_manual_evidence(
  uuid,
  public.evidence_type,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) to authenticated;
