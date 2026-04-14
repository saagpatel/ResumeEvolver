import "server-only";

import { z } from "zod";

export const githubImportTypes = [
  "pull_request",
  "issue",
  "release",
] as const;

export type GitHubImportType = (typeof githubImportTypes)[number];

const githubRepoNameSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    "Repository names must use owner/name format.",
  );

const githubDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD.");

export const githubImportRequestSchema = z
  .object({
    repos: z
      .array(githubRepoNameSchema)
      .min(1, "Select at least one repository.")
      .max(3, "Import up to three repositories at a time."),
    from: githubDateSchema,
    to: githubDateSchema,
    types: z.array(z.enum(githubImportTypes)).max(3).optional(),
  })
  .transform((value) => ({
    repos: Array.from(new Set(value.repos.map((repo) => repo.trim()))),
    from: value.from,
    to: value.to,
    types:
      value.types && value.types.length
        ? Array.from(new Set(value.types))
        : [...githubImportTypes],
  }))
  .superRefine((value, context) => {
    const from = new Date(`${value.from}T00:00:00.000Z`);
    const to = new Date(`${value.to}T00:00:00.000Z`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return;
    }

    if (to < from) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "The end date must be on or after the start date.",
      });
    }

    const maxWindowDays = 90;
    const diffDays =
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);

    if (diffDays > maxWindowDays - 1) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Import windows must stay within 90 days.",
      });
    }
  });

export type GitHubImportRequest = z.infer<typeof githubImportRequestSchema>;

export type GitHubImportCapability =
  | { status: "ready"; grantedScopes: string[] }
  | {
      status: "reconnect_required";
      reason: "missing_token" | "missing_scope" | "expired_token";
    }
  | { status: "not_linked" };

export interface GitHubImportRepoSummary {
  repo: string;
  status: "success" | "partial" | "failed";
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  warnings: string[];
}

export interface GitHubImportSummary {
  status: "success" | "partial" | "failed";
  repos: GitHubImportRepoSummary[];
  totals: {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    failed: number;
  };
  warnings: string[];
}

export interface GitHubImportCookiePayload {
  version: 1;
  grantedScopes: string[];
  validatedAt: string;
}
