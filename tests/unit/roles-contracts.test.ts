import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  parseRoleVariantInput,
  parseRoleVariantPatch,
} from "@/lib/roles/contracts";

describe("role variant contracts", () => {
  it("normalizes empty optional fields to null", () => {
    const parsed = parseRoleVariantInput({
      name: "  Staff platform engineer  ",
      targetTitle: " ",
      jobDescriptionRaw: "",
      notes: null,
    });

    expect(parsed).toEqual({
      name: "Staff platform engineer",
      targetTitle: null,
      jobDescriptionRaw: null,
      notes: null,
    });
  });

  it("preserves omitted patch fields as undefined", () => {
    const parsed = parseRoleVariantPatch({
      notes: "  Strong technical writing signal.  ",
    });

    expect(parsed).toEqual({
      name: undefined,
      targetTitle: undefined,
      jobDescriptionRaw: undefined,
      notes: "Strong technical writing signal.",
    });
  });

  it("rejects empty patch payloads", () => {
    expect(() => parseRoleVariantPatch({})).toThrowError(ZodError);
  });
});
