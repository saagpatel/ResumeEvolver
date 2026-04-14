# Release Checklist

## Milestone 1

- repo contract committed
- docs skeleton committed
- env example committed
- Supabase SSR auth utilities added
- product routes protected
- schema migration applies locally
- RLS enabled on all user-owned tables
- pgTAP tests pass
- dashboard shell renders for authenticated users

## Ongoing gates

- `pnpm check`
- `pnpm db:reset`
- `pnpm db:test`
- `pnpm test:e2e`
- `pnpm build`

Notes:

- `pnpm check` covers lint, typecheck, and Vitest.
- `pnpm check` does not replace database tests or Playwright smoke coverage.
- Treat `pnpm db:reset && pnpm db:test` as one gate for derived-output milestone work.
- Later milestones must keep the docs and scripts truthful about what each command verifies.

## Before shipping later milestones

- trust-boundary route tests added
- derived-output routes fail closed on unapproved evidence
- period-based derived outputs fail closed on out-of-period evidence
- export routes fail closed on target ownership and eligibility
- no live GitHub or live model calls in CI
- authenticated smoke covers the primary active milestone flow
- docs updated for schema and API changes
- `docs/PHASE_STATUS.md` updated with shipped summary, cleanup notes, next-phase brief, and remaining-phase one-liners

## Milestone 7 closeout

- export serializers covered by unit tests
- export routes covered by integration tests
- export history and review-cycle guidance covered by authenticated smoke
- `exports` ownership verified in pgTAP
- stale roadmap copy removed now that Milestone 7 is complete
- roadmap explicitly closed with no Milestone 8
