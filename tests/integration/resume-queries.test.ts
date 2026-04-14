import { describe, expect, it } from "vitest";
import { EvidenceError } from "@/lib/evidence/errors";
import {
  getApprovedEvidenceSelection,
  listApprovedEvidenceSuggestions,
  listResumeBulletsForRoleVariant,
} from "@/lib/resume/queries";
import type { RoleVariantRecord } from "@/lib/roles/queries";
import { createFakeSupabase } from "@/tests/fixtures/fake-supabase";
import type { Database } from "@/types/database";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type ResumeBulletRow = Database["public"]["Tables"]["resume_bullets"]["Row"];
type ResumeBulletEvidenceRow =
  Database["public"]["Tables"]["resume_bullet_evidence"]["Row"];

const userId = "00000000-0000-0000-0000-000000000001";

const role: RoleVariantRecord = {
  id: "00000000-0000-0000-0000-000000000201",
  user_id: userId,
  name: "Staff platform engineer",
  target_title: "Platform lead",
  job_description_raw: "Developer platform, reliability, and API quality.",
  notes: "Evidence should emphasize delivery and backend scope.",
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

function makeEvidenceRow(overrides: Partial<EvidenceRow>): EvidenceRow {
  return {
    id: "00000000-0000-0000-0000-000000000101",
    user_id: userId,
    type: "manual_note",
    title: "Evidence record",
    raw_input: "Evidence details",
    factual_summary: null,
    time_start: null,
    time_end: null,
    source_system: "manual",
    source_external_id: null,
    source_url: null,
    project_name: null,
    visibility_default: "private",
    proof_strength: "strong",
    verification_status: "approved",
    approval_status: "approved_private",
    ai_structured_payload: {},
    metadata: {},
    created_at: "2026-04-10T12:00:00.000Z",
    updated_at: "2026-04-10T12:00:00.000Z",
    ...overrides,
  };
}

const evidenceRows: EvidenceRow[] = [
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000101",
    title: "Improved platform API quality",
    factual_summary: "Shipped reliability improvements for the developer platform.",
    project_name: "Platform",
    ai_structured_payload: {
      role_relevance: ["developer platform", "reliability"],
    },
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000102",
    title: "Recently approved launch milestone",
    project_name: "Launch",
    updated_at: "2026-04-13T12:00:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000103",
    title: "Still unreviewed draft",
    verification_status: "structured",
    approval_status: "draft",
  }),
];

const resumeBullets: ResumeBulletRow[] = [
  {
    id: "00000000-0000-0000-0000-000000000301",
    user_id: userId,
    role_variant_id: role.id,
    draft_text: "Drafted bullet",
    claim_type: "fact_backed",
    proof_strength: "moderate",
    approval_status: "draft",
    is_user_edited: false,
    generation_metadata: {},
    created_at: "2026-04-14T00:00:00.000Z",
    updated_at: "2026-04-14T00:00:00.000Z",
  },
];

const resumeBulletEvidence: ResumeBulletEvidenceRow[] = [
  {
    resume_bullet_id: "00000000-0000-0000-0000-000000000301",
    evidence_item_id: "00000000-0000-0000-0000-000000000101",
  },
];

describe("resume queries", () => {
  it("suggests only approved evidence and keeps a recent-approved fallback", async () => {
    const supabase = createFakeSupabase({
      evidence_items: evidenceRows,
    });

    const result = await listApprovedEvidenceSuggestions(supabase, userId, role);

    expect(result.suggested.map((row) => row.id)).toEqual([
      "00000000-0000-0000-0000-000000000101",
    ]);
    expect(result.recentApproved.map((row) => row.id)).toContain(
      "00000000-0000-0000-0000-000000000102",
    );
    expect(result.suggested.find((row) => row.id === "00000000-0000-0000-0000-000000000103")).toBeUndefined();
  });

  it("rejects evidence selections that include unapproved rows", async () => {
    const supabase = createFakeSupabase({
      evidence_items: evidenceRows,
    });

    await expect(
      getApprovedEvidenceSelection(supabase, userId, [
        "00000000-0000-0000-0000-000000000103",
      ]),
    ).rejects.toMatchObject({
      message: "Resume generation rejects unapproved evidence.",
      status: 409,
    } satisfies Pick<EvidenceError, "message" | "status">);
  });

  it("loads drafted bullets with supporting evidence provenance", async () => {
    const supabase = createFakeSupabase({
      evidence_items: evidenceRows,
      resume_bullets: resumeBullets,
      resume_bullet_evidence: resumeBulletEvidence,
    });

    const bullets = await listResumeBulletsForRoleVariant(supabase, userId, role.id);

    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000301",
      supportingEvidence: [
        expect.objectContaining({
          id: "00000000-0000-0000-0000-000000000101",
          title: "Improved platform API quality",
        }),
      ],
    });
  });
});
