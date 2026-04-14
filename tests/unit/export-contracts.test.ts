import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  buildExportFilename,
  isFormatAllowedForTarget,
  parseExportCreateRequest,
} from "@/lib/exports/contracts";

const idOne = "00000000-0000-0000-0000-000000000000";
const idTwo = "ffffffff-ffff-ffff-ffff-ffffffffffff";

describe("export contracts", () => {
  it("deduplicates evidence ids for snapshot exports", () => {
    const parsed = parseExportCreateRequest({
      targetType: "evidence_snapshot",
      targetId: null,
      format: "json",
      evidenceIds: [idOne, idOne, idTwo],
    });

    expect(parsed).toEqual({
      targetType: "evidence_snapshot",
      targetId: null,
      format: "json",
      evidenceIds: [idOne, idTwo],
    });
  });

  it("rejects unsupported target and format combinations", () => {
    expect(isFormatAllowedForTarget("evidence_snapshot", "markdown")).toBe(false);
    expect(() =>
      parseExportCreateRequest({
        targetType: "evidence_snapshot",
        targetId: null,
        format: "markdown",
        evidenceIds: [idOne],
      }),
    ).toThrowError(ZodError);
  });

  it("builds stable filenames for saved exports", () => {
    expect(
      buildExportFilename({
        targetType: "resume_bullets",
        targetLabel: "Staff Platform Engineer",
        format: "markdown",
        createdAt: "2026-04-14T00:00:00.000Z",
      }),
    ).toBe("resume-bullets-staff-platform-engineer-2026-04-14.md");

    expect(
      buildExportFilename({
        targetType: "evidence_snapshot",
        targetLabel: "Evidence snapshot",
        format: "json",
        createdAt: "2026-04-14T00:00:00.000Z",
      }),
    ).toBe("evidence-snapshot-2026-04-14.json");
  });
});
