import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";
import { isApprovedEvidence } from "@/lib/evidence/state-machine";
import type { RoleVariantRecord } from "@/lib/roles/queries";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type ResumeBulletRow = Database["public"]["Tables"]["resume_bullets"]["Row"];
type ResumeBulletEvidenceRow =
  Database["public"]["Tables"]["resume_bullet_evidence"]["Row"];

type ApprovedEvidenceCandidateSnapshot = Pick<
  EvidenceRow,
  | "id"
  | "type"
  | "title"
  | "factual_summary"
  | "project_name"
  | "proof_strength"
  | "source_system"
  | "approval_status"
  | "verification_status"
  | "updated_at"
  | "created_at"
  | "ai_structured_payload"
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
  | "ai_structured_payload"
>;

export interface ResumeCandidateEvidence extends ApprovedEvidenceCandidateSnapshot {
  roleRelevance: string[];
  matchScore: number;
  matchedTerms: string[];
}

export interface ResumeBulletEvidenceReference {
  id: string;
  title: string;
  type: EvidenceRow["type"];
  projectName: string | null;
  proofStrength: EvidenceRow["proof_strength"];
  sourceSystem: EvidenceRow["source_system"];
  approvalStatus: EvidenceRow["approval_status"];
}

export interface ResumeBulletRecord extends ResumeBulletRow {
  supportingEvidence: ResumeBulletEvidenceReference[];
}

export interface ApprovedEvidenceForGeneration
  extends ApprovedEvidenceGenerationSnapshot {
  roleRelevance: string[];
}

function assertNoQueryError(error: PostgrestError | null, message: string) {
  if (error) {
    throw new EvidenceError(message, 500);
  }
}

function parseRoleRelevance(payload: Json) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Array.isArray(payload.role_relevance)
  ) {
    return payload.role_relevance.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
  }

  return [] as string[];
}

function tokenize(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 2) ?? [],
    ),
  );
}

function getRoleTerms(role: RoleVariantRecord) {
  return new Set(
    [
      ...tokenize(role.name),
      ...tokenize(role.target_title),
      ...tokenize(role.job_description_raw),
      ...tokenize(role.notes),
    ],
  );
}

export function scoreRoleEvidenceMatch(
  role: RoleVariantRecord,
  evidence: ApprovedEvidenceCandidateSnapshot,
) {
  const roleTerms = getRoleTerms(role);

  if (!roleTerms.size) {
    return { matchScore: 0, matchedTerms: [] as string[] };
  }

  const matchedTerms = new Set<string>();
  let score = 0;

  const weightedSources: Array<[string | null | undefined, number]> = [
    [evidence.title, 5],
    [evidence.project_name, 4],
    [evidence.factual_summary, 3],
    [parseRoleRelevance(evidence.ai_structured_payload).join(" "), 2],
  ];

  for (const [value, weight] of weightedSources) {
    const tokens = tokenize(value);
    const overlap = tokens.filter((token) => roleTerms.has(token));

    if (!overlap.length) {
      continue;
    }

    overlap.forEach((token) => matchedTerms.add(token));
    score += overlap.length * weight;
  }

  return {
    matchScore: score,
    matchedTerms: Array.from(matchedTerms).sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export async function listApprovedEvidenceSuggestions(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: RoleVariantRecord,
) {
  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, type, title, factual_summary, project_name, proof_strength, source_system, approval_status, verification_status, updated_at, created_at, ai_structured_payload",
    )
    .eq("user_id", userId)
    .eq("verification_status", "approved")
    .in("approval_status", ["approved_private", "approved_public_safe"])
    .order("updated_at", { ascending: false })
    .limit(40);

  assertNoQueryError(error, "Could not load approved evidence suggestions.");

  const candidates = ((data ?? []) as ApprovedEvidenceCandidateSnapshot[]).map((row) => {
    const scoring = scoreRoleEvidenceMatch(role, row);

    return {
      ...row,
      roleRelevance: parseRoleRelevance(row.ai_structured_payload),
      matchScore: scoring.matchScore,
      matchedTerms: scoring.matchedTerms,
    } satisfies ResumeCandidateEvidence;
  });

  const suggested = [...candidates]
    .filter((candidate) => candidate.matchScore > 0)
    .sort((left, right) => {
      if (left.matchScore !== right.matchScore) {
        return right.matchScore - left.matchScore;
      }

      return right.updated_at.localeCompare(left.updated_at);
    })
    .slice(0, 8);

  const suggestedIds = new Set(suggested.map((candidate) => candidate.id));
  const recentApproved = candidates
    .filter((candidate) => !suggestedIds.has(candidate.id))
    .slice(0, 12);

  return {
    suggested,
    recentApproved,
  };
}

export async function getApprovedEvidenceSelection(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceIds: string[],
) {
  if (!evidenceIds.length) {
    return [] as ApprovedEvidenceForGeneration[];
  }

  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id, type, title, raw_input, factual_summary, project_name, proof_strength, source_system, source_url, time_start, time_end, approval_status, verification_status, ai_structured_payload",
    )
    .eq("user_id", userId)
    .in("id", evidenceIds);

  assertNoQueryError(error, "Could not load selected evidence.");

  const evidenceRows = (data ?? []) as ApprovedEvidenceGenerationSnapshot[];

  if (evidenceRows.length !== evidenceIds.length) {
    throw new EvidenceError(
      "Resume generation only accepts your explicitly selected approved evidence.",
      400,
    );
  }

  const evidenceById = new Map(
    evidenceRows.map((row) => [
      row.id,
      {
        ...row,
        roleRelevance: parseRoleRelevance(row.ai_structured_payload),
      } satisfies ApprovedEvidenceForGeneration,
    ]),
  );

  const orderedRows = evidenceIds
    .map((id) => evidenceById.get(id))
    .filter(
      (row): row is ApprovedEvidenceForGeneration => row !== undefined,
    );

  if (orderedRows.length !== evidenceIds.length) {
    throw new EvidenceError(
      "Resume generation could not resolve every selected evidence item.",
      400,
    );
  }

  for (const row of orderedRows) {
    if (!isApprovedEvidence(row.verification_status, row.approval_status)) {
      throw new EvidenceError(
        "Resume generation rejects unapproved evidence.",
        409,
      );
    }
  }

  return orderedRows;
}

export async function listResumeBulletsForRoleVariant(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleVariantId: string,
) {
  const { data, error } = await supabase
    .from("resume_bullets")
    .select("*")
    .eq("user_id", userId)
    .eq("role_variant_id", roleVariantId)
    .order("updated_at", { ascending: false });

  assertNoQueryError(error, "Could not load resume bullets.");

  const bullets = (data ?? []) as ResumeBulletRow[];

  if (!bullets.length) {
    return [] as ResumeBulletRecord[];
  }

  const bulletIds = bullets.map((bullet) => bullet.id);
  const { data: linkData, error: linkError } = await supabase
    .from("resume_bullet_evidence")
    .select("resume_bullet_id, evidence_item_id")
    .in("resume_bullet_id", bulletIds);

  assertNoQueryError(linkError, "Could not load resume bullet provenance.");

  const evidenceIds = Array.from(
    new Set(
      ((linkData ?? []) as ResumeBulletEvidenceRow[]).map((row) => row.evidence_item_id),
    ),
  );

  const { data: evidenceData, error: evidenceError } = await supabase
    .from("evidence_items")
    .select(
      "id, title, type, project_name, proof_strength, source_system, approval_status",
    )
    .eq("user_id", userId)
    .in("id", evidenceIds);

  assertNoQueryError(evidenceError, "Could not load resume bullet evidence.");

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
      } satisfies ResumeBulletEvidenceReference,
    ]),
  );

  const evidenceByBulletId = new Map<string, ResumeBulletEvidenceReference[]>();

  for (const link of (linkData ?? []) as ResumeBulletEvidenceRow[]) {
    const evidence = evidenceById.get(link.evidence_item_id);

    if (!evidence) {
      continue;
    }

    const existing = evidenceByBulletId.get(link.resume_bullet_id) ?? [];
    existing.push(evidence);
    evidenceByBulletId.set(link.resume_bullet_id, existing);
  }

  return bullets.map((bullet) => ({
    ...bullet,
    supportingEvidence: evidenceByBulletId.get(bullet.id) ?? [],
  })) satisfies ResumeBulletRecord[];
}

export async function getResumeBulletById(
  supabase: SupabaseClient<Database>,
  userId: string,
  bulletId: string,
) {
  const { data, error } = await supabase
    .from("resume_bullets")
    .select("*")
    .eq("user_id", userId)
    .eq("id", bulletId)
    .maybeSingle();

  assertNoQueryError(error, "Could not load resume bullet.");

  const bullet = (data ?? null) as ResumeBulletRow | null;

  if (!bullet) {
    return null;
  }

  const bullets = await listResumeBulletsForRoleVariant(
    supabase,
    userId,
    bullet.role_variant_id,
  );

  return bullets.find((candidate) => candidate.id === bulletId) ?? null;
}
