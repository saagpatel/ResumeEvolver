import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerMock,
  createClientMock,
  updateResumeBulletMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  updateResumeBulletMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/resume/mutations", () => ({
  updateResumeBullet: updateResumeBulletMock,
}));

import { PATCH } from "@/app/api/resume/bullets/[id]/route";

describe("PATCH /api/resume/bullets/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated bullet updates", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/resume/bullets/bullet-1", {
        method: "PATCH",
        body: JSON.stringify({ draftText: "Updated bullet" }),
      }),
      {
        params: Promise.resolve({ id: "bullet-1" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("updates a resume bullet", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    updateResumeBulletMock.mockResolvedValue({
      id: "bullet-1",
      user_id: "user-1",
      role_variant_id: "role-1",
      draft_text: "Updated bullet",
      claim_type: "fact_backed",
      proof_strength: "strong",
      approval_status: "approved_private",
      is_user_edited: true,
      generation_metadata: {},
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
      supportingEvidence: [],
    });

    const response = await PATCH(
      new Request("http://localhost/api/resume/bullets/bullet-1", {
        method: "PATCH",
        body: JSON.stringify({
          draftText: "Updated bullet",
          approvalStatus: "approved_private",
        }),
      }),
      {
        params: Promise.resolve({ id: "bullet-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateResumeBulletMock).toHaveBeenCalledWith(
      {},
      "user-1",
      "bullet-1",
      {
        draftText: "Updated bullet",
        approvalStatus: "approved_private",
      },
    );
  });
});
