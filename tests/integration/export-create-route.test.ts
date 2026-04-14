import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerMock,
  createClientMock,
  getRoleVariantByIdMock,
  listResumeBulletsForRoleVariantMock,
  getChangelogEntryByIdMock,
  getEvidenceSnapshotSelectionMock,
  createExportMock,
  getExportHistoryRecordByIdMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  getRoleVariantByIdMock: vi.fn(),
  listResumeBulletsForRoleVariantMock: vi.fn(),
  getChangelogEntryByIdMock: vi.fn(),
  getEvidenceSnapshotSelectionMock: vi.fn(),
  createExportMock: vi.fn(),
  getExportHistoryRecordByIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/roles/queries", () => ({
  getRoleVariantById: getRoleVariantByIdMock,
}));

vi.mock("@/lib/resume/queries", () => ({
  listResumeBulletsForRoleVariant: listResumeBulletsForRoleVariantMock,
}));

vi.mock("@/lib/changelog/queries", () => ({
  getChangelogEntryById: getChangelogEntryByIdMock,
}));

vi.mock("@/lib/exports/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/exports/queries")>(
    "@/lib/exports/queries",
  );

  return {
    ...actual,
    getEvidenceSnapshotSelection: getEvidenceSnapshotSelectionMock,
    getExportHistoryRecordById: getExportHistoryRecordByIdMock,
  };
});

vi.mock("@/lib/exports/mutations", () => ({
  createExport: createExportMock,
}));

import { POST } from "@/app/api/exports/route";

describe("POST /api/exports", () => {
  const roleVariantId = "00000000-0000-0000-0000-000000000000";
  const evidenceId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated export requests", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("saves an approved resume export", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getRoleVariantByIdMock.mockResolvedValue({
      id: roleVariantId,
      user_id: "user-1",
      name: "Staff platform engineer",
      target_title: "Platform lead",
      job_description_raw: null,
      notes: null,
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    });
    listResumeBulletsForRoleVariantMock.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000103",
        user_id: "user-1",
        role_variant_id: roleVariantId,
        draft_text: "Built trusted systems.",
        claim_type: "fact_backed",
        proof_strength: "strong",
        approval_status: "approved_private",
        is_user_edited: false,
        generation_metadata: {},
        created_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        supportingEvidence: [],
      },
    ]);
    createExportMock.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000104",
      user_id: "user-1",
      target_type: "resume_bullets",
      target_id: roleVariantId,
      format: "markdown",
      content: "# Resume bullets",
      status: "ready",
      created_at: "2026-04-14T00:00:00.000Z",
    });
    getExportHistoryRecordByIdMock.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000104",
      targetType: "resume_bullets",
      targetId: roleVariantId,
      format: "markdown",
      status: "ready",
      createdAt: "2026-04-14T00:00:00.000Z",
      targetLabel: "Staff platform engineer",
      targetSummary: "Platform lead",
      fileName: "resume-bullets-staff-platform-engineer-2026-04-14.md",
    });

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({
          targetType: "resume_bullets",
          targetId: roleVariantId,
          format: "markdown",
        }),
      }),
    );
    const payload = (await response.json()) as {
      exportRecord: { id: string };
    };

    expect(response.status).toBe(200);
    expect(payload.exportRecord.id).toBe("00000000-0000-0000-0000-000000000104");
    expect(createExportMock).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({
        targetType: "resume_bullets",
        targetId: roleVariantId,
        format: "markdown",
        content: expect.stringContaining("Built trusted systems."),
      }),
    );
  });

  it("fails closed when a resume role has no approved bullets", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getRoleVariantByIdMock.mockResolvedValue({
      id: roleVariantId,
      user_id: "user-1",
      name: "Staff platform engineer",
      target_title: "Platform lead",
      job_description_raw: null,
      notes: null,
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    });
    listResumeBulletsForRoleVariantMock.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000103",
        user_id: "user-1",
        role_variant_id: roleVariantId,
        draft_text: "Still draft.",
        claim_type: "fact_backed",
        proof_strength: "strong",
        approval_status: "draft",
        is_user_edited: false,
        generation_metadata: {},
        created_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        supportingEvidence: [],
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({
          targetType: "resume_bullets",
          targetId: roleVariantId,
          format: "markdown",
        }),
      }),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/approved bullet/i);
    expect(createExportMock).not.toHaveBeenCalled();
  });

  it("saves a JSON evidence snapshot", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getEvidenceSnapshotSelectionMock.mockResolvedValue([
      {
        id: "evidence-1",
        type: "manual_note",
        title: "Snapshot evidence",
        rawInput: "Source",
        factualSummary: null,
        timeStart: null,
        timeEnd: null,
        sourceSystem: "manual",
        sourceExternalId: null,
        sourceUrl: null,
        projectName: null,
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
    createExportMock.mockResolvedValue({
      id: "export-2",
      user_id: "user-1",
      target_type: "evidence_snapshot",
      target_id: null,
      format: "json",
          content: "{}",
          status: "ready",
          created_at: "2026-04-14T00:00:00.000Z",
        });
    getExportHistoryRecordByIdMock.mockResolvedValue({
      id: "export-2",
      targetType: "evidence_snapshot",
      targetId: null,
      format: "json",
      status: "ready",
      createdAt: "2026-04-14T00:00:00.000Z",
      targetLabel: "Evidence snapshot",
      targetSummary: "Selected evidence JSON snapshot",
      fileName: "evidence-snapshot-2026-04-14.json",
    });

    const response = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        body: JSON.stringify({
          targetType: "evidence_snapshot",
          targetId: null,
          format: "json",
          evidenceIds: [evidenceId],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createExportMock).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({
        targetType: "evidence_snapshot",
        targetId: null,
        format: "json",
      }),
    );
  });
});
