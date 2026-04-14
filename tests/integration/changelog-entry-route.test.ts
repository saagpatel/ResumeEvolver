import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerMock,
  createClientMock,
  updateChangelogEntryMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  updateChangelogEntryMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/changelog/mutations", () => ({
  updateChangelogEntry: updateChangelogEntryMock,
}));

import { PATCH } from "@/app/api/changelog/[id]/route";

describe("PATCH /api/changelog/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated changelog updates", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/changelog/entry-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated title" }),
      }),
      {
        params: Promise.resolve({ id: "entry-1" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("updates a changelog entry", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    updateChangelogEntryMock.mockResolvedValue({
      id: "entry-1",
      user_id: "user-1",
      period_type: "monthly",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      title: "Updated title",
      body: "Updated body",
      visibility: "private",
      approval_status: "approved_private",
      is_user_edited: true,
      generation_metadata: {},
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
      supportingEvidence: [],
    });

    const response = await PATCH(
      new Request("http://localhost/api/changelog/entry-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "Updated title",
          body: "Updated body",
          approvalStatus: "approved_private",
        }),
      }),
      {
        params: Promise.resolve({ id: "entry-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateChangelogEntryMock).toHaveBeenCalledWith(
      {},
      "user-1",
      "entry-1",
      {
        title: "Updated title",
        body: "Updated body",
        approvalStatus: "approved_private",
      },
    );
  });
});
