alter table public.resume_bullets
  add constraint resume_bullets_allowed_approval_status
  check (
    approval_status in (
      'draft',
      'approved_private',
      'approved_public_safe',
      'do_not_use'
    )
  );

create or replace function public.replace_generated_resume_bullets(
  input_role_variant_id uuid,
  input_generation_metadata jsonb,
  input_bullets jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_ids uuid[] := '{}';
  bullet_payload jsonb;
  evidence_id_text text;
  inserted_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if input_generation_metadata is null
    or jsonb_typeof(input_generation_metadata) <> 'object' then
    raise exception 'Resume generation metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  if input_bullets is null then
    input_bullets := '[]'::jsonb;
  end if;

  if jsonb_typeof(input_bullets) <> 'array' then
    raise exception 'Generated resume bullets must be a JSON array.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.role_variants
    where id = input_role_variant_id
      and user_id = current_user_id
  ) then
    raise exception 'Role variant not found.'
      using errcode = 'P0002';
  end if;

  delete from public.resume_bullet_evidence
  where resume_bullet_id in (
    select id
    from public.resume_bullets
    where role_variant_id = input_role_variant_id
      and user_id = current_user_id
      and is_user_edited = false
  );

  delete from public.resume_bullets
  where role_variant_id = input_role_variant_id
    and user_id = current_user_id
    and is_user_edited = false;

  for bullet_payload in
    select value
    from jsonb_array_elements(input_bullets)
  loop
    if jsonb_typeof(bullet_payload) <> 'object' then
      raise exception 'Each generated resume bullet must be an object.'
        using errcode = '22023';
    end if;

    if coalesce(nullif(btrim(bullet_payload ->> 'draftText'), ''), '') = '' then
      raise exception 'Generated resume bullets need draft text.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(bullet_payload -> 'supportingEvidenceIds') <> 'array'
      or jsonb_array_length(bullet_payload -> 'supportingEvidenceIds') = 0 then
      raise exception 'Generated resume bullets need supporting evidence ids.'
        using errcode = '22023';
    end if;

    insert into public.resume_bullets (
      user_id,
      role_variant_id,
      draft_text,
      claim_type,
      proof_strength,
      approval_status,
      is_user_edited,
      generation_metadata
    )
    values (
      current_user_id,
      input_role_variant_id,
      bullet_payload ->> 'draftText',
      (bullet_payload ->> 'claimType')::public.claim_type,
      (bullet_payload ->> 'proofStrength')::public.proof_strength,
      'draft',
      false,
      input_generation_metadata || jsonb_build_object(
        'supporting_evidence_ids',
        bullet_payload -> 'supportingEvidenceIds'
      )
    )
    returning id into inserted_id;

    for evidence_id_text in
      select distinct jsonb_array_elements_text(bullet_payload -> 'supportingEvidenceIds')
    loop
      if not exists (
        select 1
        from public.evidence_items
        where id = evidence_id_text::uuid
          and user_id = current_user_id
          and verification_status = 'approved'
          and approval_status in ('approved_private', 'approved_public_safe')
      ) then
        raise exception 'Generated resume bullets referenced invalid evidence.'
          using errcode = '22023';
      end if;

      insert into public.resume_bullet_evidence (
        resume_bullet_id,
        evidence_item_id
      )
      values (
        inserted_id,
        evidence_id_text::uuid
      );
    end loop;

    created_ids := array_append(created_ids, inserted_id);
  end loop;

  return created_ids;
end;
$$;

grant execute on function public.replace_generated_resume_bullets(
  uuid,
  jsonb,
  jsonb
) to authenticated;
