import { describe, expect, it } from "vitest";
import { githubImportRequestSchema } from "@/lib/github/contracts";

describe("github import contracts", () => {
  it("normalizes repo lists and defaults import types", () => {
    const parsed = githubImportRequestSchema.parse({
      repos: ["openai/resume-evolver-demo", "openai/resume-evolver-demo"],
      from: "2026-04-01",
      to: "2026-04-15",
    });

    expect(parsed.repos).toEqual(["openai/resume-evolver-demo"]);
    expect(parsed.types).toEqual(["pull_request", "issue", "release"]);
  });

  it("rejects import windows beyond ninety days", () => {
    expect(() =>
      githubImportRequestSchema.parse({
        repos: ["openai/resume-evolver-demo"],
        from: "2026-01-01",
        to: "2026-04-15",
      }),
    ).toThrow(/90 days/);
  });

  it("rejects invalid repo names", () => {
    expect(() =>
      githubImportRequestSchema.parse({
        repos: ["not a repo"],
        from: "2026-04-01",
        to: "2026-04-15",
      }),
    ).toThrow(/owner\/name/);
  });
});
