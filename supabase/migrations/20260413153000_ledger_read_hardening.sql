create or replace function public.is_safe_http_url(input text)
returns boolean
language sql
immutable
as $$
  select coalesce(input ~* '^https?://', false);
$$;

alter table public.evidence_links
  add constraint evidence_links_safe_http_url check (public.is_safe_http_url(url));

drop policy if exists "evidence_items_delete_own" on public.evidence_items;
