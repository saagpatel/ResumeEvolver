import "server-only";

import type {
  ApprovalStatus,
  EvidenceLinkInput,
  EvidenceType,
  ProofStrength,
  SourceSystem,
  VerificationStatus,
  VisibilityDefault,
} from "@/types/domain";
import type { RoleVariantRecord } from "@/lib/roles/queries";
import type { ResumeBulletRecord } from "@/lib/resume/queries";
import type { ChangelogEntryRecord } from "@/lib/changelog/queries";

export interface EvidenceSnapshotRecord {
  id: string;
  type: EvidenceType;
  title: string;
  rawInput: string;
  factualSummary: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  sourceSystem: SourceSystem;
  sourceExternalId: string | null;
  sourceUrl: string | null;
  projectName: string | null;
  visibilityDefault: VisibilityDefault;
  proofStrength: ProofStrength | null;
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
  aiStructuredPayload: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  links: EvidenceLinkInput[];
}

function formatEvidenceType(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function renderSupportingEvidenceLine(
  evidence: {
    id: string;
    title: string;
    type: string;
    projectName: string | null;
    proofStrength: string | null;
    approvalStatus: string;
  },
) {
  const parts = [
    `[${evidence.id}] ${evidence.title}`,
    formatEvidenceType(evidence.type),
    evidence.projectName ?? "No project",
    evidence.proofStrength ?? "Proof not set",
    evidence.approvalStatus,
  ];

  return parts.join(" • ");
}

function renderRoleContext(role: RoleVariantRecord) {
  const lines = [`Role variant: ${role.name}`];

  if (role.target_title) {
    lines.push(`Target title: ${role.target_title}`);
  }

  if (role.notes) {
    lines.push(`Notes: ${role.notes}`);
  }

  return lines.join("\n");
}

export function serializeResumeBullets(
  role: RoleVariantRecord,
  bullets: ResumeBulletRecord[],
  format: "markdown" | "text" | "json",
) {
  if (format === "json") {
    return JSON.stringify(
      {
        targetType: "resume_bullets",
        roleVariant: {
          id: role.id,
          name: role.name,
          targetTitle: role.target_title,
          notes: role.notes,
        },
        bulletCount: bullets.length,
        bullets: bullets.map((bullet) => ({
          id: bullet.id,
          draftText: bullet.draft_text,
          claimType: bullet.claim_type,
          proofStrength: bullet.proof_strength,
          approvalStatus: bullet.approval_status,
          isUserEdited: bullet.is_user_edited,
          supportingEvidence: bullet.supportingEvidence,
        })),
      },
      null,
      2,
    );
  }

  const bulletLines = bullets.map((bullet, index) => {
    const header =
      format === "markdown" ? `### Bullet ${index + 1}` : `Bullet ${index + 1}`;
    const evidenceLines = bullet.supportingEvidence.map((evidence) =>
      format === "markdown"
        ? `- ${renderSupportingEvidenceLine(evidence)}`
        : `  - ${renderSupportingEvidenceLine(evidence)}`
    );

    return [
      header,
      bullet.draft_text,
      "",
      format === "markdown" ? "Supporting evidence" : "Supporting evidence:",
      ...evidenceLines,
    ].join("\n");
  });

  if (format === "markdown") {
    return [
      `# Resume bullets for ${role.name}`,
      "",
      renderRoleContext(role),
      "",
      "## Drafted bullets",
      "",
      ...bulletLines,
    ].join("\n");
  }

  return [
    `Resume bullets for ${role.name}`,
    "",
    renderRoleContext(role),
    "",
    ...bulletLines,
  ].join("\n");
}

export function serializeChangelogEntry(
  entry: ChangelogEntryRecord,
  format: "markdown" | "text" | "json",
) {
  if (format === "json") {
    return JSON.stringify(
      {
        targetType: "changelog_entry",
        entry: {
          id: entry.id,
          title: entry.title,
          body: entry.body,
          periodType: entry.period_type,
          periodStart: entry.period_start,
          periodEnd: entry.period_end,
          visibility: entry.visibility,
          approvalStatus: entry.approval_status,
          supportingEvidence: entry.supportingEvidence,
        },
      },
      null,
      2,
    );
  }

  const provenanceLines = entry.supportingEvidence.map((evidence) =>
    format === "markdown"
      ? `- ${renderSupportingEvidenceLine(evidence)}`
      : `- ${renderSupportingEvidenceLine(evidence)}`
  );

  if (format === "markdown") {
    return [
      `# ${entry.title}`,
      "",
      entry.body,
      "",
      "## Provenance",
      ...provenanceLines,
    ].join("\n");
  }

  return [
    entry.title,
    "",
    entry.body.replaceAll(/^## /gm, "").replaceAll(/^- /gm, "- "),
    "",
    "Provenance:",
    ...provenanceLines,
  ].join("\n");
}

export function serializeEvidenceSnapshot(records: EvidenceSnapshotRecord[]) {
  return JSON.stringify(
    {
      targetType: "evidence_snapshot",
      exportedAt: new Date().toISOString(),
      evidenceCount: records.length,
      evidence: records,
    },
    null,
    2,
  );
}
