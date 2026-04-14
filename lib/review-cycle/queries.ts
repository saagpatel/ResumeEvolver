import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";
import {
  getDefaultChangelogPeriod,
  resolveChangelogPeriod,
  type ResolvedChangelogPeriod,
} from "@/lib/changelog/contracts";
import { getChangelogEntryForPeriod, getEffectiveEvidenceDate } from "@/lib/changelog/queries";
import { listRoleVariants } from "@/lib/roles/queries";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type ResumeBulletRow = Database["public"]["Tables"]["resume_bullets"]["Row"];
type ExportRow = Database["public"]["Tables"]["exports"]["Row"];

export interface ReviewCyclePeriodSummary {
  label: string;
  periodType: ResolvedChangelogPeriod["periodType"];
  periodStart: string;
  periodEnd: string;
  entryId: string | null;
  approvalStatus: string | null;
  updatedAt: string | null;
}

export interface ReviewCycleSummary {
  reviewBacklog: {
    unreviewedCount: number;
    structuredDecisionCount: number;
  };
  evidenceMomentum: {
    approvedThisMonth: number;
    approvedThisQuarter: number;
  };
  resumeCoverage: {
    approvedRoleSetCount: number;
    roles: Array<{
      roleVariantId: string;
      roleName: string;
      approvedBulletCount: number;
    }>;
  };
  changelogCoverage: {
    month: ReviewCyclePeriodSummary;
    quarter: ReviewCyclePeriodSummary;
  };
  exportRecency: {
    resumeBullets: string | null;
    changelogEntry: string | null;
    evidenceSnapshot: string | null;
  };
  nextStep: {
    title: string;
    description: string;
  };
}

function assertNoQueryError(error: PostgrestError | null, message: string) {
  if (error) {
    throw new EvidenceError(message, 500);
  }
}

function getQuarterPeriod(now = new Date()) {
  const month = now.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));

  return resolveChangelogPeriod("quarterly", quarterStart.toISOString().slice(0, 10));
}

function formatPeriodLabel(period: ResolvedChangelogPeriod) {
  const start = new Date(`${period.periodStart}T00:00:00.000Z`);
  const end = new Date(`${period.periodEnd}T00:00:00.000Z`);

  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

export function determineReviewCycleNextStep(input: {
  unreviewedCount: number;
  structuredDecisionCount: number;
  monthApprovalStatus: string | null;
  quarterApprovalStatus: string | null;
  approvedRoleSetCount: number;
  resumeBulletsExportedAt: string | null;
  changelogEntryExportedAt: string | null;
}) {
  if (input.unreviewedCount > 0) {
    return {
      title: "Review unreviewed evidence",
      description: `You still have ${input.unreviewedCount} unreviewed evidence item${input.unreviewedCount === 1 ? "" : "s"} waiting for a first decision.`,
    };
  }

  if (input.structuredDecisionCount > 0) {
    return {
      title: "Finish structured review decisions",
      description: `You have ${input.structuredDecisionCount} structured evidence item${input.structuredDecisionCount === 1 ? "" : "s"} that still need an approval decision.`,
    };
  }

  if (
    input.monthApprovalStatus !== "approved_private" &&
    input.monthApprovalStatus !== "approved_public_safe"
  ) {
    return {
      title: "Finish this month's changelog",
      description: "Your current monthly changelog is still missing or not approved yet.",
    };
  }

  if (
    input.quarterApprovalStatus !== "approved_private" &&
    input.quarterApprovalStatus !== "approved_public_safe"
  ) {
    return {
      title: "Finish this quarter's changelog",
      description: "Your current quarterly changelog is still missing or not approved yet.",
    };
  }

  if (input.approvedRoleSetCount === 0) {
    return {
      title: "Approve resume bullets for at least one role",
      description: "You have no role-targeted resume bullet set approved for export yet.",
    };
  }

  if (!input.resumeBulletsExportedAt || !input.changelogEntryExportedAt) {
    return {
      title: "Create fresh exports",
      description: "Your approved outputs are ready, but you have not saved both resume and changelog exports yet.",
    };
  }

  return {
    title: "You are current",
    description: "Review, drafting, and export signals are all in a healthy state right now.",
  };
}

export async function getReviewCycleSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
) {
  const month = getDefaultChangelogPeriod(now);
  const quarter = getQuarterPeriod(now);

  const { data: evidenceData, error: evidenceError } = await supabase
    .from("evidence_items")
    .select("id, verification_status, approval_status, time_start, time_end, created_at")
    .eq("user_id", userId);

  assertNoQueryError(evidenceError, "Could not load review-cycle evidence state.");

  const evidenceRows = (evidenceData ?? []) as Array<
    Pick<
      EvidenceRow,
      | "id"
      | "verification_status"
      | "approval_status"
      | "time_start"
      | "time_end"
      | "created_at"
    >
  >;

  const approvedEvidenceRows = evidenceRows.filter(
    (row) =>
      row.verification_status === "approved" &&
      (row.approval_status === "approved_private" ||
        row.approval_status === "approved_public_safe"),
  );

  const approvedThisMonth = approvedEvidenceRows.filter((row) => {
    const effectiveDate = getEffectiveEvidenceDate({
      time_end: row.time_end,
      time_start: row.time_start,
      created_at: row.created_at,
    });

    return effectiveDate >= month.periodStart && effectiveDate <= month.periodEnd;
  }).length;

  const approvedThisQuarter = approvedEvidenceRows.filter((row) => {
    const effectiveDate = getEffectiveEvidenceDate({
      time_end: row.time_end,
      time_start: row.time_start,
      created_at: row.created_at,
    });

    return effectiveDate >= quarter.periodStart && effectiveDate <= quarter.periodEnd;
  }).length;

  const unreviewedCount = evidenceRows.filter(
    (row) =>
      row.verification_status === "unreviewed" && row.approval_status === "draft",
  ).length;
  const structuredDecisionCount = evidenceRows.filter(
    (row) => row.verification_status === "structured",
  ).length;

  const roles = await listRoleVariants(supabase, userId);
  const roleIds = roles.map((role) => role.id);
  let approvedRoleSets: ReviewCycleSummary["resumeCoverage"]["roles"] = [];

  if (roleIds.length) {
    const { data: bulletsData, error: bulletsError } = await supabase
      .from("resume_bullets")
      .select("role_variant_id, approval_status")
      .eq("user_id", userId)
      .in("role_variant_id", roleIds)
      .in("approval_status", ["approved_private", "approved_public_safe"]);

    assertNoQueryError(bulletsError, "Could not load approved resume bullet coverage.");

    const counts = new Map<string, number>();

    for (const bullet of (bulletsData ?? []) as Array<
      Pick<ResumeBulletRow, "role_variant_id" | "approval_status">
    >) {
      counts.set(
        bullet.role_variant_id,
        (counts.get(bullet.role_variant_id) ?? 0) + 1,
      );
    }

    approvedRoleSets = roles
      .map((role) => {
        const approvedBulletCount = counts.get(role.id);

        if (!approvedBulletCount) {
          return null;
        }

        return {
          roleVariantId: role.id,
          roleName: role.name,
          approvedBulletCount,
        };
      })
      .filter(
        (
          role,
        ): role is ReviewCycleSummary["resumeCoverage"]["roles"][number] => role !== null,
      );
  }

  const [monthEntry, quarterEntry] = await Promise.all([
    getChangelogEntryForPeriod(supabase, userId, month),
    getChangelogEntryForPeriod(supabase, userId, quarter),
  ]);

  const { data: exportData, error: exportError } = await supabase
    .from("exports")
    .select("target_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  assertNoQueryError(exportError, "Could not load export history for review cycle.");

  const latestByTarget = new Map<ExportRow["target_type"], string>();

  for (const row of (exportData ?? []) as Array<
    Pick<ExportRow, "target_type" | "created_at">
  >) {
    if (!latestByTarget.has(row.target_type)) {
      latestByTarget.set(row.target_type, row.created_at);
    }
  }

  return {
    reviewBacklog: {
      unreviewedCount,
      structuredDecisionCount,
    },
    evidenceMomentum: {
      approvedThisMonth,
      approvedThisQuarter,
    },
    resumeCoverage: {
      approvedRoleSetCount: approvedRoleSets.length,
      roles: approvedRoleSets,
    },
    changelogCoverage: {
      month: {
        label: formatPeriodLabel(month),
        periodType: month.periodType,
        periodStart: month.periodStart,
        periodEnd: month.periodEnd,
        entryId: monthEntry?.id ?? null,
        approvalStatus: monthEntry?.approval_status ?? null,
        updatedAt: monthEntry?.updated_at ?? null,
      },
      quarter: {
        label: formatPeriodLabel(quarter),
        periodType: quarter.periodType,
        periodStart: quarter.periodStart,
        periodEnd: quarter.periodEnd,
        entryId: quarterEntry?.id ?? null,
        approvalStatus: quarterEntry?.approval_status ?? null,
        updatedAt: quarterEntry?.updated_at ?? null,
      },
    },
    exportRecency: {
      resumeBullets: latestByTarget.get("resume_bullets") ?? null,
      changelogEntry: latestByTarget.get("changelog_entry") ?? null,
      evidenceSnapshot: latestByTarget.get("evidence_snapshot") ?? null,
    },
    nextStep: determineReviewCycleNextStep({
      unreviewedCount,
      structuredDecisionCount,
      monthApprovalStatus: monthEntry?.approval_status ?? null,
      quarterApprovalStatus: quarterEntry?.approval_status ?? null,
      approvedRoleSetCount: approvedRoleSets.length,
      resumeBulletsExportedAt: latestByTarget.get("resume_bullets") ?? null,
      changelogEntryExportedAt: latestByTarget.get("changelog_entry") ?? null,
    }),
  } satisfies ReviewCycleSummary;
}
