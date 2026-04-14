create extension if not exists pgcrypto with schema extensions;

create type public.evidence_type as enum (
  'manual_note',
  'github_pr',
  'github_issue',
  'github_release',
  'certification',
  'project_link',
  'milestone'
);

create type public.source_system as enum ('manual', 'github');
create type public.visibility_default as enum ('private', 'public_safe');
create type public.proof_strength as enum ('strong', 'moderate', 'weak');
create type public.verification_status as enum (
  'unreviewed',
  'structured',
  'approved',
  'rejected'
);
create type public.approval_status as enum (
  'draft',
  'approved_private',
  'approved_public_safe',
  'needs_more_proof',
  'do_not_use'
);
create type public.link_type as enum ('github', 'cert', 'project', 'note', 'external');
create type public.tag_type as enum ('skill', 'project', 'role_family', 'tool', 'theme');
create type public.claim_type as enum (
  'fact_backed',
  'evidence_backed_inference',
  'needs_more_proof'
);
create type public.period_type as enum ('monthly', 'quarterly');
create type public.visibility as enum ('private', 'public_safe');
create type public.export_target_type as enum (
  'resume_bullets',
  'changelog_entry',
  'evidence_snapshot'
);
create type public.export_format as enum ('markdown', 'text', 'json');
create type public.export_status as enum ('ready', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_valid_evidence_state(
  verification_value public.verification_status,
  approval_value public.approval_status
)
returns boolean
language sql
immutable
as $$
  select
    (verification_value = 'unreviewed' and approval_value = 'draft')
    or (verification_value = 'structured' and approval_value = 'draft')
    or (verification_value = 'structured' and approval_value = 'needs_more_proof')
    or (verification_value = 'approved' and approval_value = 'approved_private')
    or (verification_value = 'approved' and approval_value = 'approved_public_safe')
    or (verification_value = 'rejected' and approval_value = 'do_not_use');
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) > 0),
  github_connected boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.evidence_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.evidence_type not null,
  title text not null check (char_length(btrim(title)) > 0),
  raw_input text not null check (char_length(btrim(raw_input)) > 0),
  factual_summary text,
  time_start timestamptz,
  time_end timestamptz,
  source_system public.source_system not null,
  source_external_id text,
  source_url text,
  project_name text,
  visibility_default public.visibility_default not null default 'private',
  proof_strength public.proof_strength,
  verification_status public.verification_status not null default 'unreviewed',
  approval_status public.approval_status not null default 'draft',
  ai_structured_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evidence_items_time_range check (
    time_end is null or time_start is null or time_end >= time_start
  ),
  constraint evidence_items_github_requirements check (
    source_system <> 'github'
    or (source_external_id is not null and source_url is not null)
  ),
  constraint evidence_items_structured_payload_object check (
    jsonb_typeof(ai_structured_payload) = 'object'
  ),
  constraint evidence_items_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint evidence_items_state_pair_valid check (
    public.is_valid_evidence_state(verification_status, approval_status)
  )
);

create table public.evidence_links (
  id uuid primary key default extensions.gen_random_uuid(),
  evidence_item_id uuid not null references public.evidence_items (id) on delete cascade,
  label text not null check (char_length(btrim(label)) > 0),
  url text not null check (char_length(btrim(url)) > 0),
  link_type public.link_type not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.tags (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tag_type public.tag_type not null,
  name text not null check (char_length(btrim(name)) > 0)
);

create table public.evidence_item_tags (
  evidence_item_id uuid not null references public.evidence_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (evidence_item_id, tag_id)
);

create table public.role_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  target_title text,
  job_description_raw text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.role_variant_tags (
  role_variant_id uuid not null references public.role_variants (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (role_variant_id, tag_id)
);

create table public.resume_bullets (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_variant_id uuid not null references public.role_variants (id) on delete cascade,
  draft_text text not null check (char_length(btrim(draft_text)) > 0),
  claim_type public.claim_type not null,
  proof_strength public.proof_strength not null,
  approval_status public.approval_status not null default 'draft',
  is_user_edited boolean not null default false,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint resume_bullets_generation_metadata_object check (
    jsonb_typeof(generation_metadata) = 'object'
  )
);

create table public.resume_bullet_evidence (
  resume_bullet_id uuid not null references public.resume_bullets (id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items (id) on delete cascade,
  primary key (resume_bullet_id, evidence_item_id)
);

create table public.changelog_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type public.period_type not null,
  period_start date not null,
  period_end date not null,
  title text not null check (char_length(btrim(title)) > 0),
  body text not null check (char_length(btrim(body)) > 0),
  visibility public.visibility not null default 'private',
  approval_status public.approval_status not null default 'draft',
  is_user_edited boolean not null default false,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint changelog_entries_period_range check (period_end >= period_start),
  constraint changelog_entries_generation_metadata_object check (
    jsonb_typeof(generation_metadata) = 'object'
  )
);

create table public.changelog_entry_evidence (
  changelog_entry_id uuid not null references public.changelog_entries (id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items (id) on delete cascade,
  primary key (changelog_entry_id, evidence_item_id)
);

create table public.exports (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type public.export_target_type not null,
  target_id uuid,
  format public.export_format not null,
  content text not null check (char_length(content) > 0),
  status public.export_status not null default 'ready',
  created_at timestamptz not null default timezone('utc', now()),
  constraint exports_target_contract check (
    (target_type = 'evidence_snapshot' and target_id is null)
    or (target_type <> 'evidence_snapshot' and target_id is not null)
  )
);

create unique index evidence_items_source_identity_idx
  on public.evidence_items (user_id, type, source_system, source_external_id)
  where source_external_id is not null;

create index evidence_items_user_updated_idx
  on public.evidence_items (user_id, updated_at desc);

create index evidence_items_review_state_idx
  on public.evidence_items (user_id, verification_status, approval_status, updated_at desc);

create index evidence_items_type_idx
  on public.evidence_items (user_id, type, updated_at desc);

create index evidence_links_item_idx
  on public.evidence_links (evidence_item_id);

create unique index tags_user_tag_type_name_idx
  on public.tags (user_id, tag_type, lower(name));

create index role_variants_user_updated_idx
  on public.role_variants (user_id, updated_at desc);

create index resume_bullets_user_role_idx
  on public.resume_bullets (user_id, role_variant_id, updated_at desc);

create index changelog_entries_user_period_idx
  on public.changelog_entries (user_id, period_type, period_start desc);

create index exports_user_created_idx
  on public.exports (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inferred_display_name text;
  inferred_github_connected boolean;
begin
  inferred_display_name := coalesce(
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'user_name', '')), ''),
    nullif(btrim(coalesce(new.email, '')), ''),
    'ResumeEvolver user'
  );

  inferred_github_connected := coalesce(
    (new.raw_app_meta_data ->> 'provider') = 'github',
    false
  );

  insert into public.profiles (id, display_name, github_connected)
  values (new.id, inferred_display_name, inferred_github_connected)
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    github_connected = public.profiles.github_connected or excluded.github_connected,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_updated
after update of raw_user_meta_data, raw_app_meta_data, email on auth.users
for each row execute function public.handle_new_user();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_evidence_items_updated_at
before update on public.evidence_items
for each row execute function public.set_updated_at();

create trigger set_role_variants_updated_at
before update on public.role_variants
for each row execute function public.set_updated_at();

create trigger set_resume_bullets_updated_at
before update on public.resume_bullets
for each row execute function public.set_updated_at();

create trigger set_changelog_entries_updated_at
before update on public.changelog_entries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.evidence_items enable row level security;
alter table public.evidence_links enable row level security;
alter table public.tags enable row level security;
alter table public.evidence_item_tags enable row level security;
alter table public.role_variants enable row level security;
alter table public.role_variant_tags enable row level security;
alter table public.resume_bullets enable row level security;
alter table public.resume_bullet_evidence enable row level security;
alter table public.changelog_entries enable row level security;
alter table public.changelog_entry_evidence enable row level security;
alter table public.exports enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() is not null and auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() is not null and auth.uid() = id)
with check (auth.uid() is not null and auth.uid() = id);

create policy "evidence_items_select_own"
on public.evidence_items
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "evidence_items_insert_own"
on public.evidence_items
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "evidence_items_update_own"
on public.evidence_items
for update
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "evidence_items_delete_own"
on public.evidence_items
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "evidence_links_manage_owned_evidence"
on public.evidence_links
for all
to authenticated
using (
  exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
);

create policy "tags_manage_own"
on public.tags
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "evidence_item_tags_manage_owned_records"
on public.evidence_item_tags
for all
to authenticated
using (
  exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags
    where public.tags.id = tag_id
      and public.tags.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags
    where public.tags.id = tag_id
      and public.tags.user_id = auth.uid()
  )
);

create policy "role_variants_manage_own"
on public.role_variants
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "role_variant_tags_manage_owned_records"
on public.role_variant_tags
for all
to authenticated
using (
  exists (
    select 1
    from public.role_variants
    where public.role_variants.id = role_variant_id
      and public.role_variants.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags
    where public.tags.id = tag_id
      and public.tags.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.role_variants
    where public.role_variants.id = role_variant_id
      and public.role_variants.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags
    where public.tags.id = tag_id
      and public.tags.user_id = auth.uid()
  )
);

create policy "resume_bullets_manage_own"
on public.resume_bullets
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "resume_bullet_evidence_manage_owned_records"
on public.resume_bullet_evidence
for all
to authenticated
using (
  exists (
    select 1
    from public.resume_bullets
    where public.resume_bullets.id = resume_bullet_id
      and public.resume_bullets.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.resume_bullets
    where public.resume_bullets.id = resume_bullet_id
      and public.resume_bullets.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
);

create policy "changelog_entries_manage_own"
on public.changelog_entries
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "changelog_entry_evidence_manage_owned_records"
on public.changelog_entry_evidence
for all
to authenticated
using (
  exists (
    select 1
    from public.changelog_entries
    where public.changelog_entries.id = changelog_entry_id
      and public.changelog_entries.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.changelog_entries
    where public.changelog_entries.id = changelog_entry_id
      and public.changelog_entries.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.evidence_items
    where public.evidence_items.id = evidence_item_id
      and public.evidence_items.user_id = auth.uid()
  )
);

create policy "exports_manage_own"
on public.exports
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);
