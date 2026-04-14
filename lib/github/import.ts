import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";
import type { GitHubImportRequest, GitHubImportSummary, GitHubImportType } from "./contracts";
import {
  GitHubApiError,
  getGitHubRepository,
  listGitHubIssues,
  listGitHubPullRequests,
  listGitHubReleases,
  type GitHubIssue,
  type GitHubPullRequest,
  type GitHubRelease,
  type GitHubRepository,
} from "./client";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type EvidenceInsert = Database["public"]["Tables"]["evidence_items"]["Insert"];
type EvidenceUpdate = Database["public"]["Tables"]["evidence_items"]["Update"];

const MAX_MATCHING_RECORDS_PER_TYPE = 100;
const RAW_INPUT_BODY_LIMIT = 12_000;

interface ImportWindow {
  from: Date;
  to: Date;
}

interface NormalizedGitHubEvidence {
  type: EvidenceInsert["type"];
  sourceExternalId: string;
  title: string;
  rawInput: string;
  timeStart: string | null;
  timeEnd: string | null;
  sourceUrl: string;
  projectName: string;
  metadata: Json;
}

function buildImportWindow(input: GitHubImportRequest): ImportWindow {
  return {
    from: new Date(`${input.from}T00:00:00.000Z`),
    to: new Date(`${input.to}T23:59:59.999Z`),
  };
}

function isWithinWindow(dateValue: string | null, window: ImportWindow) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= window.from && date <= window.to;
}

function trimBody(value: string | null | undefined) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= RAW_INPUT_BODY_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, RAW_INPUT_BODY_LIMIT)}\n\n[truncated]`;
}

function stringifyImportDocument(title: string, lines: string[], body?: string) {
  const content = [title, ...lines, body ? `\n${body}` : ""]
    .filter(Boolean)
    .join("\n");

  return content.trim();
}

function buildFingerprint(input: Omit<NormalizedGitHubEvidence, "metadata">) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        type: input.type,
        sourceExternalId: input.sourceExternalId,
        title: input.title,
        rawInput: input.rawInput,
        timeStart: input.timeStart,
        timeEnd: input.timeEnd,
        sourceUrl: input.sourceUrl,
        projectName: input.projectName,
      }),
    )
    .digest("hex");
}

function buildPullRequestEvidence(
  repo: GitHubRepository,
  pullRequest: GitHubPullRequest,
): NormalizedGitHubEvidence {
  const base = {
    type: "github_pr" as const,
    sourceExternalId: String(pullRequest.id),
    title: `${repo.full_name} PR #${pullRequest.number}: ${pullRequest.title}`,
    rawInput: stringifyImportDocument(
      `${repo.full_name} pull request #${pullRequest.number}`,
      [
        `Repository: ${repo.full_name}`,
        `Author: ${pullRequest.user?.login ?? "unknown"}`,
        `State: ${pullRequest.state}`,
        `Draft: ${pullRequest.draft ? "yes" : "no"}`,
        `Created: ${pullRequest.created_at}`,
        `Closed: ${pullRequest.closed_at ?? "open"}`,
        `Merged: ${pullRequest.merged_at ?? "not merged"}`,
        `URL: ${pullRequest.html_url}`,
      ],
      trimBody(pullRequest.body),
    ),
    timeStart: pullRequest.created_at,
    timeEnd: pullRequest.merged_at ?? pullRequest.closed_at,
    sourceUrl: pullRequest.html_url,
    projectName: repo.full_name,
  };
  const importFingerprint = buildFingerprint(base);

  return {
    ...base,
    metadata: {
      repo_full_name: repo.full_name,
      repo_id: repo.id,
      github_number: pullRequest.number,
      state: pullRequest.state,
      author_login: pullRequest.user?.login ?? null,
      merged: Boolean(pullRequest.merged_at),
      draft: pullRequest.draft,
      import_fingerprint: importFingerprint,
    },
  };
}

function buildIssueEvidence(
  repo: GitHubRepository,
  issue: GitHubIssue,
): NormalizedGitHubEvidence {
  const base = {
    type: "github_issue" as const,
    sourceExternalId: String(issue.id),
    title: `${repo.full_name} Issue #${issue.number}: ${issue.title}`,
    rawInput: stringifyImportDocument(
      `${repo.full_name} issue #${issue.number}`,
      [
        `Repository: ${repo.full_name}`,
        `Author: ${issue.user?.login ?? "unknown"}`,
        `State: ${issue.state}`,
        `Created: ${issue.created_at}`,
        `Closed: ${issue.closed_at ?? "open"}`,
        `URL: ${issue.html_url}`,
      ],
      trimBody(issue.body),
    ),
    timeStart: issue.created_at,
    timeEnd: issue.closed_at,
    sourceUrl: issue.html_url,
    projectName: repo.full_name,
  };
  const importFingerprint = buildFingerprint(base);

  return {
    ...base,
    metadata: {
      repo_full_name: repo.full_name,
      repo_id: repo.id,
      github_number: issue.number,
      state: issue.state,
      author_login: issue.user?.login ?? null,
      import_fingerprint: importFingerprint,
    },
  };
}

function buildReleaseEvidence(
  repo: GitHubRepository,
  release: GitHubRelease,
): NormalizedGitHubEvidence {
  const publishedAt = release.published_at ?? release.created_at;
  const base = {
    type: "github_release" as const,
    sourceExternalId: String(release.id),
    title: `${repo.full_name} Release ${release.tag_name}: ${
      release.name?.trim() || release.tag_name
    }`,
    rawInput: stringifyImportDocument(
      `${repo.full_name} release ${release.tag_name}`,
      [
        `Repository: ${repo.full_name}`,
        `Author: ${release.author?.login ?? "unknown"}`,
        `Tag: ${release.tag_name}`,
        `Prerelease: ${release.prerelease ? "yes" : "no"}`,
        `Published: ${publishedAt}`,
        `URL: ${release.html_url}`,
      ],
      trimBody(release.body),
    ),
    timeStart: publishedAt,
    timeEnd: publishedAt,
    sourceUrl: release.html_url,
    projectName: repo.full_name,
  };
  const importFingerprint = buildFingerprint(base);

  return {
    ...base,
    metadata: {
      repo_full_name: repo.full_name,
      repo_id: repo.id,
      tag_name: release.tag_name,
      author_login: release.author?.login ?? null,
      draft: release.draft,
      prerelease: release.prerelease,
      published_at: release.published_at,
      import_fingerprint: importFingerprint,
    },
  };
}

function getPullRequestMatchDate(record: GitHubPullRequest) {
  return record.merged_at ?? record.closed_at ?? record.created_at;
}

function getIssueMatchDate(record: GitHubIssue) {
  return record.closed_at ?? record.created_at;
}

function getReleaseMatchDate(record: GitHubRelease) {
  return record.published_at ?? record.created_at;
}

function summarizeImportStatus(summary: GitHubImportSummary["repos"]) {
  const totals = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
  };

  for (const repo of summary) {
    totals.created += repo.created;
    totals.updated += repo.updated;
    totals.unchanged += repo.unchanged;
    totals.skipped += repo.skipped;
    totals.failed += repo.failed;
  }

  return totals;
}

async function loadExistingGitHubEvidence(
  supabase: SupabaseClient<Database>,
  userId: string,
  candidate: NormalizedGitHubEvidence,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("*")
    .eq("user_id", userId)
    .eq("type", candidate.type)
    .eq("source_system", "github")
    .eq("source_external_id", candidate.sourceExternalId)
    .maybeSingle();

  if (error) {
    throw new EvidenceError("Could not load existing imported evidence.", 500);
  }

  return (data ?? null) as EvidenceRow | null;
}

function getExistingFingerprint(row: EvidenceRow) {
  if (
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata) &&
    "import_fingerprint" in row.metadata
  ) {
    const value = row.metadata.import_fingerprint;
    return typeof value === "string" ? value : null;
  }

  return null;
}

async function applyGitHubEvidenceCandidate(
  supabase: SupabaseClient<Database>,
  userId: string,
  candidate: NormalizedGitHubEvidence,
) {
  const existing = await loadExistingGitHubEvidence(supabase, userId, candidate);
  const importFingerprint =
    typeof candidate.metadata === "object" &&
    candidate.metadata &&
    !Array.isArray(candidate.metadata) &&
    "import_fingerprint" in candidate.metadata
      ? String(candidate.metadata.import_fingerprint)
      : null;

  if (!existing) {
    const insertPayload: EvidenceInsert = {
      user_id: userId,
      type: candidate.type,
      title: candidate.title,
      raw_input: candidate.rawInput,
      factual_summary: null,
      time_start: candidate.timeStart,
      time_end: candidate.timeEnd,
      source_system: "github",
      source_external_id: candidate.sourceExternalId,
      source_url: candidate.sourceUrl,
      project_name: candidate.projectName,
      visibility_default: "private",
      proof_strength: null,
      verification_status: "unreviewed",
      approval_status: "draft",
      ai_structured_payload: {},
      metadata: candidate.metadata,
    };

    const { error } = await supabase.from("evidence_items").insert(insertPayload);

    if (error) {
      throw new EvidenceError("Could not insert imported GitHub evidence.", 500);
    }

    return "created" as const;
  }

  if (importFingerprint && getExistingFingerprint(existing) === importFingerprint) {
    return "unchanged" as const;
  }

  const updatePayload: EvidenceUpdate = {
    title: candidate.title,
    raw_input: candidate.rawInput,
    factual_summary: null,
    time_start: candidate.timeStart,
    time_end: candidate.timeEnd,
    source_url: candidate.sourceUrl,
    project_name: candidate.projectName,
    visibility_default: "private",
    proof_strength: null,
    verification_status: "unreviewed",
    approval_status: "draft",
    ai_structured_payload: {},
    metadata: candidate.metadata,
  };

  const { error } = await supabase
    .from("evidence_items")
    .update(updatePayload)
    .eq("id", existing.id)
    .eq("user_id", userId);

  if (error) {
    throw new EvidenceError("Could not update imported GitHub evidence.", 500);
  }

  return "updated" as const;
}

async function importPullRequestsForRepo(
  supabase: SupabaseClient<Database>,
  userId: string,
  repo: GitHubRepository,
  token: string,
  window: ImportWindow,
  repoSummary: GitHubImportSummary["repos"][number],
) {
  const { items, truncated } = await listGitHubPullRequests(token, repo.full_name);

  if (truncated) {
    repoSummary.warnings.push(
      `Pull request results were truncated for ${repo.full_name}; narrow the import window if anything is missing.`,
    );
  }

  const matching = items.filter((item) => isWithinWindow(getPullRequestMatchDate(item), window));

  if (matching.length > MAX_MATCHING_RECORDS_PER_TYPE) {
    repoSummary.warnings.push(
      `Pull request import exceeded ${MAX_MATCHING_RECORDS_PER_TYPE} matching records for ${repo.full_name}; narrow the window and retry.`,
    );
    repoSummary.skipped += matching.length;
    return;
  }

  for (const item of matching) {
    const result = await applyGitHubEvidenceCandidate(
      supabase,
      userId,
      buildPullRequestEvidence(repo, item),
    );
    repoSummary[result] += 1;
  }
}

async function importIssuesForRepo(
  supabase: SupabaseClient<Database>,
  userId: string,
  repo: GitHubRepository,
  token: string,
  window: ImportWindow,
  repoSummary: GitHubImportSummary["repos"][number],
) {
  const { items, truncated } = await listGitHubIssues(token, repo.full_name);

  if (truncated) {
    repoSummary.warnings.push(
      `Issue results were truncated for ${repo.full_name}; narrow the import window if anything is missing.`,
    );
  }

  const matching = items
    .filter((item) => !item.pull_request)
    .filter((item) => isWithinWindow(getIssueMatchDate(item), window));

  if (matching.length > MAX_MATCHING_RECORDS_PER_TYPE) {
    repoSummary.warnings.push(
      `Issue import exceeded ${MAX_MATCHING_RECORDS_PER_TYPE} matching records for ${repo.full_name}; narrow the window and retry.`,
    );
    repoSummary.skipped += matching.length;
    return;
  }

  for (const item of matching) {
    const result = await applyGitHubEvidenceCandidate(
      supabase,
      userId,
      buildIssueEvidence(repo, item),
    );
    repoSummary[result] += 1;
  }
}

async function importReleasesForRepo(
  supabase: SupabaseClient<Database>,
  userId: string,
  repo: GitHubRepository,
  token: string,
  window: ImportWindow,
  repoSummary: GitHubImportSummary["repos"][number],
) {
  const { items, truncated } = await listGitHubReleases(token, repo.full_name);

  if (truncated) {
    repoSummary.warnings.push(
      `Release results were truncated for ${repo.full_name}; narrow the import window if anything is missing.`,
    );
  }

  const matching = items
    .filter((item) => !item.draft)
    .filter((item) => isWithinWindow(getReleaseMatchDate(item), window));

  if (matching.length > MAX_MATCHING_RECORDS_PER_TYPE) {
    repoSummary.warnings.push(
      `Release import exceeded ${MAX_MATCHING_RECORDS_PER_TYPE} matching records for ${repo.full_name}; narrow the window and retry.`,
    );
    repoSummary.skipped += matching.length;
    return;
  }

  for (const item of matching) {
    const result = await applyGitHubEvidenceCandidate(
      supabase,
      userId,
      buildReleaseEvidence(repo, item),
    );
    repoSummary[result] += 1;
  }
}

async function importTypeForRepo(
  supabase: SupabaseClient<Database>,
  userId: string,
  repo: GitHubRepository,
  token: string,
  type: GitHubImportType,
  window: ImportWindow,
  repoSummary: GitHubImportSummary["repos"][number],
) {
  switch (type) {
    case "pull_request":
      return importPullRequestsForRepo(supabase, userId, repo, token, window, repoSummary);
    case "issue":
      return importIssuesForRepo(supabase, userId, repo, token, window, repoSummary);
    case "release":
      return importReleasesForRepo(supabase, userId, repo, token, window, repoSummary);
    default:
      return undefined;
  }
}

export async function runGitHubImport(
  supabase: SupabaseClient<Database>,
  userId: string,
  token: string,
  request: GitHubImportRequest,
): Promise<GitHubImportSummary> {
  const window = buildImportWindow(request);
  const repoSummaries: GitHubImportSummary["repos"] = [];
  const warnings: string[] = [];

  for (const repoFullName of request.repos) {
    const repoSummary: GitHubImportSummary["repos"][number] = {
      repo: repoFullName,
      status: "success",
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      warnings: [],
    };

    try {
      const repo = await getGitHubRepository(token, repoFullName);

      if (repo.private) {
        repoSummary.status = "failed";
        repoSummary.failed += 1;
        repoSummary.warnings.push(
          `${repoFullName} is private. Milestone 4 only supports public repositories.`,
        );
      } else {
        for (const type of request.types) {
          try {
            await importTypeForRepo(
              supabase,
              userId,
              repo,
              token,
              type,
              window,
              repoSummary,
            );
          } catch (error) {
            if (error instanceof GitHubApiError) {
              repoSummary.failed += 1;
              repoSummary.warnings.push(
                `${repoFullName} ${type.replace("_", " ")} import failed with GitHub status ${error.status}.`,
              );
              continue;
            }

            throw error;
          }
        }
      }
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        repoSummary.status = "failed";
        repoSummary.failed += 1;
        repoSummary.warnings.push(
          `${repoFullName} could not be loaded. Confirm the repository exists and is public.`,
        );
      } else if (error instanceof GitHubApiError) {
        repoSummary.status = "failed";
        repoSummary.failed += 1;
        repoSummary.warnings.push(`${repoFullName} failed with GitHub status ${error.status}.`);
      } else {
        throw error;
      }
    }

    if (
      repoSummary.status !== "failed" &&
      (repoSummary.failed > 0 || repoSummary.warnings.length > 0)
    ) {
      repoSummary.status = "partial";
    }

    repoSummaries.push(repoSummary);
    warnings.push(...repoSummary.warnings);
  }

  const totals = summarizeImportStatus(repoSummaries);
  const status =
    repoSummaries.every((repo) => repo.status === "failed")
      ? "failed"
      : repoSummaries.some((repo) => repo.status !== "success")
        ? "partial"
        : "success";

  return {
    status,
    repos: repoSummaries,
    totals,
    warnings,
  };
}
