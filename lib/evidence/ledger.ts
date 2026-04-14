import { z } from "zod";
import { evidenceTypes, ledgerStatuses, proofStrengths } from "@/types/domain";
import type {
  ApprovalStatus,
  EvidenceType,
  LedgerStatus,
  ProofStrength,
  VerificationStatus,
} from "@/types/domain";
import { getLedgerStatus } from "./state-machine";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function firstSearchParamValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const ledgerSearchParamsSchema = z.object({
  type: z.preprocess(
    firstSearchParamValue,
    z.enum(evidenceTypes).optional().catch(undefined),
  ),
  ledgerStatus: z.preprocess(
    firstSearchParamValue,
    z.enum(ledgerStatuses).optional().catch(undefined),
  ),
  proofStrength: z.preprocess(
    firstSearchParamValue,
    z.enum(proofStrengths).optional().catch(undefined),
  ),
  project: z.preprocess(
    firstSearchParamValue,
    z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .catch(undefined),
  ),
  from: z.preprocess(
    firstSearchParamValue,
    isoDateSchema.optional().catch(undefined),
  ),
  to: z.preprocess(
    firstSearchParamValue,
    isoDateSchema.optional().catch(undefined),
  ),
  evidence: z.preprocess(
    firstSearchParamValue,
    z
      .string()
      .trim()
      .min(1)
      .optional()
      .catch(undefined),
  ),
});

export interface LedgerFilters {
  type?: EvidenceType;
  ledgerStatus?: LedgerStatus;
  proofStrength?: ProofStrength;
  project?: string;
  from?: string;
  to?: string;
  evidence?: string;
}

export const ledgerStatusLabels: Record<LedgerStatus, string> = {
  draft_unreviewed: "Unreviewed draft",
  draft_structured: "Structured draft",
  needs_more_proof: "Needs more proof",
  approved_private: "Approved private",
  approved_public_safe: "Approved public-safe",
  do_not_use: "Do not use",
};

export function parseLedgerFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): LedgerFilters {
  const parsed = ledgerSearchParamsSchema.parse(searchParams ?? {});
  const filters: LedgerFilters = {};

  if (parsed.type) {
    filters.type = parsed.type;
  }

  if (parsed.ledgerStatus) {
    filters.ledgerStatus = parsed.ledgerStatus;
  }

  if (parsed.proofStrength) {
    filters.proofStrength = parsed.proofStrength;
  }

  if (parsed.project) {
    filters.project = parsed.project;
  }

  if (parsed.from) {
    filters.from = parsed.from;
  }

  if (parsed.to) {
    filters.to = parsed.to;
  }

  if (parsed.evidence) {
    filters.evidence = parsed.evidence;
  }

  return filters;
}

export function hasActiveLedgerFilters(filters: LedgerFilters) {
  return Boolean(
    filters.type ||
      filters.ledgerStatus ||
      filters.proofStrength ||
      filters.project ||
      filters.from ||
      filters.to,
  );
}

export function isLedgerRecordInDateWindow(
  record: {
    time_start: string | null;
    time_end: string | null;
    created_at: string;
  },
  filters: Pick<LedgerFilters, "from" | "to">,
) {
  if (!filters.from && !filters.to) {
    return true;
  }

  const recordStart = record.time_start
    ? new Date(record.time_start).getTime()
    : record.time_end
      ? new Date(record.time_end).getTime()
      : new Date(record.created_at).getTime();
  const recordEnd = record.time_end
    ? new Date(record.time_end).getTime()
    : record.time_start
      ? new Date(record.time_start).getTime()
      : new Date(record.created_at).getTime();
  const filterStart = filters.from
    ? new Date(`${filters.from}T00:00:00.000Z`).getTime()
    : Number.NEGATIVE_INFINITY;
  const filterEnd = filters.to
    ? new Date(`${filters.to}T23:59:59.999Z`).getTime()
    : Number.POSITIVE_INFINITY;

  return recordStart <= filterEnd && recordEnd >= filterStart;
}

export function getLedgerStatusLabel(
  verificationStatus: VerificationStatus,
  approvalStatus: ApprovalStatus,
) {
  const status = getLedgerStatus(verificationStatus, approvalStatus);

  return status ? ledgerStatusLabels[status] : "Invalid state";
}
