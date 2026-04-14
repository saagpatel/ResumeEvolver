import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { EvidenceLinkInput, EvidenceType, ManualEvidenceType } from "@/types/domain";
import { manualEvidenceTypes } from "@/types/domain";
import type { LedgerFilters } from "./ledger";
import { isLedgerRecordInDateWindow } from "./ledger";
import { EvidenceError } from "./errors";
import { getLedgerStatus } from "./state-machine";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type EvidenceLinkRow = Database["public"]["Tables"]["evidence_links"]["Row"];
type ResumeBulletEvidenceRow =
  Database["public"]["Tables"]["resume_bullet_evidence"]["Row"];
type ChangelogEntryEvidenceRow =
  Database["public"]["Tables"]["changelog_entry_evidence"]["Row"];

type EvidenceSummarySnapshot = Pick<
  EvidenceRow,
  | "id"
  | "type"
  | "title"
  | "project_name"
  | "time_start"
  | "time_end"
  | "source_system"
  | "proof_strength"
  | "verification_status"
  | "approval_status"
  | "visibility_default"
  | "updated_at"
  | "created_at"
>;

type EvidenceDetailSnapshot = Pick<
  EvidenceRow,
  | "id"
  | "user_id"
  | "type"
  | "title"
  | "raw_input"
  | "factual_summary"
  | "time_start"
  | "time_end"
  | "source_system"
  | "source_external_id"
  | "source_url"
  | "project_name"
  | "visibility_default"
  | "proof_strength"
  | "verification_status"
  | "approval_status"
  | "ai_structured_payload"
  | "metadata"
  | "created_at"
  | "updated_at"
>;

export interface EvidenceRecordWithLinks extends EvidenceRow {
  links: EvidenceLinkInput[];
}

export interface LedgerSummaryRecord extends EvidenceSummarySnapshot {
  ledgerStatus: NonNullable<ReturnType<typeof getLedgerStatus>>;
  linkCount: number;
  downstreamResumeBulletCount: number;
  downstreamChangelogCount: number;
}

export interface LedgerDetailRecord extends EvidenceDetailSnapshot {
  ledgerStatus: NonNullable<ReturnType<typeof getLedgerStatus>>;
  links: EvidenceLinkInput[];
  downstreamResumeBulletIds: string[];
  downstreamChangelogIds: string[];
}

function isManualEvidenceType(value: EvidenceType): value is ManualEvidenceType {
  return manualEvidenceTypes.includes(value as ManualEvidenceType);
}

function assertNoQueryError(error: PostgrestError | null, message: string) {
  if (error) {
    throw new EvidenceError(message, 500);
  }
}

function toEvidenceLinkInput(
  row: Pick<EvidenceLinkRow, "label" | "url" | "link_type">,
): EvidenceLinkInput {
  return {
    label: row.label,
    url: row.url,
    linkType: row.link_type,
  };
}

function getRequiredLedgerStatus(
  row: Pick<EvidenceRow, "id" | "verification_status" | "approval_status">,
) {
  const status = getLedgerStatus(row.verification_status, row.approval_status);

  if (!status) {
    throw new EvidenceError(
      `Evidence item ${row.id} is stored in an invalid ledger state.`,
      500,
    );
  }

  return status;
}

async function listLinksForEvidenceIds(
  supabase: SupabaseClient<Database>,
  evidenceIds: string[],
) {
  if (!evidenceIds.length) {
    return new Map<string, EvidenceLinkInput[]>();
  }

  const { data, error } = await supabase
    .from("evidence_links")
    .select("evidence_item_id, label, url, link_type")
    .in("evidence_item_id", evidenceIds);

  assertNoQueryError(error, "Could not load evidence links.");

  const linkRows = (data ?? []) as Array<
    Pick<EvidenceLinkRow, "evidence_item_id" | "label" | "url" | "link_type">
  >;
  const linksByEvidenceId = new Map<string, EvidenceLinkInput[]>();

  for (const link of linkRows) {
    const existing = linksByEvidenceId.get(link.evidence_item_id) ?? [];
    existing.push(toEvidenceLinkInput(link));
    linksByEvidenceId.set(link.evidence_item_id, existing);
  }

  return linksByEvidenceId;
}

async function listLinkCountsForEvidenceIds(
  supabase: SupabaseClient<Database>,
  evidenceIds: string[],
) {
  if (!evidenceIds.length) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("evidence_links")
    .select("evidence_item_id")
    .in("evidence_item_id", evidenceIds);

  assertNoQueryError(error, "Could not load ledger link counts.");

  const counts = new Map<string, number>();

  for (const row of (data ?? []) as Array<Pick<EvidenceLinkRow, "evidence_item_id">>) {
    counts.set(row.evidence_item_id, (counts.get(row.evidence_item_id) ?? 0) + 1);
  }

  return counts;
}

async function listDownstreamUsageCountsForEvidenceIds(
  supabase: SupabaseClient<Database>,
  evidenceIds: string[],
) {
  const resumeCounts = new Map<string, number>();
  const changelogCounts = new Map<string, number>();

  if (!evidenceIds.length) {
    return { resumeCounts, changelogCounts };
  }

  const { data: resumeData, error: resumeError } = await supabase
    .from("resume_bullet_evidence")
    .select("evidence_item_id, resume_bullet_id")
    .in("evidence_item_id", evidenceIds);

  assertNoQueryError(resumeError, "Could not load resume linkage counts.");

  for (const row of (resumeData ?? []) as Array<
    Pick<ResumeBulletEvidenceRow, "evidence_item_id" | "resume_bullet_id">
  >) {
    resumeCounts.set(row.evidence_item_id, (resumeCounts.get(row.evidence_item_id) ?? 0) + 1);
  }

  const { data: changelogData, error: changelogError } = await supabase
    .from("changelog_entry_evidence")
    .select("evidence_item_id, changelog_entry_id")
    .in("evidence_item_id", evidenceIds);

  assertNoQueryError(changelogError, "Could not load changelog linkage counts.");

  for (const row of (changelogData ?? []) as Array<
    Pick<ChangelogEntryEvidenceRow, "evidence_item_id" | "changelog_entry_id">
  >) {
    changelogCounts.set(
      row.evidence_item_id,
      (changelogCounts.get(row.evidence_item_id) ?? 0) + 1,
    );
  }

  return { resumeCounts, changelogCounts };
}

async function getDownstreamUsageForEvidenceId(
  supabase: SupabaseClient<Database>,
  evidenceId: string,
) {
  const { data: resumeData, error: resumeError } = await supabase
    .from("resume_bullet_evidence")
    .select("resume_bullet_id")
    .eq("evidence_item_id", evidenceId);

  assertNoQueryError(resumeError, "Could not load resume linkage details.");

  const { data: changelogData, error: changelogError } = await supabase
    .from("changelog_entry_evidence")
    .select("changelog_entry_id")
    .eq("evidence_item_id", evidenceId);

  assertNoQueryError(changelogError, "Could not load changelog linkage details.");

  return {
    downstreamResumeBulletIds: (resumeData ?? []).map((row) => row.resume_bullet_id),
    downstreamChangelogIds: (changelogData ?? []).map((row) => row.changelog_entry_id),
  };
}

function attachLinks(
  evidenceRows: EvidenceRow[],
  linksByEvidenceId: Map<string, EvidenceLinkInput[]>,
) {
  return evidenceRows.map((row) => ({
    ...row,
    links: linksByEvidenceId.get(row.id) ?? [],
  }));
}

export async function getEvidenceByIdWithLinks(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceId: string,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", evidenceId)
    .maybeSingle();

  assertNoQueryError(error, "Could not load evidence detail.");

  const evidence = (data ?? null) as EvidenceRow | null;

  if (!evidence) {
    return null;
  }

  const linksByEvidenceId = await listLinksForEvidenceIds(supabase, [evidence.id]);

  return {
    ...evidence,
    links: linksByEvidenceId.get(evidence.id) ?? [],
  } satisfies EvidenceRecordWithLinks;
}

export async function listRecentEditableEvidence(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 8,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("*")
    .eq("user_id", userId)
    .eq("source_system", "manual")
    .or(
      "and(verification_status.eq.unreviewed,approval_status.eq.draft),and(verification_status.eq.structured,approval_status.eq.draft),and(verification_status.eq.structured,approval_status.eq.needs_more_proof)",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  assertNoQueryError(error, "Could not load recent editable evidence.");

  const evidenceRows = ((data ?? []) as EvidenceRow[]).filter((row) =>
    isManualEvidenceType(row.type),
  );
  const linksByEvidenceId = await listLinksForEvidenceIds(
    supabase,
    evidenceRows.map((row) => row.id),
  );

  return attachLinks(evidenceRows, linksByEvidenceId);
}

export async function listReviewQueueEvidence(
  supabase: SupabaseClient<Database>,
  userId: string,
  typeFilter?: EvidenceType,
) {
  let query = supabase
    .from("evidence_items")
    .select("*")
    .eq("user_id", userId)
    .or(
      "and(verification_status.eq.unreviewed,approval_status.eq.draft),and(verification_status.eq.structured,approval_status.eq.draft),and(verification_status.eq.structured,approval_status.eq.needs_more_proof)",
    )
    .order("updated_at", { ascending: false });

  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }

  const { data, error } = await query;

  assertNoQueryError(error, "Could not load the review queue.");

  const evidenceRows = (data ?? []) as EvidenceRow[];
  const linksByEvidenceId = await listLinksForEvidenceIds(
    supabase,
    evidenceRows.map((row) => row.id),
  );

  return attachLinks(evidenceRows, linksByEvidenceId);
}

export async function listLedgerProjectNames(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("project_name")
    .eq("user_id", userId)
    .order("project_name", { ascending: true });

  assertNoQueryError(error, "Could not load ledger project filters.");

  const projectNames = new Set<string>();

  for (const row of (data ?? []) as Array<Pick<EvidenceRow, "project_name">>) {
    if (row.project_name) {
      projectNames.add(row.project_name);
    }
  }

  return Array.from(projectNames).sort((left, right) =>
    left.localeCompare(right),
  );
}

export async function listLedgerEvidence(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: LedgerFilters,
) {
  let query = supabase
    .from("evidence_items")
    .select(
      "id, type, title, project_name, time_start, time_end, source_system, proof_strength, verification_status, approval_status, visibility_default, updated_at, created_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  if (filters.proofStrength) {
    query = query.eq("proof_strength", filters.proofStrength);
  }

  if (filters.project) {
    query = query.eq("project_name", filters.project);
  }

  const { data, error } = await query;

  assertNoQueryError(error, "Could not load ledger evidence.");

  const evidenceRows = ((data ?? []) as EvidenceSummarySnapshot[])
    .filter((row) =>
      filters.ledgerStatus
        ? getRequiredLedgerStatus(row) === filters.ledgerStatus
        : true,
    )
    .filter((row) => isLedgerRecordInDateWindow(row, filters));

  const evidenceIds = evidenceRows.map((row) => row.id);
  const linkCounts = await listLinkCountsForEvidenceIds(supabase, evidenceIds);
  const { resumeCounts, changelogCounts } =
    await listDownstreamUsageCountsForEvidenceIds(supabase, evidenceIds);

  return evidenceRows.map((row) => ({
    ...row,
    ledgerStatus: getRequiredLedgerStatus(row),
    linkCount: linkCounts.get(row.id) ?? 0,
    downstreamResumeBulletCount: resumeCounts.get(row.id) ?? 0,
    downstreamChangelogCount: changelogCounts.get(row.id) ?? 0,
  })) satisfies LedgerSummaryRecord[];
}

export async function getLedgerEvidenceDetail(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceId: string,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, user_id, type, title, raw_input, factual_summary, time_start, time_end, source_system, source_external_id, source_url, project_name, visibility_default, proof_strength, verification_status, approval_status, ai_structured_payload, metadata, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("id", evidenceId)
    .maybeSingle();

  assertNoQueryError(error, "Could not load ledger evidence detail.");

  const evidence = (data ?? null) as EvidenceDetailSnapshot | null;

  if (!evidence) {
    return null;
  }

  const linksByEvidenceId = await listLinksForEvidenceIds(supabase, [evidence.id]);
  const downstreamUsage = await getDownstreamUsageForEvidenceId(supabase, evidence.id);

  return {
    ...evidence,
    ledgerStatus: getRequiredLedgerStatus(evidence),
    links: linksByEvidenceId.get(evidence.id) ?? [],
    downstreamResumeBulletIds: downstreamUsage.downstreamResumeBulletIds,
    downstreamChangelogIds: downstreamUsage.downstreamChangelogIds,
  } satisfies LedgerDetailRecord;
}
