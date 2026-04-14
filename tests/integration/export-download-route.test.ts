import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerMock,
  createClientMock,
  getExportByIdMock,
  getExportHistoryRecordByIdMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  getExportByIdMock: vi.fn(),
  getExportHistoryRecordByIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/exports/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/exports/queries")>(
    "@/lib/exports/queries",
  );

  return {
    ...actual,
    getExportById: getExportByIdMock,
    getExportHistoryRecordById: getExportHistoryRecordByIdMock,
  };
});

import { GET } from "@/app/api/exports/[id]/route";

describe("GET /api/exports/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated export downloads", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/exports/export-1"), {
      params: Promise.resolve({ id: "export-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the export is missing", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getExportByIdMock.mockResolvedValue(null);
    getExportHistoryRecordByIdMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/exports/export-1"), {
      params: Promise.resolve({ id: "export-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns saved export content with attachment headers", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getExportByIdMock.mockResolvedValue({
      id: "export-1",
      user_id: "user-1",
      target_type: "resume_bullets",
      target_id: "role-1",
      format: "markdown",
      content: "# Resume export",
      status: "ready",
      created_at: "2026-04-14T00:00:00.000Z",
    });
    getExportHistoryRecordByIdMock.mockResolvedValue({
      id: "export-1",
      targetType: "resume_bullets",
      targetId: "role-1",
      format: "markdown",
      status: "ready",
      createdAt: "2026-04-14T00:00:00.000Z",
      targetLabel: "Staff platform engineer",
      targetSummary: "Platform lead",
      fileName: "resume-bullets-staff-platform-engineer-2026-04-14.md",
    });

    const response = await GET(new Request("http://localhost/api/exports/export-1"), {
      params: Promise.resolve({ id: "export-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Resume export");
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="resume-bullets-staff-platform-engineer-2026-04-14.md"',
    );
  });
});
