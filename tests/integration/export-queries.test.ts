import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/tests/fixtures/fake-supabase";
import {
  getEvidenceSnapshotSelection,
  listExportHistory,
  listEvidenceSnapshotCandidates,
  listExportableResumeTargets,
} from "@/lib/exports/queries";
import type { Database } from "@/types/database";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type RoleVariantRow = Database["public"]["Tables"]["role_variants"]["Row"];
type ResumeBulletRow = Database["public"]["Tables"]["resume_bullets"]["Row"];
type ExportRow = Database["public"]["Tables"]["exports"]["Row"];

const userId = "user-1";

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
  draft_text: "Built trusted systems.",
  claim_type: "fact_backed",
  proof_strength: "strong",
  approval_status: "approved_private",
  is_user_edited: false,
  generation_metadata: {},
  created_at: "2026-04-14T00:00:00.000Z",
  updated_at: "2026-04-14T00:00:00.000Z",
};

const evidenceRow: EvidenceRow = {
  id: "evidence-1",
  user_id: userId,
  type: "manual_note",
  title: "Evidence record",
  raw_input: "Source of truth",
  factual_summary: "Summary",
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
};

const exportRow: ExportRow = {
  id: "export-1",
  user_id: userId,
  target_type: "resume_bullets",
  target_id: role.id,
  format: "markdown",
  content: "# Resume export",
  status: "ready",
  created_at: "2026-04-14T00:00:00.000Z",
};

describe("export queries", () => {
  it("lists exportable role targets with approved bullet counts", async () => {
    const supabase = createFakeSupabase({
      role_variants: [role],
      resume_bullets: [resumeBullet],
    });

    const targets = await listExportableResumeTargets(supabase, userId);

    expect(targets).toEqual([
      {
        roleVariantId: "role-1",
        roleName: "Staff platform engineer",
        targetTitle: "Platform lead",
        approvedBulletCount: 1,
        latestApprovedAt: "2026-04-14T00:00:00.000Z",
      },
    ]);
  });

  it("loads selected evidence for a snapshot export", async () => {
    const supabase = createFakeSupabase({
      evidence_items: [evidenceRow],
      evidence_links: [
        {
          id: "link-1",
          evidence_item_id: "evidence-1",
          label: "Project link",
          url: "https://example.com",
          link_type: "project",
          created_at: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    const evidence = await getEvidenceSnapshotSelection(supabase, userId, [
      "evidence-1",
    ]);

    expect(evidence[0]).toMatchObject({
      id: "evidence-1",
      rawInput: "Source of truth",
      links: [{ label: "Project link", url: "https://example.com" }],
    });
  });

  it("surfaces up to 100 recent evidence rows for snapshot selection", async () => {
    const evidenceItems = Array.from({ length: 120 }, (_, index) => ({
      ...evidenceRow,
      id: `evidence-${index + 1}`,
      title: `Evidence record ${index + 1}`,
      updated_at: `2026-04-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    const supabase = createFakeSupabase({
      evidence_items: evidenceItems,
    });

    const candidates = await listEvidenceSnapshotCandidates(supabase, userId);

    expect(candidates).toHaveLength(100);
  });

  it("resolves saved export history labels without extra metadata columns", async () => {
    const supabase = createFakeSupabase({
      exports: [exportRow],
      role_variants: [role],
    });

    const history = await listExportHistory(supabase, userId);

    expect(history[0]).toMatchObject({
      id: "export-1",
      targetLabel: "Staff platform engineer",
      targetSummary: "Platform lead",
      fileName: "resume-bullets-staff-platform-engineer-2026-04-14.md",
    });
  });
});
