# API

## Milestone 7 status

Implemented now:

- `GET /auth/callback` for Supabase OAuth code exchange
- `POST /api/evidence` for manual evidence capture
- `PATCH /api/evidence/:id` for editable manual evidence updates
- `POST /api/evidence/:id/structure` for synchronous AI structuring
- `POST /api/evidence/:id/approve` for explicit review decisions
- `POST /api/evidence/import/github` for bounded public GitHub evidence import
- `POST /api/roles` for saved role-variant creation
- `PATCH /api/roles/:id` for role-variant updates
- `POST /api/resume/generate` for fail-closed resume bullet generation
- `PATCH /api/resume/bullets/:id` for bullet text edits and allowed bullet-state changes
- `POST /api/changelog/generate` for fail-closed monthly or quarterly changelog drafting
- `PATCH /api/changelog/:id` for changelog title/body edits and allowed approval-state changes
- `POST /api/exports` for saved private export snapshots
- `GET /api/exports/:id` for owner-only export downloads
- direct server-side Ledger reads for:
  - user-scoped evidence listing
  - evidence detail with links
  - project filter options
  - downstream linkage counts and ids
- direct server-side role and resume reads for:
  - role-variant listing and selection
  - approved evidence suggestions and fallback candidates
  - role-scoped resume bullets with provenance links
- direct server-side export and review-cycle reads for:
  - export history
  - exportable role and changelog targets
  - evidence snapshot candidates
  - read-only month and quarter cadence summaries

No additional roadmap write routes remain after Milestone 7.

## Read strategy

- Prefer direct server-side data access in App Router pages.
- Keep reads in shared domain query helpers.
- Do not add general-purpose read APIs in v1 unless a screen clearly needs them.
- Ledger reads must distinguish:
  - successful result
  - empty/no-match result
  - query failure
- Query failures must not collapse into empty UI.

## Ledger read contract

- `/ledger` uses URL search params for reads:
  - `type`
  - `ledgerStatus`
  - `proofStrength`
  - `project`
  - `from`
  - `to`
  - `evidence`
- Ledger list rows are summary records only. They do not include `raw_input`, `ai_structured_payload`, or `metadata`.
- Ledger detail fetches one selected record and may include:
  - full evidence fields
  - supporting links
  - derived ledger status
  - downstream usage ids/counts
- Ledger is read-first in Milestone 3. It does not introduce read APIs or new write routes.

## Write strategy

- Route handlers own mutation entry points.
- Validate all input with Zod.
- GitHub import may return partial repo-by-repo results, but it must never silently drop failures or pretend missing capability is a generic success.
- Re-check ownership and approval state server-side before writing derived records.

## Manual evidence route rules

- `POST /api/evidence` only accepts manual evidence types in Milestone 2.
- New manual evidence always lands as `unreviewed + draft` with `source_system='manual'`.
- `PATCH /api/evidence/:id` is limited to editable evidence only.
- `POST /api/evidence/:id/structure` may suggest structure, proof strength, tags, proof gaps, and role relevance, but it may not approve evidence.
- `POST /api/evidence/:id/approve` is the only route that may move evidence into approved, needs-more-proof, or do-not-use states.

## GitHub import route rules

- `POST /api/evidence/import/github` requires:
  - authenticated user
  - explicit GitHub import reconnect state in the current session
  - one to three `owner/name` repositories
  - inclusive `from` and `to` dates
  - a window no larger than 90 days
- Accepted import types are:
  - `pull_request`
  - `issue`
  - `release`
- Omitted import types default to all three.
- Imports are public-repo only in Milestone 4.
- GitHub imports normalize source facts into `evidence_items`; they do not create claims, downstream drafts, or evidence links.
- New imported rows land as `unreviewed + draft`.
- Re-import preserves existing review state only when the normalized import fingerprint is unchanged.
- Changed GitHub source records reset back to `unreviewed + draft`.

## Role routes

- `POST /api/roles` requires an authenticated user and validates:
  - `name` as a required non-empty string
  - optional `targetTitle`
  - optional `jobDescriptionRaw`
  - optional `notes`
- `PATCH /api/roles/:id` is partial but uses the same field bounds.
- Role variants are saved targeting context only in Milestone 5.
- `role_variant_tags` remains unused in Milestone 5.

## Resume drafting routes

- `POST /api/resume/generate` requires:
  - authenticated user
  - `roleVariantId`
  - one to twelve explicit `evidenceIds`
- The route must re-check that every selected evidence row:
  - belongs to the current user
  - is already approved
  - was explicitly selected by the user
- Generation is synchronous and bounded in Milestone 5.
- Generated bullets are saved atomically with their `resume_bullet_evidence` links.
- Supported bullet approval states in Milestone 5 are:
  - `draft`
  - `approved_private`
  - `approved_public_safe`
  - `do_not_use`
- `needs_more_proof` is invalid for resume bullets and must be rejected in both app logic and DB constraints.
- `PATCH /api/resume/bullets/:id` may update:
  - `draftText`
  - `approvalStatus`
- Text edits set `is_user_edited=true`.
- Regeneration replaces untouched generated bullets and preserves `is_user_edited=true` bullets for the same role variant.

## Changelog drafting routes

- `POST /api/changelog/generate` requires:
  - authenticated user
  - `periodType` of `monthly` or `quarterly`
  - aligned `periodStart`
  - one to twenty explicit `evidenceIds`
  - optional `replaceEdited`
- The route must re-check that every selected evidence row:
  - belongs to the current user
  - is already approved
  - falls inside the selected period
  - was explicitly selected by the user
- Changelog generation is synchronous and bounded in Milestone 6.
- Changelog generation stores one draft per `(period_type, period_start, period_end)`.
- Regeneration is blocked when the current draft has `is_user_edited=true` unless `replaceEdited=true` is explicitly supplied.
- Generated changelog entries are saved atomically with their `changelog_entry_evidence` links.
- Supported changelog approval states in Milestone 6 are:
  - `draft`
  - `approved_private`
  - `approved_public_safe`
  - `do_not_use`
- `needs_more_proof` is invalid for changelog entries and must be rejected in both app logic and DB constraints.
- `PATCH /api/changelog/:id` may update:
  - `title`
  - `body`
  - `approvalStatus`
- Title and body edits set `is_user_edited=true`.
- `approvalStatus='approved_public_safe'` is valid only when every linked evidence row is already `approved_public_safe`.
- Changelog `visibility` is derived from approval state and is not independently editable by the client.

## Export routes

- `POST /api/exports` requires:
  - authenticated user
  - one valid target request
- Supported export requests are:
  - `resume_bullets` with:
    - `targetId=role_variants.id`
    - `format` of `markdown`, `text`, or `json`
  - `changelog_entry` with:
    - `targetId=changelog_entries.id`
    - `format` of `markdown`, `text`, or `json`
  - `evidence_snapshot` with:
    - `targetId=null`
    - `format='json'`
    - `evidenceIds` of 1..100 explicit owned evidence ids
- Resume exports require at least one approved bullet for the selected role variant.
- Resume exports include only bullets in:
  - `approved_private`
  - `approved_public_safe`
- Changelog exports require the selected changelog entry to already be:
  - `approved_private`
  - `approved_public_safe`
- Evidence snapshot exports may include any explicitly selected owned evidence rows because they are private source-of-truth backups, not public derivatives.
- Export requests fail closed on:
  - authentication
  - ownership
  - target existence
  - invalid target and format combinations
  - ineligible derived-output state
- Successful export creation writes exactly one `exports` row with `status='ready'`.
- Failed export attempts do not persist `failed` rows in Milestone 7.

- `GET /api/exports/:id` requires:
  - authenticated user
  - owner access to the saved export row
- The route returns the saved snapshot content with:
  - explicit content type by format
  - attachment `Content-Disposition`
  - no-store caching headers

## Review-cycle reads

- `/review-cycle` stays server-rendered and read-only in Milestone 7.
- There is no review-cycle write API.
- The page summarizes:
  - review backlog
  - approved evidence momentum for the current month and quarter
  - current month and quarter changelog status
  - approved resume coverage by role variant
  - export recency by target type
- Deterministic next-step guidance is computed from live state in this priority order:
  - review backlog
  - current-period changelog coverage
  - resume approval coverage
  - export freshness

## Verification notes

- `pnpm check` covers lint, typecheck, and Vitest only.
- `pnpm db:reset && pnpm db:test` is the truthful local gate for database-policy and RLS verification.
- `pnpm test:e2e` includes smoke coverage for protected product routes, including the GitHub workspace redirect when unauthenticated.
- Milestone 5 adds authenticated smoke coverage for the resume drafting flow using deterministic local test auth and test-mode generation.
- Milestone 6 adds authenticated smoke coverage for changelog drafting, edited-draft blocking, and explicit discard-and-regenerate behavior.
- Milestone 7 adds authenticated smoke coverage for saved export history and the read-only review-cycle page.
