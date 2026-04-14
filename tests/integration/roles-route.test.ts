import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerMock,
  createClientMock,
  createRoleVariantMock,
  updateRoleVariantMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  createRoleVariantMock: vi.fn(),
  updateRoleVariantMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/roles/mutations", () => ({
  createRoleVariant: createRoleVariantMock,
  updateRoleVariant: updateRoleVariantMock,
}));

import { POST } from "@/app/api/roles/route";
import { PATCH } from "@/app/api/roles/[id]/route";

describe("role routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated role creation", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/roles", {
        method: "POST",
        body: JSON.stringify({ name: "Platform lead" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("creates a role variant", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    createRoleVariantMock.mockResolvedValue({
      id: "role-1",
      user_id: "user-1",
      name: "Platform lead",
      target_title: null,
      job_description_raw: null,
      notes: null,
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/roles", {
        method: "POST",
        body: JSON.stringify({ name: "Platform lead" }),
      }),
    );
    const payload = (await response.json()) as { role: { id: string } };

    expect(response.status).toBe(201);
    expect(payload.role.id).toBe("role-1");
  });

  it("updates a role variant", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    updateRoleVariantMock.mockResolvedValue({
      id: "role-1",
      user_id: "user-1",
      name: "Updated role",
      target_title: "Staff engineer",
      job_description_raw: null,
      notes: null,
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost/api/roles/role-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated role" }),
      }),
      {
        params: Promise.resolve({ id: "role-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateRoleVariantMock).toHaveBeenCalledWith(
      {},
      "user-1",
      "role-1",
      expect.objectContaining({ name: "Updated role" }),
    );
  });
});
