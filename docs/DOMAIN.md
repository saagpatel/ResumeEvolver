# Domain

## Source of truth

`evidence_items` is the primary record in ResumeEvolver.

Derived records:

- `resume_bullets`
- `changelog_entries`
- `exports`
- `role_variants` stores saved targeting context for downstream drafting

## Evidence state rules

Allowed evidence state pairs:

- `unreviewed + draft`
- `structured + draft`
- `structured + needs_more_proof`
- `approved + approved_private`
- `approved + approved_public_safe`
- `rejected + do_not_use`

Any other pair is invalid and must be rejected in app logic and database constraints.

Derived Ledger statuses in Milestone 3:

- `draft_unreviewed`
- `draft_structured`
- `needs_more_proof`
- `approved_private`
- `approved_public_safe`
- `do_not_use`

## Metadata rules

- `metadata` stores lightweight type-specific details only.
- `ai_structured_payload` stores machine-readable structuring output only.
- `generation_metadata` stores prompt version, model, and bounded evidence selection metadata.
- None of these fields may become uncontrolled junk drawers.

For `resume_bullets`, `generation_metadata` in Milestone 5 is bounded to:

- `source`
- `prompt_version`
- `generated_at`
- `role_variant_id`
- `selected_evidence_ids`
- `model`

For `changelog_entries`, `generation_metadata` in Milestone 6 is bounded to:

- `source`
- `prompt_version`
- `generated_at`
- `period_type`
- `period_start`
- `period_end`
- `selected_evidence_ids`
- `model`

For `exports`, stored `content` in Milestone 7 is bounded by target and format:

- `resume_bullets`
  - markdown
  - text
  - json
- `changelog_entry`
  - markdown
  - text
  - json
- `evidence_snapshot`
  - json only

Export content is a saved snapshot, not a transient download view.

## Ledger rules

- Ledger is a read-first evidence browser.
- Ledger list rows are data-minimized summaries.
- Ledger detail may show full evidence content, links, and downstream linkage ids.
- Ledger must not silently turn database failures into empty states.
- Ledger does not own editing flows; review remains the approval surface for both manual and imported GitHub evidence.

## Link and deletion rules

- Stored evidence links must use `http` or `https`.
- `evidence_items.source_url` must also use `http` or `https`.
- External links must render with safe outbound-link attributes.
- Normal owner hard-delete for `evidence_items` is disabled at the database boundary in Milestone 3.
- Archive/tombstone behavior is still deferred.

## Manual evidence rules

- Manual evidence types in Milestone 2 are `manual_note`, `certification`, `project_link`, and `milestone`.
- Manual evidence starts as `unreviewed + draft`.
- Editable evidence states in Milestone 2 are:
  - `unreviewed + draft`
  - `structured + draft`
  - `structured + needs_more_proof`
- Approved and rejected evidence are read-only in Milestone 2.
- AI tag suggestions remain inside `ai_structured_payload` in Milestone 2 and do not populate `tags` or `evidence_item_tags`.

## Import rules

- GitHub imports are candidate evidence only.
- Imported records must never arrive as claims.
- Imported records must store source URL, external ID, source system, and bounded raw metadata.
- Imports are public-repo only in v1 and must be repo-scoped and time-window scoped.
- Imported records are reviewable in `/review` but source fields are not manually editable there.
- Imported records may be structured and approved through the same state machine as manual evidence.
- GitHub issue import must ignore issue payloads that are actually pull requests.
- Imported metadata must stay allowlisted and may not become a dump of raw GitHub payloads.
- Re-import preserves approval state only when the normalized imported source is unchanged.
- Re-imported rows with changed source content reset to `unreviewed + draft`.

## Role rules

- `role_variants` stores saved targeting context only.
- Milestone 5 uses:
  - `name`
  - `target_title`
  - `job_description_raw`
  - `notes`
- `role_variant_tags` remains dormant in Milestone 5.
- Role variants do not auto-select evidence and do not create claims by themselves.

## Resume drafting rules

- Resume drafting uses approved evidence only.
- Suggested evidence is heuristic only and must not become implicit selection.
- The user must explicitly confirm evidence IDs before generation.
- Resume generation is synchronous and fail closed in Milestone 5.
- Every generated bullet must stay linked to supporting evidence IDs.
- Resume bullet proof strength is the weakest linked evidence proof strength, defaulting to `weak` when a linked evidence record has no stronger value.
- Regeneration replaces untouched generated bullets and preserves rows where `is_user_edited=true`.
- Allowed resume bullet approval states in Milestone 5 are:
  - `draft`
  - `approved_private`
  - `approved_public_safe`
  - `do_not_use`
- `needs_more_proof` is invalid for resume bullets and must be rejected.

## Changelog drafting rules

- Changelog drafting uses approved evidence only.
- Period selection is explicit and evidence confirmation is explicit.
- Evidence selection is `suggest + confirm`, never silent period auto-inclusion.
- Effective evidence date is resolved from:
  - `time_end`
  - then `time_start`
  - then `created_at`
- Changelog generation is synchronous and fail closed in Milestone 6.
- One changelog draft exists per `(period_type, period_start, period_end)`.
- Every changelog draft stays linked to supporting evidence ids through `changelog_entry_evidence`.
- Regeneration is blocked when the current draft has `is_user_edited=true` unless the user explicitly discards edits.
- Allowed changelog approval states in Milestone 6 are:
  - `draft`
  - `approved_private`
  - `approved_public_safe`
  - `do_not_use`
- `needs_more_proof` is invalid for changelog entries and must be rejected.
- Changelog `visibility` is derived from `approval_status`:
  - `approved_public_safe` => `public_safe`
  - all other allowed states => `private`
- A changelog entry may only move to `approved_public_safe` when every linked evidence row is already `approved_public_safe`.

## Export rules

- Exports are saved private snapshots, not share links and not publish flows.
- Resume exports target one `role_variant_id` and represent the approved bullet set for that role.
- Resume exports include only bullets in:
  - `approved_private`
  - `approved_public_safe`
- Changelog exports target one `changelog_entries.id`.
- Changelog exports require the target entry to already be:
  - `approved_private`
  - `approved_public_safe`
- Evidence snapshots are explicit JSON-only backups of selected owned evidence rows.
- Evidence snapshots do not require approved evidence because they are private source-of-truth backups.
- Evidence snapshots are bounded to explicit selected ids and do not become a full-ledger dump in Milestone 7.
- Export history is stored in `exports`.
- Export downloads remain owner-only through RLS and route-level ownership checks.
- Export creation must fail closed on ownership, target eligibility, and target-format rules.

## Review-cycle rules

- Review-cycle is read-only in Milestone 7.
- Review-cycle does not create tasks, reminders, schedules, notifications, or workflow state.
- Review-cycle summarizes only the current month and the current quarter.
- Review-cycle guidance is deterministic and based on:
  - review backlog
  - approved evidence momentum
  - current period changelog coverage
  - approved resume coverage
  - export recency
