import { z } from "zod";

const optionalTrimmedText = z
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

export const roleVariantInputSchema = z.object({
  name: z.string().trim().min(1, "Role variant name is required."),
  targetTitle: optionalTrimmedText,
  jobDescriptionRaw: optionalTrimmedText,
  notes: optionalTrimmedText,
});

export const roleVariantPatchSchema = z
  .object({
    name: z.string().trim().min(1, "Role variant name is required.").optional(),
    targetTitle: patchOptionalTrimmedText,
    jobDescriptionRaw: patchOptionalTrimmedText,
    notes: patchOptionalTrimmedText,
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be updated.");

export interface RoleVariantInput {
  name: string;
  targetTitle: string | null;
  jobDescriptionRaw: string | null;
  notes: string | null;
}

export function parseRoleVariantInput(payload: unknown): RoleVariantInput {
  const parsed = roleVariantInputSchema.parse(payload);

  return {
    name: parsed.name.trim(),
    targetTitle: parsed.targetTitle,
    jobDescriptionRaw: parsed.jobDescriptionRaw,
    notes: parsed.notes,
  };
}

export function parseRoleVariantPatch(payload: unknown): Partial<RoleVariantInput> {
  const parsed = roleVariantPatchSchema.parse(payload);

  return {
    name: parsed.name?.trim(),
    targetTitle: parsed.targetTitle,
    jobDescriptionRaw: parsed.jobDescriptionRaw,
    notes: parsed.notes,
  };
}
