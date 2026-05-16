# ResumeEvolver Repo Contract

## Product definition

ResumeEvolver is a private career evidence ledger.

It exists to help one user capture proof of real work, review that proof deliberately, and generate traceable resume bullets or changelog drafts from approved evidence only.

## Non-goals

Do not turn this into:

- an AI resume writer
- a LinkedIn clone
- a portfolio site builder
- a build-in-public product
- a generic AI coach
- an ATS or job tracker
- a team collaboration tool
- a file upload system
- a commit clustering system

## Trust model

- Evidence items are the only source of truth.
- Resume bullets, changelog entries, and exports are derived objects.
- AI may suggest structure, proof strength, proof gaps, role relevance, and drafts.
- AI may not invent accomplishments, invent metrics, infer business impact from GitHub activity alone, auto-approve evidence, strengthen claims silently, or use unapproved evidence for generation.
- Public-safe is an explicit approval state, never a default.
- Every generated output must remain linked to supporting evidence item IDs.

## Build order

1. Foundation
2. Manual evidence flow
3. Ledger
4. GitHub import
5. Role variants and resume drafting
6. Changelog drafting
7. Exports and review-cycle polish

Do not skip ahead without an explicit user request.

## Commands

`.codex/verify.commands` is the canonical verifier for routine Codex work.
Do not invent verifier commands; if a needed command is missing or unclear, stop and report the gap.

Core verifier:
- `pnpm install`
- `pnpm check`
- `pnpm build`

Use gated commands only when the task touches database/RLS or browser-flow behavior:
- `pnpm db:reset && pnpm db:test`
- `pnpm test:e2e`

## Coding rules

- Use TypeScript throughout.
- Prefer simple code and clear domain boundaries over abstractions.
- Keep reads in server-side query helpers and writes in route handlers.
- Do not introduce an ORM in v1.
- Do not introduce background jobs in v1.
- Validate external input with Zod.
- Version prompt templates in `prompts/`.
- Keep domain logic out of presentational components.
- Avoid speculative abstractions for future integrations.

## UX rules

- Private-first by default.
- Fast capture.
- Deliberate review.
- Traceable generation.
- Lightweight monthly usage.
- No social-product cues.
- No enterprise-compliance feel.

## Security rules

- RLS must be enabled on every user-owned table from day one.
- Never use `service_role` in normal application request paths.
- Reject cross-user access everywhere.
- Generation must fail closed if any evidence is not approved.
- GitHub import must stay explicitly repo-scoped and time-window scoped.
- Treat provider tokens as ephemeral and session-bound.
- Do not log provider tokens, raw evidence bodies, or generated export content.

## Data rules

- `metadata`, `ai_structured_payload`, and `generation_metadata` must stay bounded and documented.
- Do not add per-type evidence tables in v1.
- Do not store claims during GitHub import.
- Do not allow normal hard-delete flows for linked evidence.

## Do not add

- artifact uploads
- PDF export
- commit clustering
- Slack, Jira, Notion, Gmail, or other connectors
- team features
- vanity analytics
- public profile pages
- social posting flows

## Testing expectations

- Add pgTAP coverage for every migration that changes user-owned tables or RLS.
- Keep unit tests for domain rules and serializers.
- Keep integration tests for route handlers and query helpers.
- Keep e2e coverage to smoke flows only.
- Do not rely on live GitHub or live model calls in CI.

## Migration discipline

- Use forward-only SQL migrations.
- Keep enums and constraints explicit.
- Update `docs/DOMAIN.md` and `docs/API.md` when schema or API contracts change.
- Prefer idempotent migration statements where practical.

## Done for v1

Work is only done when:

- manual evidence capture works
- GitHub import works for selected public repos
- imported GitHub records land as `draft` and `unreviewed`
- approval states are enforced
- resume generation rejects unapproved evidence
- changelog generation rejects unapproved evidence
- generated outputs expose linked evidence
- markdown, text, and JSON exports work
- RLS prevents cross-user access
- public-safe output remains explicit

<!-- portfolio-context:start -->
# Portfolio Context

## What This Project Is

ResumeEvolver is a resume/job-search operating tool that helps track evidence, derive approved resume outputs, and package private export snapshots for review cycles. It is currently a Next.js/TypeScript product with Supabase-style database/RLS concerns, export generation, and cadence dashboards for resume iteration.

## Current State

- Milestone 7 complete: approved derived outputs and selected evidence can now be saved as private export snapshots, and review-cycle guidance is live as a read-only cadence dashboard.
- The roadmap is complete through Milestone 7. Any further work should be treated as post-v1 backlog, not an implicit Milestone 8.

## Stack

- Primary stack: Next.js, TypeScript
- JavaScript package manager: npm-compatible workflow

## How To Run

`.codex/verify.commands` is the canonical verifier for routine Codex work.
Do not invent verifier commands; if a needed command is missing or unclear, stop and report the gap.

Core verifier:
- `pnpm install`
- `pnpm check`
- `pnpm build`

Use gated commands only when the task touches database/RLS or browser-flow behavior:
- `pnpm db:reset && pnpm db:test`
- `pnpm test:e2e`

## Known Risks

- This repo only has minimum-viable recovery context today; deeper handoff details may still live in the README and supporting docs.

## Next Recommended Move

Use this context plus the README and supporting docs to resume the next active task, then promote the repo beyond minimum-viable by capturing a dedicated handoff, roadmap, or discovery artifact.

<!-- portfolio-context:end -->
