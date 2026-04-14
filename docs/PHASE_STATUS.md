# Phase Status

## Milestone 7 shipped

- Activated `/exports` as a real export workspace for saved markdown, text, and JSON snapshots.
- Added fail-closed export creation for:
  - approved role-scoped resume bullet sets
  - approved changelog entries
  - explicit JSON evidence snapshots
- Added owner-only export downloads through `GET /api/exports/:id` with explicit content types and attachment headers.
- Activated `/review-cycle` as a read-only month and quarter guidance dashboard driven from existing evidence, drafting, and export state.
- Kept review-cycle deterministic and avoided any new workflow engine, persistence layer, or automation system.

## Cleanup completed

- Removed stale placeholder code and milestone copy that still treated exports and review-cycle as future work.
- Updated API, domain, README, and release docs so the repo now describes export rules, review-cycle limits, and roadmap completion truthfully.
- Closed the roadmap explicitly instead of inventing a Milestone 8.

## Verification

- `pnpm check`
- `pnpm db:reset`
- `pnpm db:test`
- `pnpm test:e2e`
- `pnpm build`

Manual verification already completed:
- ran one live GitHub import against a tiny public repo in Milestone 4
- confirmed imported evidence appeared in `/review` and `/ledger`

Known limitation:
- export history labels are derived from current target rows and the saved export row itself, not from dedicated metadata columns, so history stays intentionally lightweight in v1

## Post-v1 backlog brief

The roadmap is complete. Any next work should be treated as post-v1 backlog and held to the same trust-first standard.

Reasonable post-v1 candidates:

- richer export labeling only if lightweight history proves insufficient
- quarterly-specific browser smoke if changelog cadence usage increases
- archive or tombstone behavior for linked evidence instead of hard delete blocking alone
- targeted UX cleanup based on actual monthly usage, not speculative future abstractions

## Remaining roadmap

- No roadmap phases remain after Milestone 7.
