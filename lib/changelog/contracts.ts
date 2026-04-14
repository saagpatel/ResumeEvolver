import { z } from "zod";
import { periodTypes } from "@/types/domain";
import { EvidenceError } from "@/lib/evidence/errors";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const changelogApprovalStatuses = [
  "draft",
  "approved_private",
  "approved_public_safe",
  "do_not_use",
] as const;

export type ChangelogApprovalStatus =
  (typeof changelogApprovalStatuses)[number];

export const changelogGeneratePromptVersion = "changelog-generate.v1";

export const changelogGenerationRequestSchema = z.object({
  periodType: z.enum(periodTypes),
  periodStart: z.string().regex(
    ISO_DATE_PATTERN,
    "Choose a valid period start date.",
  ),
  evidenceIds: z
    .array(z.string().uuid())
    .min(1, "Choose at least one approved evidence item.")
    .max(20, "Changelog drafting is limited to 20 evidence items.")
    .transform((values) => Array.from(new Set(values))),
  replaceEdited: z.boolean().optional().default(false),
});

export const changelogEntryPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").optional(),
    body: z.string().trim().min(1, "Body is required.").optional(),
    approvalStatus: z.enum(changelogApprovalStatuses).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.body !== undefined ||
      value.approvalStatus !== undefined,
    "At least one field must be updated.",
  );

const generatedChangelogSectionSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  bullets: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
});

export const changelogGenerationResultSchema = z.object({
  title: z.string().trim().min(1).max(140),
  sections: z.array(generatedChangelogSectionSchema).min(1).max(5),
});

export interface ResolvedChangelogPeriod {
  periodType: "monthly" | "quarterly";
  periodStart: string;
  periodEnd: string;
}

export interface ChangelogGenerationMetadata {
  source: "ai";
  prompt_version: string;
  model: string;
  period_type: ResolvedChangelogPeriod["periodType"];
  period_start: string;
  period_end: string;
  selected_evidence_ids: string[];
  generated_at: string;
}

export interface ChangelogGenerationRequest {
  periodType: ResolvedChangelogPeriod["periodType"];
  periodStart: string;
  evidenceIds: string[];
  replaceEdited: boolean;
}

export interface ChangelogEntryPatch {
  title?: string;
  body?: string;
  approvalStatus?: ChangelogApprovalStatus;
}

export function parseDateOnly(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new EvidenceError("Choose a valid calendar date.", 400);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  const normalized = parsed.toISOString().slice(0, 10);

  if (Number.isNaN(parsed.getTime()) || normalized !== value) {
    throw new EvidenceError("Choose a valid calendar date.", 400);
  }

  return parsed;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveChangelogPeriod(
  periodType: ResolvedChangelogPeriod["periodType"],
  periodStart: string,
): ResolvedChangelogPeriod {
  const startDate = parseDateOnly(periodStart);
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();

  if (day !== 1) {
    throw new EvidenceError(
      "Period start must be the first day of the period.",
      400,
    );
  }

  if (periodType === "quarterly" && ![0, 3, 6, 9].includes(month)) {
    throw new EvidenceError(
      "Quarterly periods must start in January, April, July, or October.",
      400,
    );
  }

  const nextPeriodStart =
    periodType === "monthly"
      ? new Date(Date.UTC(year, month + 1, 1))
      : new Date(Date.UTC(year, month + 3, 1));
  const endDate = new Date(nextPeriodStart.getTime() - 24 * 60 * 60 * 1000);

  return {
    periodType,
    periodStart,
    periodEnd: formatDateOnly(endDate),
  };
}

export function getDefaultChangelogPeriod(
  now = new Date(),
): ResolvedChangelogPeriod {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  return resolveChangelogPeriod("monthly", formatDateOnly(monthStart));
}

export function getChangelogVisibilityForApprovalStatus(
  approvalStatus: ChangelogApprovalStatus,
) {
  return approvalStatus === "approved_public_safe" ? "public_safe" : "private";
}

export function parseChangelogGenerationRequest(
  payload: unknown,
): ChangelogGenerationRequest {
  const parsed = changelogGenerationRequestSchema.parse(payload);

  return {
    periodType: parsed.periodType,
    periodStart: parsed.periodStart,
    evidenceIds: parsed.evidenceIds,
    replaceEdited: parsed.replaceEdited,
  };
}

export function parseChangelogEntryPatch(payload: unknown): ChangelogEntryPatch {
  const parsed = changelogEntryPatchSchema.parse(payload);

  return {
    title: parsed.title,
    body: parsed.body,
    approvalStatus: parsed.approvalStatus,
  };
}
