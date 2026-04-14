import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  parseResumeBulletPatch,
  parseResumeGenerationRequest,
} from "@/lib/resume/contracts";

const idOne = "00000000-0000-0000-0000-000000000000";
const idTwo = "ffffffff-ffff-ffff-ffff-ffffffffffff";

describe("resume contracts", () => {
  it("deduplicates selected evidence ids", () => {
    const parsed = parseResumeGenerationRequest({
      roleVariantId: "00000000-0000-0000-0000-000000000000",
      evidenceIds: [idOne, idOne, idTwo],
    });

    expect(parsed.evidenceIds).toEqual([idOne, idTwo]);
  });

  it("accepts special-case UUIDs used in local tests", () => {
    const parsed = parseResumeGenerationRequest({
      roleVariantId: "00000000-0000-0000-0000-000000000000",
      evidenceIds: [idOne, idOne, idTwo],
    });

    expect(parsed.evidenceIds).toEqual([idOne, idTwo]);
  });

  it("normalizes blank draft text patches to null", () => {
    const parsed = parseResumeBulletPatch({
      draftText: " ",
      approvalStatus: "approved_private",
    });

    expect(parsed).toEqual({
      draftText: null,
      approvalStatus: "approved_private",
    });
  });

  it("rejects unsupported bullet approval states", () => {
    expect(() =>
      parseResumeBulletPatch({
        approvalStatus: "needs_more_proof",
      }),
    ).toThrowError(ZodError);
  });
});
