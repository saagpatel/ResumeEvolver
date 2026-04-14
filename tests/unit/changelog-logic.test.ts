import { describe, expect, it } from "vitest";
import {
  getChangelogVisibilityForApprovalStatus,
  resolveChangelogPeriod,
} from "@/lib/changelog/contracts";
import {
  canPublishChangelogEntryPublicly,
  renderChangelogBody,
} from "@/lib/changelog/mutations";
import {
  getEffectiveEvidenceDate,
  isEvidenceInsidePeriod,
} from "@/lib/changelog/queries";

describe("changelog drafting domain logic", () => {
  it("resolves monthly and quarterly periods from aligned period starts", () => {
    expect(resolveChangelogPeriod("monthly", "2026-04-01")).toEqual({
      periodType: "monthly",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
    });

    expect(resolveChangelogPeriod("quarterly", "2026-04-01")).toEqual({
      periodType: "quarterly",
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
    });
  });

  it("rejects misaligned quarterly periods", () => {
    expect(() =>
      resolveChangelogPeriod("quarterly", "2026-05-01"),
    ).toThrowError(/Quarterly periods must start/i);
  });

  it("uses time_end, then time_start, then created_at as the effective evidence date", () => {
    expect(
      getEffectiveEvidenceDate({
        time_end: "2026-04-12T19:00:00.000Z",
        time_start: "2026-04-10T19:00:00.000Z",
        created_at: "2026-04-01T19:00:00.000Z",
      }),
    ).toBe("2026-04-12");

    expect(
      getEffectiveEvidenceDate({
        time_end: null,
        time_start: "2026-04-10T19:00:00.000Z",
        created_at: "2026-04-01T19:00:00.000Z",
      }),
    ).toBe("2026-04-10");
  });

  it("checks whether effective evidence dates fall inside the selected period", () => {
    const period = resolveChangelogPeriod("monthly", "2026-04-01");

    expect(isEvidenceInsidePeriod("2026-04-18", period)).toBe(true);
    expect(isEvidenceInsidePeriod("2026-05-01", period)).toBe(false);
  });

  it("derives changelog visibility from approval status", () => {
    expect(getChangelogVisibilityForApprovalStatus("approved_public_safe")).toBe(
      "public_safe",
    );
    expect(getChangelogVisibilityForApprovalStatus("approved_private")).toBe(
      "private",
    );
  });

  it("renders structured sections into markdown-compatible body text", () => {
    expect(
      renderChangelogBody([
        {
          heading: "Highlights",
          bullets: ["Shipped approved work.", "Kept claims evidence-backed."],
        },
      ]),
    ).toBe(
      "## Highlights\n- Shipped approved work.\n- Kept claims evidence-backed.",
    );
  });

  it("only allows public-safe publication when all linked evidence is public-safe", () => {
    expect(
      canPublishChangelogEntryPublicly([
        { approvalStatus: "approved_public_safe" },
        { approvalStatus: "approved_public_safe" },
      ]),
    ).toBe(true);

    expect(
      canPublishChangelogEntryPublicly([
        { approvalStatus: "approved_public_safe" },
        { approvalStatus: "approved_private" },
      ]),
    ).toBe(false);
  });
});
