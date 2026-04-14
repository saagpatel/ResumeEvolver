import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceError } from "@/lib/evidence/errors";

const {
  getViewerMock,
  createClientMock,
  requireGitHubImportTokenMock,
  runGitHubImportMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  requireGitHubImportTokenMock: vi.fn(),
  runGitHubImportMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/github/auth", () => ({
  requireGitHubImportToken: requireGitHubImportTokenMock,
}));

vi.mock("@/lib/github/import", () => ({
  runGitHubImport: runGitHubImportMock,
}));

import { POST } from "@/app/api/evidence/import/github/route";

describe("POST /api/evidence/import/github", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/evidence/import/github", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns reconnect guidance when import capability is missing", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    createClientMock.mockResolvedValue({ from: vi.fn() });
    requireGitHubImportTokenMock.mockRejectedValue(
      new EvidenceError("Reconnect GitHub import access before running an import.", 409),
    );

    const response = await POST(
      new Request("http://localhost/api/evidence/import/github", {
        method: "POST",
        body: JSON.stringify({
          repos: ["openai/resume-evolver-demo"],
          from: "2026-04-01",
          to: "2026-04-15",
        }),
      }),
    );

    expect(response.status).toBe(409);
  });

  it("returns the import summary on success", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    createClientMock.mockResolvedValue({ from: vi.fn() });
    requireGitHubImportTokenMock.mockResolvedValue({
      providerToken: "token",
      grantedScopes: ["read:user"],
    });
    runGitHubImportMock.mockResolvedValue({
      status: "success",
      repos: [],
      totals: {
        created: 1,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        failed: 0,
      },
      warnings: [],
    });

    const response = await POST(
      new Request("http://localhost/api/evidence/import/github", {
        method: "POST",
        body: JSON.stringify({
          repos: ["openai/resume-evolver-demo"],
          from: "2026-04-01",
          to: "2026-04-15",
        }),
      }),
    );
    const payload = (await response.json()) as { summary: { status: string } };

    expect(response.status).toBe(200);
    expect(payload.summary.status).toBe("success");
    expect(runGitHubImportMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "token",
      expect.objectContaining({
        repos: ["openai/resume-evolver-demo"],
      }),
    );
  });
});
