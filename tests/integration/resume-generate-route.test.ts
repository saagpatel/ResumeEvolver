import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerMock,
  createClientMock,
  getRoleVariantByIdMock,
  getApprovedEvidenceSelectionMock,
  generateResumeBulletsMock,
  replaceGeneratedResumeBulletsMock,
  listResumeBulletsForRoleVariantMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  getRoleVariantByIdMock: vi.fn(),
  getApprovedEvidenceSelectionMock: vi.fn(),
  generateResumeBulletsMock: vi.fn(),
  replaceGeneratedResumeBulletsMock: vi.fn(),
  listResumeBulletsForRoleVariantMock: vi.fn(),
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
  getApprovedEvidenceSelection: getApprovedEvidenceSelectionMock,
  listResumeBulletsForRoleVariant: listResumeBulletsForRoleVariantMock,
}));

vi.mock("@/lib/resume/generate", async () => {
  return {
    generateResumeBullets: generateResumeBulletsMock,
    getResumeGenerationModel: vi.fn(() => "test-resume-model"),
  };
});

vi.mock("@/lib/resume/mutations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/resume/mutations")>(
    "@/lib/resume/mutations",
  );

  return {
    ...actual,
    replaceGeneratedResumeBullets: replaceGeneratedResumeBulletsMock,
  };
});

import { POST } from "@/app/api/resume/generate/route";

const roleVariantId = "00000000-0000-0000-0000-000000000000";
const evidenceId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

describe("POST /api/resume/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated generation requests", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/resume/generate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns drafted bullets on success", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getRoleVariantByIdMock.mockResolvedValue({
      id: roleVariantId,
      user_id: "user-1",
      name: "Platform lead",
      target_title: null,
      job_description_raw: null,
      notes: null,
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    });
    getApprovedEvidenceSelectionMock.mockResolvedValue([
      {
        id: evidenceId,
        type: "manual_note",
        title: "Approved evidence",
        raw_input: "Approved evidence body",
        factual_summary: "Approved summary",
        project_name: "Platform",
        proof_strength: "strong",
        source_system: "manual",
        source_url: null,
        time_start: null,
        time_end: null,
        approval_status: "approved_private",
        verification_status: "approved",
        ai_structured_payload: {},
        roleRelevance: [],
      },
    ]);
    generateResumeBulletsMock.mockResolvedValue({
      bullets: [
        {
          draftText: "Built platform tooling with measurable delivery impact.",
          claimType: "fact_backed",
          supportingEvidenceIds: [evidenceId],
        },
      ],
    });
    listResumeBulletsForRoleVariantMock.mockResolvedValue([
      {
        id: "bullet-1",
        user_id: "user-1",
        role_variant_id: roleVariantId,
        draft_text: "Built platform tooling with measurable delivery impact.",
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
      new Request("http://localhost/api/resume/generate", {
        method: "POST",
        body: JSON.stringify({
          roleVariantId,
          evidenceIds: [evidenceId],
        }),
      }),
    );
    const payload = (await response.json()) as {
      bullets: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.bullets[0].id).toBe("bullet-1");
    expect(replaceGeneratedResumeBulletsMock).toHaveBeenCalled();
  });

  it("fails closed when the model references evidence outside the confirmed selection", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getRoleVariantByIdMock.mockResolvedValue({
      id: roleVariantId,
      user_id: "user-1",
      name: "Platform lead",
      target_title: null,
      job_description_raw: null,
      notes: null,
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    });
    getApprovedEvidenceSelectionMock.mockResolvedValue([
      {
        id: evidenceId,
        type: "manual_note",
        title: "Approved evidence",
        raw_input: "Approved evidence body",
        factual_summary: "Approved summary",
        project_name: "Platform",
        proof_strength: "strong",
        source_system: "manual",
        source_url: null,
        time_start: null,
        time_end: null,
        approval_status: "approved_private",
        verification_status: "approved",
        ai_structured_payload: {},
        roleRelevance: [],
      },
    ]);
    generateResumeBulletsMock.mockResolvedValue({
      bullets: [
        {
          draftText: "Invented unsupported evidence linkage.",
          claimType: "fact_backed",
          supportingEvidenceIds: ["00000000-0000-0000-0000-000000000999"],
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/resume/generate", {
        method: "POST",
        body: JSON.stringify({
          roleVariantId,
          evidenceIds: [evidenceId],
        }),
      }),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(payload.error).toMatch(/outside the confirmed selection/i);
    expect(replaceGeneratedResumeBulletsMock).not.toHaveBeenCalled();
  });
});
