alter table public.evidence_items
  add constraint evidence_items_source_url_safe_http_url check (
    source_url is null or public.is_safe_http_url(source_url)
  );
