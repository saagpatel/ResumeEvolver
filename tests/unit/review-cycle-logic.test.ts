import { describe, expect, it } from "vitest";
import { determineReviewCycleNextStep } from "@/lib/review-cycle/queries";

describe("review cycle next-step logic", () => {
  it("prioritizes unreviewed backlog first", () => {
    expect(
      determineReviewCycleNextStep({
        unreviewedCount: 2,
        structuredDecisionCount: 0,
        monthApprovalStatus: "approved_private",
        quarterApprovalStatus: "approved_private",
        approvedRoleSetCount: 1,
        resumeBulletsExportedAt: null,
        changelogEntryExportedAt: null,
      }).title,
    ).toBe("Review unreviewed evidence");
  });

  it("prioritizes current-period changelog before export freshness", () => {
    expect(
      determineReviewCycleNextStep({
        unreviewedCount: 0,
        structuredDecisionCount: 0,
        monthApprovalStatus: "draft",
        quarterApprovalStatus: "approved_private",
        approvedRoleSetCount: 1,
        resumeBulletsExportedAt: null,
        changelogEntryExportedAt: null,
      }).title,
    ).toBe("Finish this month's changelog");
  });

  it("recommends exports only after backlog and drafting are current", () => {
    expect(
      determineReviewCycleNextStep({
        unreviewedCount: 0,
        structuredDecisionCount: 0,
        monthApprovalStatus: "approved_private",
        quarterApprovalStatus: "approved_private",
        approvedRoleSetCount: 1,
        resumeBulletsExportedAt: null,
        changelogEntryExportedAt: null,
      }).title,
    ).toBe("Create fresh exports");
  });
});
