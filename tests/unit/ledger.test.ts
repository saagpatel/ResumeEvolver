import { describe, expect, it } from "vitest";
import {
  getLedgerStatusLabel,
  hasActiveLedgerFilters,
  isLedgerRecordInDateWindow,
  parseLedgerFilters,
} from "@/lib/evidence/ledger";
import { getLedgerStatus } from "@/lib/evidence/state-machine";

describe("ledger helpers", () => {
  it("parses valid ledger filters and drops invalid values", () => {
    const filters = parseLedgerFilters({
      type: "github_pr",
      ledgerStatus: "approved_public_safe",
      proofStrength: "moderate",
      project: " ResumeEvolver ",
      from: "2026-04-10",
      to: "2026-04-14",
      evidence: "00000000-0000-0000-0000-000000000105",
    });

    expect(filters).toEqual({
      type: "github_pr",
      ledgerStatus: "approved_public_safe",
      proofStrength: "moderate",
      project: "ResumeEvolver",
      from: "2026-04-10",
      to: "2026-04-14",
      evidence: "00000000-0000-0000-0000-000000000105",
    });

    expect(
      parseLedgerFilters({
        type: "not-real",
        ledgerStatus: "invalid",
        proofStrength: "sure",
        from: "04/14/2026",
        to: "tomorrow",
        evidence: "not-a-uuid",
      }),
    ).toEqual({
      evidence: "not-a-uuid",
    });
  });

  it("detects active filters without counting selection-only state", () => {
    expect(hasActiveLedgerFilters({ evidence: "123" })).toBe(false);
    expect(hasActiveLedgerFilters({ project: "ResumeEvolver" })).toBe(true);
  });

  it("derives ledger statuses from evidence state pairs", () => {
    expect(getLedgerStatus("unreviewed", "draft")).toBe("draft_unreviewed");
    expect(getLedgerStatus("structured", "draft")).toBe("draft_structured");
    expect(getLedgerStatus("approved", "approved_private")).toBe(
      "approved_private",
    );
    expect(getLedgerStatus("approved", "draft")).toBeNull();
  });

  it("uses created_at when no explicit time range is present", () => {
    expect(
      isLedgerRecordInDateWindow(
        {
          time_start: null,
          time_end: null,
          created_at: "2026-04-10T08:00:00.000Z",
        },
        { from: "2026-04-10", to: "2026-04-10" },
      ),
    ).toBe(true);

    expect(
      isLedgerRecordInDateWindow(
        {
          time_start: null,
          time_end: null,
          created_at: "2026-04-10T08:00:00.000Z",
        },
        { from: "2026-04-11", to: "2026-04-12" },
      ),
    ).toBe(false);
  });

  it("treats date-window overlap as inclusive", () => {
    expect(
      isLedgerRecordInDateWindow(
        {
          time_start: "2026-04-12T14:00:00.000Z",
          time_end: "2026-04-12T15:00:00.000Z",
          created_at: "2026-04-12T15:30:00.000Z",
        },
        { from: "2026-04-12", to: "2026-04-12" },
      ),
    ).toBe(true);
  });

  it("returns readable labels for valid state pairs", () => {
    expect(getLedgerStatusLabel("approved", "approved_public_safe")).toBe(
      "Approved public-safe",
    );
    expect(getLedgerStatusLabel("approved", "draft")).toBe("Invalid state");
  });
});
