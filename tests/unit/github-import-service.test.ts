import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { runGitHubImport } from "@/lib/github/import";
import {
  githubFixtureIssues,
  githubFixturePullRequests,
  githubFixtureReleases,
  githubFixtureRepository,
} from "@/tests/fixtures/github-api";

vi.mock("@/lib/github/client", () => ({
  getGitHubRepository: vi.fn(async () => githubFixtureRepository),
  listGitHubPullRequests: vi.fn(async () => ({
    items: githubFixturePullRequests,
    truncated: false,
  })),
  listGitHubIssues: vi.fn(async () => ({
    items: githubFixtureIssues,
    truncated: false,
  })),
  listGitHubReleases: vi.fn(async () => ({
    items: githubFixtureReleases,
    truncated: false,
  })),
}));

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];

function makeEvidenceRow(overrides: Partial<EvidenceRow>): EvidenceRow {
  return {
    id: crypto.randomUUID(),
    user_id: "00000000-0000-0000-0000-000000000001",
    type: "github_pr",
    title: "Existing imported record",
    raw_input: "Existing normalized body",
    factual_summary: null,
    time_start: "2026-04-09T16:00:00.000Z",
    time_end: "2026-04-10T18:00:00.000Z",
    source_system: "github",
    source_external_id: "2001",
    source_url: "https://github.com/openai/resume-evolver-demo/pull/14",
    project_name: "openai/resume-evolver-demo",
    visibility_default: "private",
    proof_strength: null,
    verification_status: "approved",
    approval_status: "approved_private",
    ai_structured_payload: {},
    metadata: {
      import_fingerprint: "stale",
    },
    created_at: "2026-04-10T18:00:00.000Z",
    updated_at: "2026-04-10T18:00:00.000Z",
    ...overrides,
  };
}

function createFakeImportSupabase(initialRows: EvidenceRow[] = []) {
  const rows = [...initialRows];

  class SelectQuery {
    private filters: Array<(row: EvidenceRow) => boolean> = [];

    eq(column: keyof EvidenceRow, value: unknown) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    maybeSingle() {
      const row = rows.find((candidate) => this.filters.every((filter) => filter(candidate)));
      return Promise.resolve({ data: row ?? null, error: null });
    }
  }

  class UpdateQuery {
    private filters: Array<(row: EvidenceRow) => boolean> = [];

    constructor(private readonly patch: Partial<EvidenceRow>) {}

    eq(column: keyof EvidenceRow, value: unknown) {
      this.filters.push((row) => row[column] === value);

      if (this.filters.length >= 2) {
        const row = rows.find((candidate) => this.filters.every((filter) => filter(candidate)));

        if (row) {
          Object.assign(row, this.patch);
        }

        return Promise.resolve({ data: null, error: null });
      }

      return this;
    }
  }

  return {
    rows,
    client: {
      from(tableName: string) {
        if (tableName !== "evidence_items") {
          throw new Error(`Unexpected table ${tableName}`);
        }

        return {
          select() {
            return new SelectQuery();
          },
          insert(payload: Database["public"]["Tables"]["evidence_items"]["Insert"]) {
            rows.push({
              id: crypto.randomUUID(),
              created_at: "2026-04-14T00:00:00.000Z",
              updated_at: "2026-04-14T00:00:00.000Z",
              factual_summary: null,
              proof_strength: null,
              ai_structured_payload: {},
              metadata: {},
              time_start: null,
              time_end: null,
              project_name: null,
              source_external_id: null,
              source_url: null,
              approval_status: "draft",
              verification_status: "unreviewed",
              visibility_default: "private",
              ...payload,
            } as EvidenceRow);

            return Promise.resolve({ data: null, error: null });
          },
          update(payload: Partial<EvidenceRow>) {
            return new UpdateQuery(payload);
          },
        };
      },
    } as unknown as SupabaseClient<Database>,
  };
}

describe("runGitHubImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports pull requests, issues, and releases while filtering issue-backed PR rows", async () => {
    const supabase = createFakeImportSupabase();

    const summary = await runGitHubImport(
      supabase.client,
      "00000000-0000-0000-0000-000000000001",
      "token",
      {
        repos: ["openai/resume-evolver-demo"],
        from: "2026-04-01",
        to: "2026-04-15",
        types: ["pull_request", "issue", "release"],
      },
    );

    expect(summary.status).toBe("success");
    expect(summary.totals.created).toBe(3);
    expect(supabase.rows.map((row) => row.type).sort()).toEqual([
      "github_issue",
      "github_pr",
      "github_release",
    ]);
    expect(
      supabase.rows.find((row) => row.type === "github_issue")?.title,
    ).toContain("Issue #22");
  });

  it("preserves approved state when a rerun is unchanged", async () => {
    const supabase = createFakeImportSupabase();

    await runGitHubImport(
      supabase.client,
      "00000000-0000-0000-0000-000000000001",
      "token",
      {
        repos: ["openai/resume-evolver-demo"],
        from: "2026-04-01",
        to: "2026-04-15",
        types: ["pull_request"],
      },
    );

    supabase.rows[0].approval_status = "approved_private";
    supabase.rows[0].verification_status = "approved";

    const summary = await runGitHubImport(
      supabase.client,
      "00000000-0000-0000-0000-000000000001",
      "token",
      {
        repos: ["openai/resume-evolver-demo"],
        from: "2026-04-01",
        to: "2026-04-15",
        types: ["pull_request"],
      },
    );

    expect(summary.totals.unchanged).toBe(1);
    expect(supabase.rows[0].approval_status).toBe("approved_private");
    expect(supabase.rows[0].verification_status).toBe("approved");
  });

  it("resets review state when imported source content changes", async () => {
    const existing = makeEvidenceRow({
      raw_input: "Old normalized body",
      metadata: {
        import_fingerprint: "stale",
      },
    });
    const supabase = createFakeImportSupabase([existing]);

    const summary = await runGitHubImport(
      supabase.client,
      existing.user_id,
      "token",
      {
        repos: ["openai/resume-evolver-demo"],
        from: "2026-04-01",
        to: "2026-04-15",
        types: ["pull_request"],
      },
    );

    expect(summary.totals.updated).toBe(1);
    expect(supabase.rows[0].approval_status).toBe("draft");
    expect(supabase.rows[0].verification_status).toBe("unreviewed");
    expect(supabase.rows[0].raw_input).toContain("pull request #14");
  });
});
