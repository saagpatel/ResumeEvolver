# ResumeEvolver

ResumeEvolver is a private-first career evidence ledger for collecting proof of real work, reviewing it deliberately, and generating traceable resume or changelog drafts only from approved evidence.

## Status

- Milestone 7 complete: approved derived outputs and selected evidence can now be saved as private export snapshots, and review-cycle guidance is live as a read-only cadence dashboard.
- The roadmap is complete through Milestone 7. Any further work should be treated as post-v1 backlog, not an implicit Milestone 8.

## Local setup

1. From the repository root, use Node.js 22.12+ and pnpm (the local lane is tested with pnpm 12.8.1). Install dependencies:

```bash
pnpm install
```

2. Copy app runtime environment variables:

```bash
cp .env.example .env.local
```

3. For local Supabase provider secrets, use a root `.env` file or exported shell vars for CLI substitution:

```bash
export SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=...
export SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=...
```

`.env.local` is for the Next.js app runtime. Supabase CLI/provider secrets should not rely on it.

4. Start the local Supabase stack:

```bash
pnpm db:start
```

5. Only for a disposable local development database, reset to the committed schema. This deletes local database data; skip it for a database containing work you need to preserve:

```bash
pnpm db:reset
```

6. Start the app:

```bash
pnpm dev
```

The local Supabase OAuth callback URL is `http://127.0.0.1:54321/auth/v1/callback`. Add that to the GitHub OAuth app when testing sign-in locally.

Add `OPENAI_API_KEY` to enable evidence structuring in `/review`, real resume generation in `/resume`, and real changelog generation in `/changelog`. `OPENAI_MODEL_RESUME_GENERATE` and `OPENAI_MODEL_CHANGELOG_GENERATE` are optional and override the default generation models for their respective drafting routes. Without an API key, capture, review, GitHub import, roles, and existing derived drafts still work, but new AI drafting stays disabled unless local test mode is enabled.

Evidence capture runs from `/inbox`. GitHub import runs from `/github`. Base sign-in stays narrow; the import workspace prompts for a separate GitHub reconnect step when import access is not available in the current session.

Exports run from `/exports` and save private markdown, text, or JSON snapshots into the product database before download. Review-cycle lives at `/review-cycle` and stays read-only by design.

## Core commands

- `pnpm dev` — run the Next.js app
- `pnpm check` — lint, typecheck, and Vitest
- `pnpm db:reset` — rebuild the local database from migrations and seed data
- `pnpm db:test` — run pgTAP database and RLS tests against the current local database
- `pnpm test:e2e` — run the Playwright smoke flow
- `pnpm build` — verify the production build

Database note:

- treat `pnpm db:reset && pnpm db:test` as the truthful local DB gate for milestone work

## Verification prerequisites and safe lanes

`.codex/verify.commands` is the canonical routine verifier; run it from the
repository root with the required build environment set. A copied `.env.example`
contains empty Supabase fields: fill `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` before `pnpm build`, or use the following
nonsecret, compile-only values in an isolated checkout:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=verification-placeholder-nonsecret \
OPENAI_API_KEY= pnpm build
```

These placeholders satisfy build-time validation; they do not establish a working
Supabase connection, sign-in, RLS or AI generation. Do not use a real provider key
for the compile-only lane. `pnpm check` runs ESLint, TypeScript and the full Vitest
unit/integration fixture set. For a focused example, run:

```sh
pnpm test:unit tests/unit/export-contracts.test.ts
```

Vitest uses local fake-Supabase/server-only fixtures and does not need the Supabase
stack. No formatter command is configured. For database/RLS changes, use an
explicitly disposable local Supabase stack (Docker and Supabase CLI required),
then the existing `pnpm db:reset && pnpm db:test` gate; never reset a personal or
shared database as routine verification.

For changed protected routes/user flows, the existing `pnpm test:e2e` lane requires
Playwright's Chromium browser and free loopback port 3000. Its config starts a fresh
`RESUMEEVOLVER_TEST_MODE=1` Next server and refuses to reuse another server. Install
the test browser with `pnpm exec playwright install chromium` when needed. Keep
public Supabase environment fields configured for the selected local test stack;
test mode substitutes draft generation, not the entire database/authentication
system. Do not point this lane at a production or personal database. Changes that
only affect verification prose do not require a browser run.

## Product rules

- Evidence items are the only source of truth.
- AI may structure and draft, but it may not invent, approve, strengthen, or silently publish.
- Public-safe is always explicit.
- GitHub activity is candidate evidence, not professional truth.
- Resume drafting must fail closed unless every selected evidence item is already approved and explicitly confirmed by the user.
- Changelog drafting must fail closed unless every selected evidence item is already approved, inside the selected period, and explicitly confirmed by the user.
- Export creation must fail closed on ownership, target eligibility, and approved-output rules.
- Every roadmap phase now ends with a review, cleanup pass, shipped summary, next-phase write-up, and one-line summaries of the remaining phases in [`docs/PHASE_STATUS.md`](./docs/PHASE_STATUS.md).

See [AGENTS.md](./AGENTS.md) and the `docs/` folder for the operational contract.
