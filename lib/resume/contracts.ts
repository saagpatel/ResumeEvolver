import { z } from "zod";
import { claimTypes, proofStrengths } from "@/types/domain";

const optionalTrimmedText = z
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

export const resumeBulletApprovalStatuses = [
  "draft",
  "approved_private",
  "approved_public_safe",
  "do_not_use",
] as const;

export type ResumeBulletApprovalStatus =
  (typeof resumeBulletApprovalStatuses)[number];

export const resumeGeneratePromptVersion = "resume-generate.v1";

export const resumeGenerationRequestSchema = z.object({
  roleVariantId: z.string().uuid(),
  evidenceIds: z
    .array(z.string().uuid())
    .min(1, "Choose at least one evidence item.")
    .max(12, "Resume generation is limited to 12 evidence items.")
    .transform((values) => Array.from(new Set(values))),
});

export const resumeBulletPatchSchema = z
  .object({
    draftText: optionalTrimmedText,
    approvalStatus: z.enum(resumeBulletApprovalStatuses).optional(),
  })
  .refine(
    (value) => value.draftText !== undefined || value.approvalStatus !== undefined,
    "At least one field must be updated.",
  );

export const generatedResumeBulletSchema = z.object({
  draftText: z.string().trim().min(1).max(320),
  claimType: z.enum(claimTypes),
  supportingEvidenceIds: z
    .array(z.string().uuid())
    .min(1)
    .max(3)
    .transform((values) => Array.from(new Set(values))),
});

export const resumeGenerationResultSchema = z.object({
  bullets: z.array(generatedResumeBulletSchema).min(1).max(5),
});

export interface ResumeGenerationMetadata {
  source: "ai";
  prompt_version: string;
  model: string;
  role_variant_id: string;
  selected_evidence_ids: string[];
  generated_at: string;
}

export interface ResumeGenerationRequest {
  roleVariantId: string;
  evidenceIds: string[];
}

export interface ResumeBulletPatch {
  draftText?: string | null;
  approvalStatus?: ResumeBulletApprovalStatus;
}

export interface PersistedGeneratedResumeBullet {
  draftText: string;
  claimType: z.infer<typeof generatedResumeBulletSchema>["claimType"];
  proofStrength: (typeof proofStrengths)[number];
  supportingEvidenceIds: string[];
}

export function parseResumeGenerationRequest(
  payload: unknown,
): ResumeGenerationRequest {
  const parsed = resumeGenerationRequestSchema.parse(payload);

  return {
    roleVariantId: parsed.roleVariantId,
    evidenceIds: parsed.evidenceIds,
  };
}

export function parseResumeBulletPatch(payload: unknown): ResumeBulletPatch {
  const parsed = resumeBulletPatchSchema.parse(payload);

  return {
    draftText: parsed.draftText,
    approvalStatus: parsed.approvalStatus,
  };
}
