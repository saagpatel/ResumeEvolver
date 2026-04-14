import { z } from "zod";
import {
  evidenceApprovalDecisions,
  linkTypes,
  manualEvidenceTypes,
  proofStrengths,
  tagTypes,
} from "@/types/domain";
import type {
  EvidenceLinkInput,
  EvidenceStructurePayload,
  ManualEvidenceInput,
} from "@/types/domain";
import { EvidenceError } from "./errors";

const optionalTrimmedText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const optionalDateInput = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const patchOptionalTrimmedText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length ? trimmed : null;
  });

const patchOptionalDateInput = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length ? trimmed : null;
  });

const safeHttpUrlSchema = z
  .string()
  .url("Link URL must be valid.")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "Link URL must use http or https.",
  );

export const evidenceLinkInputSchema = z.object({
  label: z.string().trim().min(1, "Link label is required."),
  url: safeHttpUrlSchema,
  linkType: z.enum(linkTypes),
});

export const manualEvidenceInputSchema = z.object({
  type: z.enum(manualEvidenceTypes),
  title: z.string().trim().min(1, "Title is required."),
  rawInput: z.string().trim().min(1, "Evidence details are required."),
  projectName: optionalTrimmedText,
  timeStart: optionalDateInput,
  timeEnd: optionalDateInput,
  links: z.array(evidenceLinkInputSchema).optional(),
});

export const evidencePatchSchema = z
  .object({
    type: z.enum(manualEvidenceTypes).optional(),
    title: z.string().trim().min(1, "Title is required.").optional(),
    rawInput: z
      .string()
      .trim()
      .min(1, "Evidence details are required.")
      .optional(),
    projectName: patchOptionalTrimmedText,
    timeStart: patchOptionalDateInput,
    timeEnd: patchOptionalDateInput,
    links: z.array(evidenceLinkInputSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated.");

export const evidenceApprovalSchema = z.object({
  decision: z.enum(evidenceApprovalDecisions),
});

export const evidenceStructureSchema = z.object({
  factualSummary: z.string().trim().min(1).nullable(),
  proofStrength: z.enum(proofStrengths).nullable(),
  suggestedTags: z.array(
    z.object({
      tagType: z.enum(tagTypes),
      name: z.string().trim().min(1),
    }),
  ),
  proofGaps: z.array(z.string().trim().min(1)),
  roleRelevance: z.array(z.string().trim().min(1)),
});

function normalizeDateInput(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new EvidenceError("Date fields must be valid timestamps.");
  }

  return date.toISOString();
}

function normalizeOptionalDateInput(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return normalizeDateInput(value);
}

export function normalizeEvidenceLinks(links: EvidenceLinkInput[] | undefined) {
  return links?.map((link) => ({
    label: link.label.trim(),
    url: link.url,
    linkType: link.linkType,
  }));
}

export function parseManualEvidenceInput(payload: unknown): ManualEvidenceInput {
  const parsed = manualEvidenceInputSchema.parse(payload);

  return {
    type: parsed.type,
    title: parsed.title.trim(),
    rawInput: parsed.rawInput.trim(),
    projectName: parsed.projectName,
    timeStart: normalizeDateInput(parsed.timeStart),
    timeEnd: normalizeDateInput(parsed.timeEnd),
    links: normalizeEvidenceLinks(parsed.links),
  };
}

export function parseManualEvidencePatch(
  payload: unknown,
): Partial<ManualEvidenceInput> & { links?: EvidenceLinkInput[] } {
  const parsed = evidencePatchSchema.parse(payload);

  return {
    type: parsed.type,
    title: parsed.title?.trim(),
    rawInput: parsed.rawInput?.trim(),
    projectName: parsed.projectName,
    timeStart: normalizeOptionalDateInput(parsed.timeStart),
    timeEnd: normalizeOptionalDateInput(parsed.timeEnd),
    links: normalizeEvidenceLinks(parsed.links),
  };
}

export function validateManualEvidenceRules(
  input: ManualEvidenceInput,
  existingLinks: EvidenceLinkInput[] = input.links ?? [],
) {
  if (input.timeStart && input.timeEnd) {
    const start = new Date(input.timeStart).getTime();
    const end = new Date(input.timeEnd).getTime();

    if (end < start) {
      throw new EvidenceError("End time cannot be before start time.");
    }
  }

  const effectiveLinks = existingLinks;

  if (
    input.type === "certification" &&
    !effectiveLinks.some(
      (link) => link.linkType === "cert" || link.linkType === "external",
    )
  ) {
    throw new EvidenceError(
      "Certification evidence needs at least one cert or external link.",
    );
  }

  if (
    input.type === "project_link" &&
    !effectiveLinks.some((link) =>
      ["project", "external", "github"].includes(link.linkType),
    )
  ) {
    throw new EvidenceError(
      "Project-link evidence needs at least one project, external, or GitHub link.",
    );
  }
}

export function toStructurePayloadJson(payload: EvidenceStructurePayload) {
  return {
    suggested_tags: payload.suggestedTags.map((tag) => ({
      tag_type: tag.tagType,
      name: tag.name,
    })),
    proof_gaps: payload.proofGaps,
    role_relevance: payload.roleRelevance,
  };
}
