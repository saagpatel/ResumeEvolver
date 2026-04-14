import { describe, expect, it } from "vitest";
import {
  evidenceLinkInputSchema,
  parseManualEvidencePatch,
  validateManualEvidenceRules,
} from "@/lib/evidence/contracts";
import { EvidenceError } from "@/lib/evidence/errors";
import type { ManualEvidenceInput } from "@/types/domain";

const baseManualInput: ManualEvidenceInput = {
  type: "manual_note",
  title: "Customer workflow fix",
  rawInput: "Resolved a recurring support escalation with a runbook update.",
  projectName: "Support ops",
  timeStart: "2026-04-13T16:00:00.000Z",
  timeEnd: "2026-04-13T17:00:00.000Z",
  links: [],
};

describe("manual evidence contracts", () => {
  it("preserves omitted patch fields as undefined", () => {
    const patch = parseManualEvidencePatch({
      title: "Updated title",
    });

    expect(patch.title).toBe("Updated title");
    expect(patch.projectName).toBeUndefined();
    expect(patch.timeStart).toBeUndefined();
    expect(patch.timeEnd).toBeUndefined();
    expect(patch.links).toBeUndefined();
  });

  it("normalizes explicit clears to null in patch payloads", () => {
    const patch = parseManualEvidencePatch({
      projectName: "",
      timeStart: "",
      timeEnd: null,
    });

    expect(patch.projectName).toBeNull();
    expect(patch.timeStart).toBeNull();
    expect(patch.timeEnd).toBeNull();
  });

  it("rejects certification evidence without a cert or external link", () => {
    expect(() =>
      validateManualEvidenceRules({
        ...baseManualInput,
        type: "certification",
        links: [
          {
            label: "Repository",
            url: "https://github.com/example/project",
            linkType: "github",
          },
        ],
      }),
    ).toThrowError(EvidenceError);
  });

  it("accepts project-link evidence with a GitHub link", () => {
    expect(() =>
      validateManualEvidenceRules({
        ...baseManualInput,
        type: "project_link",
        links: [
          {
            label: "Repository",
            url: "https://github.com/example/project",
            linkType: "github",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects invalid time ranges", () => {
    expect(() =>
      validateManualEvidenceRules({
        ...baseManualInput,
        timeStart: "2026-04-13T17:00:00.000Z",
        timeEnd: "2026-04-13T16:00:00.000Z",
      }),
    ).toThrowError(EvidenceError);
  });

  it("rejects non-http link schemes", () => {
    expect(() =>
      evidenceLinkInputSchema.parse({
        label: "Unsafe scheme",
        url: "ftp://example.com/proof",
        linkType: "external",
      }),
    ).toThrowError();
  });
});
