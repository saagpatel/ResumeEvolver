import { describe, expect, it } from "vitest";
import { EvidenceError } from "@/lib/evidence/errors";
import { deriveResumeBulletProofStrength, validateGeneratedResumeBullets } from "@/lib/resume/mutations";
import { scoreRoleEvidenceMatch } from "@/lib/resume/queries";
import type { RoleVariantRecord } from "@/lib/roles/queries";
import type { Database } from "@/types/database";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];

const role: RoleVariantRecord = {
  id: "00000000-0000-0000-0000-000000000201",
  user_id: "00000000-0000-0000-0000-000000000001",
  name: "Staff platform engineer",
  target_title: "Platform lead",
  job_description_raw: "Developer platform, reliability, and API quality.",
  notes: "Proven delivery across backend and tooling work.",
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

const evidence = {
  id: "00000000-0000-0000-0000-000000000101",
  type: "manual_note",
  title: "Improved platform API quality",
  factual_summary: "Shipped reliability improvements for the developer platform.",
  project_name: "Platform",
  proof_strength: "strong",
  source_system: "manual",
  approval_status: "approved_private",
  verification_status: "approved",
  updated_at: "2026-04-14T00:00:00.000Z",
  created_at: "2026-04-14T00:00:00.000Z",
  ai_structured_payload: {
    role_relevance: ["developer platform", "api quality"],
  },
} satisfies Pick<
  EvidenceRow,
  | "id"
  | "type"
  | "title"
  | "factual_summary"
  | "project_name"
  | "proof_strength"
  | "source_system"
  | "approval_status"
  | "verification_status"
  | "updated_at"
  | "created_at"
  | "ai_structured_payload"
>;

describe("resume drafting domain logic", () => {
  it("scores role-evidence overlap across titles, projects, and relevance", () => {
    const score = scoreRoleEvidenceMatch(role, evidence);

    expect(score.matchScore).toBeGreaterThan(0);
    expect(score.matchedTerms).toContain("platform");
  });

  it("derives the weakest linked proof strength", () => {
    expect(
      deriveResumeBulletProofStrength([
        { proof_strength: "strong" },
        { proof_strength: "moderate" },
      ]),
    ).toBe("moderate");

    expect(
      deriveResumeBulletProofStrength([{ proof_strength: null }]),
    ).toBe("weak");
  });

  it("rejects generated bullets that reference evidence outside the confirmed set", () => {
    expect(() =>
      validateGeneratedResumeBullets(
        [
          {
            draftText: "Strong draft",
            claimType: "fact_backed",
            proofStrength: "strong",
            supportingEvidenceIds: ["00000000-0000-0000-0000-000000000999"],
          },
        ],
        ["00000000-0000-0000-0000-000000000101"],
      ),
    ).toThrowError(EvidenceError);
  });
});
