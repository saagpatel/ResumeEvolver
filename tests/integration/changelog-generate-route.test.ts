import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceError } from "@/lib/evidence/errors";

const {
  getViewerMock,
  createClientMock,
  getApprovedEvidenceSelectionForPeriodMock,
  generateChangelogDraftMock,
  upsertGeneratedChangelogEntryMock,
  getChangelogEntryByIdMock,
} = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  createClientMock: vi.fn(),
  getApprovedEvidenceSelectionForPeriodMock: vi.fn(),
  generateChangelogDraftMock: vi.fn(),
  upsertGeneratedChangelogEntryMock: vi.fn(),
  getChangelogEntryByIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: getViewerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/changelog/queries", () => ({
  getApprovedEvidenceSelectionForPeriod: getApprovedEvidenceSelectionForPeriodMock,
  getChangelogEntryById: getChangelogEntryByIdMock,
}));

vi.mock("@/lib/changelog/generate", async () => {
  return {
    generateChangelogDraft: generateChangelogDraftMock,
    getChangelogGenerationModel: vi.fn(() => "test-changelog-model"),
  };
});

vi.mock("@/lib/changelog/mutations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/changelog/mutations")>(
    "@/lib/changelog/mutations",
  );

  return {
    ...actual,
    upsertGeneratedChangelogEntry: upsertGeneratedChangelogEntryMock,
  };
});

import { POST } from "@/app/api/changelog/generate/route";

const evidenceId = "ffffffff-ffff-ffff-ffff-ffffffffffff";

describe("POST /api/changelog/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
  });

  it("rejects unauthenticated changelog generation requests", async () => {
    getViewerMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/changelog/generate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns a drafted changelog entry on success", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getApprovedEvidenceSelectionForPeriodMock.mockResolvedValue([
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
        created_at: "2026-04-14T00:00:00.000Z",
        effectiveDate: "2026-04-14",
      },
    ]);
    generateChangelogDraftMock.mockResolvedValue({
      title: "April changelog",
      sections: [{ heading: "Highlights", bullets: ["Shipped trusted work."] }],
    });
    upsertGeneratedChangelogEntryMock.mockResolvedValue("entry-1");
    getChangelogEntryByIdMock.mockResolvedValue({
      id: "entry-1",
      user_id: "user-1",
      period_type: "monthly",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      title: "April changelog",
      body: "## Highlights\n- Shipped trusted work.",
      visibility: "private",
      approval_status: "draft",
      is_user_edited: false,
      generation_metadata: {},
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
      supportingEvidence: [],
    });

    const response = await POST(
      new Request("http://localhost/api/changelog/generate", {
        method: "POST",
        body: JSON.stringify({
          periodType: "monthly",
          periodStart: "2026-04-01",
          evidenceIds: [evidenceId],
        }),
      }),
    );
    const payload = (await response.json()) as {
      entry: { id: string };
    };

    expect(response.status).toBe(200);
    expect(payload.entry.id).toBe("entry-1");
    expect(upsertGeneratedChangelogEntryMock).toHaveBeenCalled();
  });

  it("returns conflict when an edited draft blocks regeneration", async () => {
    getViewerMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User",
      githubConnected: true,
    });
    getApprovedEvidenceSelectionForPeriodMock.mockResolvedValue([
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
        created_at: "2026-04-14T00:00:00.000Z",
        effectiveDate: "2026-04-14",
      },
    ]);
    generateChangelogDraftMock.mockResolvedValue({
      title: "April changelog",
      sections: [{ heading: "Highlights", bullets: ["Shipped trusted work."] }],
    });
    upsertGeneratedChangelogEntryMock.mockRejectedValue(
      new EvidenceError("Edited changelog drafts require explicit replaceEdited.", 409),
    );

    const response = await POST(
      new Request("http://localhost/api/changelog/generate", {
        method: "POST",
        body: JSON.stringify({
          periodType: "monthly",
          periodStart: "2026-04-01",
          evidenceIds: [evidenceId],
        }),
      }),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/replaceEdited/i);
  });
});
