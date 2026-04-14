import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { EvidenceLinkInput } from "@/types/domain";
import { EvidenceError } from "@/lib/evidence/errors";
import { getLedgerStatus } from "@/lib/evidence/state-machine";
import { buildExportFilename } from "./contracts";
import type { EvidenceSnapshotRecord } from "./serialize";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type EvidenceLinkRow = Database["public"]["Tables"]["evidence_links"]["Row"];
type ExportRow = Database["public"]["Tables"]["exports"]["Row"];
type ResumeBulletRow = Database["public"]["Tables"]["resume_bullets"]["Row"];
type RoleVariantRow = Database["public"]["Tables"]["role_variants"]["Row"];
type ChangelogEntryRow = Database["public"]["Tables"]["changelog_entries"]["Row"];

type EvidenceSnapshotCandidateRow = Pick<
  EvidenceRow,
  | "id"
  | "title"
  | "type"
  | "project_name"
  | "source_system"
  | "updated_at"
  | "verification_status"
  | "approval_status"
>;

export interface ExportableResumeTarget {
  roleVariantId: string;
  roleName: string;
  targetTitle: string | null;
  approvedBulletCount: number;
  latestApprovedAt: string;
}

export interface ExportableChangelogTarget {
  entryId: string;
  title: string;
  periodType: ChangelogEntryRow["period_type"];
  periodStart: string;
  periodEnd: string;
  approvalStatus: ChangelogEntryRow["approval_status"];
  updatedAt: string;
}

export interface EvidenceSnapshotCandidate {
  id: string;
  title: string;
  type: EvidenceRow["type"];
  projectName: string | null;
  sourceSystem: EvidenceRow["source_system"];
  updatedAt: string;
  ledgerStatus: string;
}

export interface ExportHistoryRecord {
  id: string;
  targetType: ExportRow["target_type"];
  targetId: string | null;
  format: ExportRow["format"];
  status: ExportRow["status"];
  createdAt: string;
  targetLabel: string;
  targetSummary: string;
  fileName: string;
}

function assertNoQueryError(error: PostgrestError | null, message: string) {
  if (error) {
    throw new EvidenceError(message, 500);
  }
}

function toLinkInput(
  row: Pick<EvidenceLinkRow, "label" | "url" | "link_type">,
): EvidenceLinkInput {
  return {
    label: row.label,
    url: row.url,
    linkType: row.link_type,
  };
}

function formatPeriodSummary(
  entry: Pick<ChangelogEntryRow, "period_type" | "period_start" | "period_end">,
) {
  return `${entry.period_type} • ${entry.period_start} to ${entry.period_end}`;
}

export async function listExportableResumeTargets(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: rolesData, error: rolesError } = await supabase
    .from("role_variants")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  assertNoQueryError(rolesError, "Could not load exportable role variants.");

  const roles = (rolesData ?? []) as RoleVariantRow[];

  if (!roles.length) {
    return [] as ExportableResumeTarget[];
  }

  const roleIds = roles.map((role) => role.id);
  const { data: bulletsData, error: bulletsError } = await supabase
    .from("resume_bullets")
    .select("id, role_variant_id, approval_status, updated_at")
    .eq("user_id", userId)
    .in("role_variant_id", roleIds)
    .in("approval_status", ["approved_private", "approved_public_safe"]);

  assertNoQueryError(bulletsError, "Could not load approved resume bullets.");

  const bullets = (bulletsData ?? []) as Array<
    Pick<ResumeBulletRow, "id" | "role_variant_id" | "approval_status" | "updated_at">
  >;
  const grouped = new Map<
    string,
    { count: number; latestApprovedAt: string }
  >();

  for (const bullet of bullets) {
    const current = grouped.get(bullet.role_variant_id);

    if (!current) {
      grouped.set(bullet.role_variant_id, {
        count: 1,
        latestApprovedAt: bullet.updated_at,
      });
      continue;
    }

    grouped.set(bullet.role_variant_id, {
      count: current.count + 1,
      latestApprovedAt:
        current.latestApprovedAt > bullet.updated_at
          ? current.latestApprovedAt
          : bullet.updated_at,
    });
  }

  return roles
    .map((role) => {
      const summary = grouped.get(role.id);

      if (!summary) {
        return null;
      }

      return {
        roleVariantId: role.id,
        roleName: role.name,
        targetTitle: role.target_title,
        approvedBulletCount: summary.count,
        latestApprovedAt: summary.latestApprovedAt,
      } satisfies ExportableResumeTarget;
    })
    .filter((target): target is ExportableResumeTarget => target !== null);
}

export async function listExportableChangelogTargets(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("changelog_entries")
    .select("*")
    .eq("user_id", userId)
    .in("approval_status", ["approved_private", "approved_public_safe"])
    .order("updated_at", { ascending: false });

  assertNoQueryError(error, "Could not load exportable changelog entries.");

  return ((data ?? []) as ChangelogEntryRow[]).map((entry) => ({
    entryId: entry.id,
    title: entry.title,
    periodType: entry.period_type,
    periodStart: entry.period_start,
    periodEnd: entry.period_end,
    approvalStatus: entry.approval_status,
    updatedAt: entry.updated_at,
  })) satisfies ExportableChangelogTarget[];
}

export async function listEvidenceSnapshotCandidates(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 100,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, title, type, project_name, source_system, updated_at, verification_status, approval_status",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  assertNoQueryError(error, "Could not load recent evidence for snapshots.");

  return ((data ?? []) as EvidenceSnapshotCandidateRow[]).map((row) => {
    const ledgerStatus = getLedgerStatus(
      row.verification_status,
      row.approval_status,
    );

    if (!ledgerStatus) {
      throw new EvidenceError(
        `Evidence item ${row.id} is stored in an invalid ledger state.`,
        500,
      );
    }

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      projectName: row.project_name,
      sourceSystem: row.source_system,
      updatedAt: row.updated_at,
      ledgerStatus,
    } satisfies EvidenceSnapshotCandidate;
  });
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

  assertNoQueryError(error, "Could not load evidence links for the export snapshot.");

  const linksByEvidenceId = new Map<string, EvidenceLinkInput[]>();

  for (const row of (data ?? []) as Array<
    Pick<EvidenceLinkRow, "evidence_item_id" | "label" | "url" | "link_type">
  >) {
    const current = linksByEvidenceId.get(row.evidence_item_id) ?? [];
    current.push(toLinkInput(row));
    linksByEvidenceId.set(row.evidence_item_id, current);
  }

  return linksByEvidenceId;
}

export async function getEvidenceSnapshotSelection(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceIds: string[],
) {
  if (!evidenceIds.length) {
    return [] as EvidenceSnapshotRecord[];
  }

  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, type, title, raw_input, factual_summary, time_start, time_end, source_system, source_external_id, source_url, project_name, visibility_default, proof_strength, verification_status, approval_status, ai_structured_payload, metadata, created_at, updated_at",
    )
    .eq("user_id", userId)
    .in("id", evidenceIds);

  assertNoQueryError(error, "Could not load evidence for the export snapshot.");

  const evidenceRows = (data ?? []) as Array<
    Pick<
      EvidenceRow,
      | "id"
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
    >
  >;

  if (evidenceRows.length !== evidenceIds.length) {
    throw new EvidenceError(
      "Evidence snapshots only accept your explicitly selected evidence.",
      400,
    );
  }

  const linksByEvidenceId = await listLinksForEvidenceIds(supabase, evidenceIds);
  const rowsById = new Map(
    evidenceRows.map((row) => [
      row.id,
      {
        id: row.id,
        type: row.type,
        title: row.title,
        rawInput: row.raw_input,
        factualSummary: row.factual_summary,
        timeStart: row.time_start,
        timeEnd: row.time_end,
        sourceSystem: row.source_system,
        sourceExternalId: row.source_external_id,
        sourceUrl: row.source_url,
        projectName: row.project_name,
        visibilityDefault: row.visibility_default,
        proofStrength: row.proof_strength,
        verificationStatus: row.verification_status,
        approvalStatus: row.approval_status,
        aiStructuredPayload: row.ai_structured_payload,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        links: linksByEvidenceId.get(row.id) ?? [],
      } satisfies EvidenceSnapshotRecord,
    ]),
  );

  return evidenceIds.map((id) => {
    const row = rowsById.get(id);

    if (!row) {
      throw new EvidenceError(
        "Evidence snapshots could not resolve every selected record.",
        500,
      );
    }

    return row;
  });
}

function resolveExportTargetLabel(
  row: ExportRow,
  rolesById: Map<string, RoleVariantRow>,
  changelogById: Map<string, ChangelogEntryRow>,
) {
  if (row.target_type === "resume_bullets" && row.target_id) {
    const role = rolesById.get(row.target_id);

    return {
      label: role?.name ?? "Resume bullets",
      summary: role?.target_title ?? "Approved role-scoped bullet set",
    };
  }

  if (row.target_type === "changelog_entry" && row.target_id) {
    const entry = changelogById.get(row.target_id);

    return {
      label: entry?.title ?? "Changelog export",
      summary: entry ? formatPeriodSummary(entry) : "Approved changelog entry",
    };
  }

  return {
    label: "Evidence snapshot",
    summary: "Selected evidence JSON snapshot",
  };
}

async function resolveExportHistoryRows(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: ExportRow[],
) {
  const roleIds = rows
    .filter(
      (row): row is ExportRow & { target_id: string } =>
        row.target_type === "resume_bullets" && Boolean(row.target_id),
    )
    .map((row) => row.target_id);
  const changelogIds = rows
    .filter(
      (row): row is ExportRow & { target_id: string } =>
        row.target_type === "changelog_entry" && Boolean(row.target_id),
    )
    .map((row) => row.target_id);

  const rolesById = new Map<string, RoleVariantRow>();
  const changelogById = new Map<string, ChangelogEntryRow>();

  if (roleIds.length) {
    const { data, error } = await supabase
      .from("role_variants")
      .select("*")
      .eq("user_id", userId)
      .in("id", roleIds);

    assertNoQueryError(error, "Could not load export role labels.");

    for (const role of (data ?? []) as RoleVariantRow[]) {
      rolesById.set(role.id, role);
    }
  }

  if (changelogIds.length) {
    const { data, error } = await supabase
      .from("changelog_entries")
      .select("*")
      .eq("user_id", userId)
      .in("id", changelogIds);

    assertNoQueryError(error, "Could not load export changelog labels.");

    for (const entry of (data ?? []) as ChangelogEntryRow[]) {
      changelogById.set(entry.id, entry);
    }
  }

  return rows.map((row) => {
    const target = resolveExportTargetLabel(row, rolesById, changelogById);

    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      format: row.format,
      status: row.status,
      createdAt: row.created_at,
      targetLabel: target.label,
      targetSummary: target.summary,
      fileName: buildExportFilename({
        targetType: row.target_type,
        targetLabel: target.label,
        format: row.format,
        createdAt: row.created_at,
      }),
    } satisfies ExportHistoryRecord;
  });
}

export async function listExportHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
) {
  const { data, error } = await supabase
    .from("exports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  assertNoQueryError(error, "Could not load export history.");

  return resolveExportHistoryRows(supabase, userId, (data ?? []) as ExportRow[]);
}

export async function getExportById(
  supabase: SupabaseClient<Database>,
  userId: string,
  exportId: string,
) {
  const { data, error } = await supabase
    .from("exports")
    .select("*")
    .eq("user_id", userId)
    .eq("id", exportId)
    .maybeSingle();

  assertNoQueryError(error, "Could not load the export.");

  return (data ?? null) as ExportRow | null;
}

export async function getExportHistoryRecordById(
  supabase: SupabaseClient<Database>,
  userId: string,
  exportId: string,
) {
  const row = await getExportById(supabase, userId, exportId);

  if (!row) {
    return null;
  }

  const [historyRecord] = await resolveExportHistoryRows(supabase, userId, [row]);

  return historyRecord ?? null;
}
