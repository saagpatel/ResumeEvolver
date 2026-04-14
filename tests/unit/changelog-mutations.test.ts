import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceError } from "@/lib/evidence/errors";

const { getChangelogEntryByIdMock } = vi.hoisted(() => ({
  getChangelogEntryByIdMock: vi.fn(),
}));

vi.mock("@/lib/changelog/queries", () => ({
  getChangelogEntryById: getChangelogEntryByIdMock,
}));

import { updateChangelogEntry } from "@/lib/changelog/mutations";

describe("changelog mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects public-safe approval when linked evidence is not all public-safe", async () => {
    getChangelogEntryByIdMock.mockResolvedValue({
      id: "entry-1",
      user_id: "user-1",
      period_type: "monthly",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      title: "April changelog",
      body: "Body",
      visibility: "private",
      approval_status: "draft",
      is_user_edited: false,
      generation_metadata: {},
      created_at: "2026-04-14T00:00:00.000Z",
      updated_at: "2026-04-14T00:00:00.000Z",
      supportingEvidence: [
        {
          id: "evidence-1",
          title: "Private evidence",
          type: "manual_note",
          projectName: "Platform",
          proofStrength: "strong",
          sourceSystem: "manual",
          approvalStatus: "approved_private",
        },
      ],
    });

    await expect(
      updateChangelogEntry({} as never, "user-1", "entry-1", {
        approvalStatus: "approved_public_safe",
      }),
    ).rejects.toThrowError(EvidenceError);
  });
});
