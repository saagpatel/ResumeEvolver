import { z } from "zod";
import { exportFormats, exportTargetTypes } from "@/types/domain";

export const exportCreatePromptVersion = "export-studio.v1";

const uuidSchema = z.string().uuid();

export const exportTargetFormatMatrix = {
  resume_bullets: ["markdown", "text", "json"],
  changelog_entry: ["markdown", "text", "json"],
  evidence_snapshot: ["json"],
} as const satisfies Record<
  (typeof exportTargetTypes)[number],
  readonly (typeof exportFormats)[number][]
>;

export const exportCreateRequestSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("resume_bullets"),
    targetId: uuidSchema,
    format: z.enum(exportTargetFormatMatrix.resume_bullets),
  }),
  z.object({
    targetType: z.literal("changelog_entry"),
    targetId: uuidSchema,
    format: z.enum(exportTargetFormatMatrix.changelog_entry),
  }),
  z.object({
    targetType: z.literal("evidence_snapshot"),
    targetId: z.null(),
    format: z.literal("json"),
    evidenceIds: z
      .array(uuidSchema)
      .min(1, "Choose at least one evidence record.")
      .max(100, "Evidence snapshots are limited to 100 records.")
      .transform((values) => Array.from(new Set(values))),
  }),
]);

export type ExportCreateRequest = z.infer<typeof exportCreateRequestSchema>;

export interface ExportHistoryTargetLabel {
  label: string;
  summary: string;
}

const fileExtensionByFormat = {
  markdown: "md",
  text: "txt",
  json: "json",
} as const;

const contentTypeByFormat = {
  markdown: "text/markdown; charset=utf-8",
  text: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
} as const;

export function parseExportCreateRequest(payload: unknown): ExportCreateRequest {
  return exportCreateRequestSchema.parse(payload);
}

export function isFormatAllowedForTarget(
  targetType: (typeof exportTargetTypes)[number],
  format: (typeof exportFormats)[number],
) {
  return (exportTargetFormatMatrix[targetType] as readonly string[]).includes(format);
}

export function getExportContentType(format: (typeof exportFormats)[number]) {
  return contentTypeByFormat[format];
}

export function getExportFileExtension(format: (typeof exportFormats)[number]) {
  return fileExtensionByFormat[format];
}

export function sanitizeFilenameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function buildExportFilename(args: {
  targetType: (typeof exportTargetTypes)[number];
  targetLabel: string;
  format: (typeof exportFormats)[number];
  createdAt: string;
}) {
  const day = new Date(args.createdAt).toISOString().slice(0, 10);
  const extension = getExportFileExtension(args.format);

  if (args.targetType === "evidence_snapshot") {
    return `evidence-snapshot-${day}.${extension}`;
  }

  const targetPrefix =
    args.targetType === "resume_bullets" ? "resume-bullets" : "changelog";
  const sanitizedLabel = sanitizeFilenameSegment(args.targetLabel) || targetPrefix;

  return `${targetPrefix}-${sanitizedLabel}-${day}.${extension}`;
}
