import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/tests/fixtures/fake-supabase";
import { resolveChangelogPeriod } from "@/lib/changelog/contracts";
import {
  getApprovedEvidenceSelectionForPeriod,
  listApprovedEvidenceForPeriod,
} from "@/lib/changelog/queries";
import type { Database } from "@/types/database";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];

const approvedInPeriod: EvidenceRow = {
  id: "00000000-0000-0000-0000-000000000101",
  user_id: "user-1",
  type: "manual_note",
  title: "Approved April work",
  raw_input: "Approved evidence",
  factual_summary: "Approved summary",
  project_name: "Platform",
  source_system: "manual",
  source_external_id: null,
  source_url: null,
  verification_status: "approved",
  approval_status: "approved_private",
  visibility_default: "private",
  proof_strength: "strong",
  metadata: {},
  ai_structured_payload: {},
  created_at: "2026-04-01T10:00:00.000Z",
  updated_at: "2026-04-18T10:00:00.000Z",
  time_start: "2026-04-11T09:00:00.000Z",
  time_end: "2026-04-12T09:00:00.000Z",
};

const approvedOutOfPeriod: EvidenceRow = {
  ...approvedInPeriod,
  id: "00000000-0000-0000-0000-000000000102",
  title: "Approved May work",
  time_start: "2026-05-02T09:00:00.000Z",
  time_end: "2026-05-02T10:00:00.000Z",
};

const unapprovedInPeriod: EvidenceRow = {
  ...approvedInPeriod,
  id: "00000000-0000-0000-0000-000000000103",
  title: "Structured only",
  verification_status: "structured",
  approval_status: "draft",
};

describe("changelog queries", () => {
  it("lists only approved evidence that falls inside the selected period", async () => {
    const supabase = createFakeSupabase({
      evidence_items: [
        approvedInPeriod,
        approvedOutOfPeriod,
        unapprovedInPeriod,
      ],
    });
    const period = resolveChangelogPeriod("monthly", "2026-04-01");

    const result = await listApprovedEvidenceForPeriod(supabase, "user-1", period);

    expect(result.suggested).toHaveLength(1);
    expect(result.suggested[0]?.id).toBe(approvedInPeriod.id);
  });

  it("rejects selected evidence that falls outside the chosen period", async () => {
    const supabase = createFakeSupabase({
      evidence_items: [approvedInPeriod, approvedOutOfPeriod],
    });
    const period = resolveChangelogPeriod("monthly", "2026-04-01");

    await expect(
      getApprovedEvidenceSelectionForPeriod(supabase, "user-1", period, [
        approvedOutOfPeriod.id,
      ]),
    ).rejects.toThrow(/outside the selected period/i);
  });
});
