import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/tests/fixtures/fake-supabase";
import { getReviewCycleSummary } from "@/lib/review-cycle/queries";
import type { Database } from "@/types/database";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type RoleVariantRow = Database["public"]["Tables"]["role_variants"]["Row"];
type ResumeBulletRow = Database["public"]["Tables"]["resume_bullets"]["Row"];
type ChangelogEntryRow = Database["public"]["Tables"]["changelog_entries"]["Row"];
type ExportRow = Database["public"]["Tables"]["exports"]["Row"];

const userId = "user-1";
const now = new Date("2026-04-14T12:00:00.000Z");

function makeEvidenceRow(overrides: Partial<EvidenceRow>): EvidenceRow {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    type: "manual_note",
    title: "Evidence",
    raw_input: "Evidence",
    factual_summary: null,
    time_start: null,
    time_end: null,
    source_system: "manual",
    source_external_id: null,
    source_url: null,
    project_name: "Platform",
    visibility_default: "private",
    proof_strength: "strong",
    verification_status: "approved",
    approval_status: "approved_private",
    ai_structured_payload: {},
    metadata: {},
    created_at: "2026-04-14T00:00:00.000Z",
    updated_at: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

const role: RoleVariantRow = {
  id: "role-1",
  user_id: userId,
  name: "Staff platform engineer",
  target_title: "Platform lead",
  job_description_raw: null,
  notes: null,
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

const resumeBullet: ResumeBulletRow = {
  id: "bullet-1",
  user_id: userId,
  role_variant_id: role.id,
  draft_text: "Trusted systems delivery.",
  claim_type: "fact_backed",
  proof_strength: "strong",
  approval_status: "approved_private",
  is_user_edited: false,
  generation_metadata: {},
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

const monthlyEntry: ChangelogEntryRow = {
  id: "month-1",
  user_id: userId,
  period_type: "monthly",
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  title: "April changelog",
  body: "## Highlights\n- Trusted work.",
  visibility: "private",
  approval_status: "approved_private",
  is_user_edited: false,
  generation_metadata: {},
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

const quarterlyEntry: ChangelogEntryRow = {
  id: "quarter-1",
  user_id: userId,
  period_type: "quarterly",
  period_start: "2026-04-01",
  period_end: "2026-06-30",
  title: "Q2 changelog",
  body: "## Highlights\n- Trusted quarter.",
  visibility: "private",
  approval_status: "approved_private",
  is_user_edited: false,
  generation_metadata: {},
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

describe("review cycle queries", () => {
  it("summarizes backlog, current period coverage, and next step", async () => {
    const exports: ExportRow[] = [
      {
        id: "export-1",
        user_id: userId,
        target_type: "resume_bullets",
        target_id: role.id,
        format: "markdown",
        content: "# Resume export",
        status: "ready",
        created_at: "2026-04-14T00:00:00.000Z",
      },
    ];
    const supabase = createFakeSupabase({
      evidence_items: [
        makeEvidenceRow({
          id: "approved-month",
          time_start: "2026-04-11T09:00:00.000Z",
          time_end: "2026-04-12T09:00:00.000Z",
        }),
        makeEvidenceRow({
          id: "unreviewed",
          verification_status: "unreviewed",
          approval_status: "draft",
        }),
      ],
      role_variants: [role],
      resume_bullets: [resumeBullet],
      changelog_entries: [monthlyEntry, quarterlyEntry],
      exports,
    });

    const summary = await getReviewCycleSummary(supabase, userId, now);

    expect(summary.reviewBacklog.unreviewedCount).toBe(1);
    expect(summary.evidenceMomentum.approvedThisMonth).toBe(1);
    expect(summary.resumeCoverage.approvedRoleSetCount).toBe(1);
    expect(summary.changelogCoverage.month.approvalStatus).toBe("approved_private");
    expect(summary.nextStep.title).toBe("Review unreviewed evidence");
  });
});
