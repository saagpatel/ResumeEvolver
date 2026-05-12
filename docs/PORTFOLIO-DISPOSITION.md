# ResumeEvolver — Portfolio Disposition

**Status:** Release Frozen (static-host, Next.js + local Supabase
stack) — Next.js + TypeScript + **Supabase (local stack via
Supabase CLI)** + Playwright **private-first career evidence
ledger** at **Milestone 7 complete** on `origin/main`. Operator
explicitly declares roadmap complete: "Any further work should be
treated as post-v1 backlog, not an implicit Milestone 8."
**Tenth static-host cluster member**; **second SSR+Supabase
sub-shape member** (alongside Premise). **Fifth cluster member
with Playwright E2E pattern** — adoption now 50% of cluster.

> Disposition uses strict `origin/main` verification.
> **Operator-declared "no Milestone 8" — clean done signal.**

---

## Verification posture

Only `origin` (`saagpatel/ResumeEvolver`). Clean.

`origin/main`:

- Tip: `e4de417` Improve GitHub import empty repo guidance
- Only 4 commits total:
  - `e4de417` Improve GitHub import empty repo guidance
  - `5d26976` **Add Codex verifier and GitHub import guard**
  - `2d18a61` **feat(app): ship roadmap through milestone 7**
  - `fa4fb32` Initial commit from Create Next App
- Tree: Next.js App Router structure + Playwright + Supabase local
  stack
- Default branch: `main`

Like DecisionStressTest, ResumeEvolver uses the **monolithic feat
commit pattern**: `2d18a61 feat(app): ship roadmap through
milestone 7` ships 7 milestones of features in one commit on top
of the Create Next App scaffold. Now seen in 4 cluster members
(NetworkDecoder, LifeCadenceLedger, DecisionStressTest,
ResumeEvolver).

---

## Current state in one paragraph

ResumeEvolver is a Next.js + TypeScript private-first career
evidence ledger: **collect proof of real work, review it
deliberately, generate traceable resume or changelog drafts only
from approved evidence**. Uses **local Supabase stack** (run
`pnpm db:start` to spin up Postgres + auth) instead of cloud
Supabase (unlike Premise which deploys to managed Supabase). The
operator's README explicitly states: "Milestone 7 complete...
roadmap complete through Milestone 7. Any further work should be
treated as post-v1 backlog, not an implicit Milestone 8." This is
a **clean operator-declared "done" signal** — rare in the
portfolio and worth recognizing.

Architectural note: GitHub import is a feature, and recent
commits add a Codex verifier + import guard + empty-repo guidance.
This suggests the operator actively uses Claude Code / Codex
agents against this repo and has built guardrails for that
workflow.

---

## Why "Release Frozen (static-host, SSR + local Supabase)" — tenth cluster member

Joins the SSR + Supabase sub-shape that Premise (R11) founded:

| Member | Sub-shape detail | Supabase posture |
|---|---|---|
| Premise (R11) | Next.js 15 RSC + Supabase | **Cloud Supabase** (managed) |
| **ResumeEvolver** | **Next.js + local Supabase stack** | **Local Supabase via CLI** (`pnpm db:start`) |

This sub-shape is now operationally **two members with two
different Supabase postures** — cloud vs local. Worth naming the
distinction:

- **Cloud-Supabase**: production-deployable to Vercel + managed
  Supabase backend; multi-tenant concerns; subscription costs.
- **Local-Supabase**: requires `supabase` CLI + Docker locally;
  truly private-first; no cloud cost; not directly
  Vercel-deployable without provisioning a cloud Supabase too.

ResumeEvolver's local-Supabase shape aligns with the
"private-first career evidence" framing — career data stays on
operator's machine.

State is Release Frozen because:
- Operator explicitly declares roadmap complete (rare clean signal)
- Milestone 7 is the stop point per README
- No active feature commits visible beyond the recent guard /
  verifier additions
- Codex verifier suggests operator is moving to maintenance mode

---

## Cluster taxonomy update

| Cluster | Count | Sub-shapes |
|---|---|---|
| **Static-host (web)** | **10** | PWA / static SPA (5) / SSR+Supabase (2: Premise + **ResumeEvolver**) / Next.js+SQLite (2) |
| (others unchanged) | | |

Static-host cluster at 10. SSR+Supabase sub-shape now has 2
members (cloud + local Supabase postures). Playwright E2E
pattern: **5 of 10 = 50% adoption** — half the cluster.

---

## Unblock trigger (operator)

The "no Milestone 8" declaration means there's no further
roadmap. Operational concerns only:

1. **Deployment posture decision** — local Supabase stack means
   operator runs locally. If publishing the app, decide:
   - Stay local-only (private-first remains)
   - Migrate to cloud Supabase + Vercel (drops the private-first
     claim)
   - Self-host Supabase + app on operator infrastructure
     (corporate-context like ITServiceHealth's self-hosted shape)
2. **Codex / Claude Code verifier maintenance** — `5d26976` added
   a verifier; verify it still catches GitHub import edge cases
   as Codex / CC evolve.
3. **Supabase CLI version pinning** — `pnpm db:start` needs a
   working `supabase` CLI; pin a known-good version in CONTRIBUTING.
4. **Career data backup posture** — local Supabase means data
   lives in Docker volumes. Operator should document backup +
   restore flow.
5. **Schema migrations** for v1.1+ (if it ever happens) need a
   migration runbook.

Estimated operator time: ~1 hour to deployment-posture decision.

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen (static-host, SSR + local Supabase)` |
| Distribution channel | **Local-only** (current); operator-decision for production |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Deployment posture decision, (b) Supabase CLI breaking change, (c) Codex verifier maintenance, (d) genuinely-new post-v1 feature scope (explicit Milestone 8 declaration) |
| Co-batch with | Static-host cluster — **now 10 repos** |
| Sub-shape | **SSR + local Supabase** (second SSR+Supabase member; first with local stack) |
| Special concern | **"No Milestone 8" operator declaration** is rare and clean — respect it. Don't propose feature work unless operator explicitly opens v1.1 scope. |
| Special concern | **Codex / CC verifier (`5d26976`)** is an interesting pattern — agent guardrails in canonical repo. Other operator-active repos should consider adopting. |
| Special concern | **Local Supabase backup + restore.** Docker volume lifecycle = data lifecycle. |

---

## Reactivation procedure

1. Verify branch tracking.
2. Review stash `r18-re-stash` (AGENTS.md + next-env.d.ts +
   package.json mods + untracked pnpm-workspace.yaml).
3. Run `pnpm install`.
4. Run `pnpm db:start` (requires Supabase CLI + Docker).
5. Run Playwright E2E suite.
6. **Respect the "no Milestone 8" declaration** — don't propose
   feature work unless operator explicitly opens v1.1.
7. Verify Codex / CC verifier still functional on a sample GitHub
   import.

---

## Last known reference

| Field | Value |
|---|---|
| `origin/main` tip | `e4de417` Improve GitHub import empty repo guidance |
| Last substantive | `2d18a61` feat(app): ship roadmap through milestone 7 (monolithic) |
| Default branch | `main` |
| Build system | Next.js App Router + TypeScript + **local Supabase stack** + Playwright + pnpm |
| Phases shipped | **Milestone 7 complete** — operator-declared roadmap done |
| Distribution channel | **Local-only currently**; deployment posture pending operator decision |
| Distinguishing tech | **Local Supabase stack** (CLI + Docker, `pnpm db:start`) + Codex / CC verifier + GitHub import guard + monolithic feat commit |
| Migration state | No `legacy-origin` remote |
| Distinguishing feature | **Tenth static-host cluster member; second SSR+Supabase sub-shape member with local Supabase posture distinct from Premise's cloud Supabase. Operator-declared "no Milestone 8" — rare clean done signal.** Fourth member with monolithic feat commit pattern. Codex / CC verifier in canonical repo (novel agent-guardrail pattern). |
