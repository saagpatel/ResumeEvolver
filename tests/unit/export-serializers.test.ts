import { describe, expect, it } from "vitest";
import { serializeChangelogEntry, serializeEvidenceSnapshot, serializeResumeBullets } from "@/lib/exports/serialize";
import type { RoleVariantRecord } from "@/lib/roles/queries";
import type { ResumeBulletRecord } from "@/lib/resume/queries";
import type { ChangelogEntryRecord } from "@/lib/changelog/queries";

const role: RoleVariantRecord = {
  id: "00000000-0000-0000-0000-000000000201",
  user_id: "user-1",
  name: "Staff platform engineer",
  target_title: "Platform lead",
  job_description_raw: null,
  notes: "Emphasize trusted delivery.",
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

const resumeBullets: ResumeBulletRecord[] = [
  {
    id: "bullet-1",
    user_id: "user-1",
    role_variant_id: role.id,
    draft_text: "Built evidence-first platform workflows.",
    claim_type: "fact_backed",
    proof_strength: "strong",
    approval_status: "approved_private",
    is_user_edited: false,
    generation_metadata: {},
    created_at: "2026-04-14T00:00:00.000Z",
    updated_at: "2026-04-14T00:00:00.000Z",
    supportingEvidence: [
      {
        id: "evidence-1",
        title: "Platform delivery",
        type: "manual_note",
        projectName: "Platform",
        proofStrength: "strong",
        sourceSystem: "manual",
        approvalStatus: "approved_private",
      },
    ],
  },
];

const changelogEntry: ChangelogEntryRecord = {
  id: "entry-1",
  user_id: "user-1",
  period_type: "monthly",
  period_start: "2026-04-01",
  period_end: "2026-04-30",
  title: "April changelog",
  body: "## Highlights\n- Shipped trusted work.",
  visibility: "private",
  approval_status: "approved_private",
  is_user_edited: false,
  generation_metadata: {},
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
  supportingEvidence: [
    {
      id: "evidence-1",
      title: "Platform delivery",
      type: "manual_note",
      projectName: "Platform",
      proofStrength: "strong",
      sourceSystem: "manual",
      approvalStatus: "approved_private",
    },
  ],
};

describe("export serializers", () => {
  it("renders resume markdown with provenance", () => {
    const content = serializeResumeBullets(role, resumeBullets, "markdown");

    expect(content).toContain("# Resume bullets for Staff platform engineer");
    expect(content).toContain("Built evidence-first platform workflows.");
    expect(content).toContain("[evidence-1] Platform delivery");
  });

  it("renders changelog text with provenance footer", () => {
    const content = serializeChangelogEntry(changelogEntry, "text");

    expect(content).toContain("April changelog");
    expect(content).toContain("Shipped trusted work.");
    expect(content).toContain("Provenance:");
  });

  it("renders evidence snapshot json with count and records", () => {
    const content = serializeEvidenceSnapshot([
      {
        id: "evidence-1",
        type: "manual_note",
        title: "Platform delivery",
        rawInput: "Source of truth",
        factualSummary: null,
        timeStart: null,
        timeEnd: null,
        sourceSystem: "manual",
        sourceExternalId: null,
        sourceUrl: null,
        projectName: "Platform",
        visibilityDefault: "private",
        proofStrength: "strong",
        verificationStatus: "approved",
        approvalStatus: "approved_private",
        aiStructuredPayload: {},
        metadata: {},
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        links: [],
      },
    ]);
    const parsed = JSON.parse(content) as {
      evidenceCount: number;
      evidence: Array<{ id: string; rawInput: string }>;
    };

    expect(parsed.evidenceCount).toBe(1);
    expect(parsed.evidence[0]).toMatchObject({
      id: "evidence-1",
      rawInput: "Source of truth",
    });
  });
});
