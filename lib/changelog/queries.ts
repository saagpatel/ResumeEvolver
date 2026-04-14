import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";
import { isApprovedEvidence } from "@/lib/evidence/state-machine";
import type { ResolvedChangelogPeriod } from "./contracts";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type ChangelogEntryRow = Database["public"]["Tables"]["changelog_entries"]["Row"];
type ChangelogEntryEvidenceRow =
  Database["public"]["Tables"]["changelog_entry_evidence"]["Row"];

type ApprovedEvidencePeriodSnapshot = Pick<
  EvidenceRow,
  | "id"
  | "type"
  | "title"
  | "factual_summary"
  | "project_name"
  | "proof_strength"
  | "source_system"
  | "source_url"
  | "time_start"
  | "time_end"
  | "approval_status"
  | "verification_status"
  | "created_at"
  | "updated_at"
>;

type ApprovedEvidenceGenerationSnapshot = Pick<
  EvidenceRow,
  | "id"
  | "type"
  | "title"
  | "raw_input"
  | "factual_summary"
  | "project_name"
  | "proof_strength"
  | "source_system"
  | "source_url"
  | "time_start"
  | "time_end"
  | "approval_status"
  | "verification_status"
  | "created_at"
>;

export interface ChangelogCandidateEvidence
  extends ApprovedEvidencePeriodSnapshot {
  effectiveDate: string;
  suggestionReason: string;
}

export interface ApprovedEvidenceForChangelogGeneration
  extends ApprovedEvidenceGenerationSnapshot {
  effectiveDate: string;
}

export interface ChangelogSupportingEvidenceReference {
  id: string;
  title: string;
  type: EvidenceRow["type"];
  projectName: string | null;
  proofStrength: EvidenceRow["proof_strength"];
  sourceSystem: EvidenceRow["source_system"];
  approvalStatus: EvidenceRow["approval_status"];
}

export interface ChangelogEntryRecord extends ChangelogEntryRow {
  supportingEvidence: ChangelogSupportingEvidenceReference[];
}

function assertNoQueryError(error: PostgrestError | null, message: string) {
  if (error) {
    throw new EvidenceError(message, 500);
  }
}

function proofStrengthRank(value: EvidenceRow["proof_strength"]) {
  switch (value) {
    case "strong":
      return 3;
    case "moderate":
      return 2;
    default:
      return 1;
  }
}

export function getEffectiveEvidenceDate(
  evidence: Pick<EvidenceRow, "time_end" | "time_start" | "created_at">,
) {
  const sourceValue = evidence.time_end ?? evidence.time_start ?? evidence.created_at;

  return new Date(sourceValue).toISOString().slice(0, 10);
}

export function isEvidenceInsidePeriod(
  effectiveDate: string,
  period: ResolvedChangelogPeriod,
) {
  return (
    effectiveDate >= period.periodStart && effectiveDate <= period.periodEnd
  );
}

function sortCandidateEvidence(
  left: ChangelogCandidateEvidence,
  right: ChangelogCandidateEvidence,
) {
  const proofDelta =
    proofStrengthRank(right.proof_strength) -
    proofStrengthRank(left.proof_strength);

  if (proofDelta !== 0) {
    return proofDelta;
  }

  if (left.effectiveDate !== right.effectiveDate) {
    return right.effectiveDate.localeCompare(left.effectiveDate);
  }

  return right.updated_at.localeCompare(left.updated_at);
}

export async function listApprovedEvidenceForPeriod(
  supabase: SupabaseClient<Database>,
  userId: string,
  period: ResolvedChangelogPeriod,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, type, title, factual_summary, project_name, proof_strength, source_system, source_url, time_start, time_end, approval_status, verification_status, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("verification_status", "approved")
    .in("approval_status", ["approved_private", "approved_public_safe"])
    .order("updated_at", { ascending: false });

  assertNoQueryError(error, "Could not load approved evidence for this period.");

  const candidates = ((data ?? []) as ApprovedEvidencePeriodSnapshot[])
    .map((row) => ({
      ...row,
      effectiveDate: getEffectiveEvidenceDate(row),
      suggestionReason:
        row.proof_strength === "strong"
          ? "Strong proof inside this period."
          : "Approved evidence inside this period.",
    }))
    .filter((row) => isEvidenceInsidePeriod(row.effectiveDate, period))
    .sort(sortCandidateEvidence);

  return {
    suggested: candidates.slice(0, 8),
    additional: candidates.slice(8, 20),
  };
}

export async function getApprovedEvidenceSelectionForPeriod(
  supabase: SupabaseClient<Database>,
  userId: string,
  period: ResolvedChangelogPeriod,
  evidenceIds: string[],
) {
  if (!evidenceIds.length) {
    return [] as ApprovedEvidenceForChangelogGeneration[];
  }

  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, type, title, raw_input, factual_summary, project_name, proof_strength, source_system, source_url, time_start, time_end, approval_status, verification_status, created_at",
    )
    .eq("user_id", userId)
    .in("id", evidenceIds);

  assertNoQueryError(error, "Could not load the selected evidence.");

  const evidenceRows = (data ?? []) as ApprovedEvidenceGenerationSnapshot[];

  if (evidenceRows.length !== evidenceIds.length) {
    throw new EvidenceError(
      "Changelog drafting only accepts your explicitly selected approved evidence.",
      409,
    );
  }

  const evidenceById = new Map(
    evidenceRows.map((row) => [
      row.id,
      {
        ...row,
        effectiveDate: getEffectiveEvidenceDate(row),
      } satisfies ApprovedEvidenceForChangelogGeneration,
    ]),
  );

  const orderedRows = evidenceIds
    .map((id) => evidenceById.get(id))
    .filter(
      (row): row is ApprovedEvidenceForChangelogGeneration => row !== undefined,
    );

  if (orderedRows.length !== evidenceIds.length) {
    throw new EvidenceError(
      "Changelog drafting could not resolve every selected evidence item.",
      409,
    );
  }

  for (const row of orderedRows) {
    if (!isApprovedEvidence(row.verification_status, row.approval_status)) {
      throw new EvidenceError(
        "Changelog drafting rejects unapproved evidence.",
        409,
      );
    }

    if (!isEvidenceInsidePeriod(row.effectiveDate, period)) {
      throw new EvidenceError(
        "Changelog drafting rejects evidence outside the selected period.",
        409,
      );
    }
  }

  return orderedRows;
}

async function loadSupportingEvidenceForEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
  entries: ChangelogEntryRow[],
) {
  if (!entries.length) {
    return new Map<string, ChangelogSupportingEvidenceReference[]>();
  }

  const entryIds = entries.map((entry) => entry.id);
  const { data: linkData, error: linkError } = await supabase
    .from("changelog_entry_evidence")
    .select("changelog_entry_id, evidence_item_id")
    .in("changelog_entry_id", entryIds);

  assertNoQueryError(linkError, "Could not load changelog provenance.");

  const links = (linkData ?? []) as ChangelogEntryEvidenceRow[];
  const evidenceIds = Array.from(new Set(links.map((row) => row.evidence_item_id)));

  if (!evidenceIds.length) {
    return new Map<string, ChangelogSupportingEvidenceReference[]>();
  }

  const { data: evidenceData, error: evidenceError } = await supabase
    .from("evidence_items")
    .select(
      "id, title, type, project_name, proof_strength, source_system, approval_status",
    )
    .eq("user_id", userId)
    .in("id", evidenceIds);

  assertNoQueryError(evidenceError, "Could not load changelog supporting evidence.");

  const evidenceById = new Map(
    ((evidenceData ?? []) as Array<
      Pick<
        EvidenceRow,
        | "id"
        | "title"
        | "type"
        | "project_name"
        | "proof_strength"
        | "source_system"
        | "approval_status"
      >
    >).map((row) => [
      row.id,
      {
        id: row.id,
        title: row.title,
        type: row.type,
        projectName: row.project_name,
        proofStrength: row.proof_strength,
        sourceSystem: row.source_system,
        approvalStatus: row.approval_status,
      } satisfies ChangelogSupportingEvidenceReference,
    ]),
  );

  const referencesByEntryId = new Map<string, ChangelogSupportingEvidenceReference[]>();

  for (const link of links) {
    const evidence = evidenceById.get(link.evidence_item_id);

    if (!evidence) {
      continue;
    }

    const current = referencesByEntryId.get(link.changelog_entry_id) ?? [];
    current.push(evidence);
    referencesByEntryId.set(link.changelog_entry_id, current);
  }

  return referencesByEntryId;
}

export async function getChangelogEntryForPeriod(
  supabase: SupabaseClient<Database>,
  userId: string,
  period: ResolvedChangelogPeriod,
) {
  const { data, error } = await supabase
    .from("changelog_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("period_type", period.periodType)
    .eq("period_start", period.periodStart)
    .eq("period_end", period.periodEnd)
    .maybeSingle();

  assertNoQueryError(error, "Could not load the changelog draft for this period.");

  if (!data) {
    return null;
  }

  const entry = data as ChangelogEntryRow;
  const evidenceByEntryId = await loadSupportingEvidenceForEntries(
    supabase,
    userId,
    [entry],
  );

  return {
    ...entry,
    supportingEvidence: evidenceByEntryId.get(entry.id) ?? [],
  } satisfies ChangelogEntryRecord;
}

export async function getChangelogEntryById(
  supabase: SupabaseClient<Database>,
  userId: string,
  entryId: string,
) {
  const { data, error } = await supabase
    .from("changelog_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("id", entryId)
    .maybeSingle();

  assertNoQueryError(error, "Could not load the changelog entry.");

  if (!data) {
    return null;
  }

  const entry = data as ChangelogEntryRow;
  const evidenceByEntryId = await loadSupportingEvidenceForEntries(
    supabase,
    userId,
    [entry],
  );

  return {
    ...entry,
    supportingEvidence: evidenceByEntryId.get(entry.id) ?? [],
  } satisfies ChangelogEntryRecord;
}
