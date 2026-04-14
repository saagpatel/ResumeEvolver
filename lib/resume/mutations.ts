import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ProofStrength } from "@/types/domain";
import { EvidenceError } from "@/lib/evidence/errors";
import {
  resumeBulletApprovalStatuses,
  type PersistedGeneratedResumeBullet,
  type ResumeBulletApprovalStatus,
  type ResumeGenerationMetadata,
} from "./contracts";
import {
  getResumeBulletById,
  type ApprovedEvidenceForGeneration,
} from "./queries";

const proofStrengthRank: Record<ProofStrength, number> = {
  strong: 3,
  moderate: 2,
  weak: 1,
};

export function deriveResumeBulletProofStrength(
  evidence: Array<Pick<ApprovedEvidenceForGeneration, "proof_strength">>,
): ProofStrength {
  if (!evidence.length) {
    return "weak";
  }

  let weakest: ProofStrength = "strong";

  for (const row of evidence) {
    if (!row.proof_strength) {
      return "weak";
    }

    if (proofStrengthRank[row.proof_strength] < proofStrengthRank[weakest]) {
      weakest = row.proof_strength;
    }
  }

  return weakest;
}

export function buildResumeGenerationMetadata(
  roleVariantId: string,
  evidenceIds: string[],
  model: string,
): ResumeGenerationMetadata {
  return {
    source: "ai",
    prompt_version: "resume-generate.v1",
    model,
    role_variant_id: roleVariantId,
    selected_evidence_ids: evidenceIds,
    generated_at: new Date().toISOString(),
  };
}

export function validateGeneratedResumeBullets(
  bullets: PersistedGeneratedResumeBullet[],
  selectedEvidenceIds: string[],
) {
  const selected = new Set(selectedEvidenceIds);

  for (const bullet of bullets) {
    if (!bullet.supportingEvidenceIds.length) {
      throw new EvidenceError(
        "Every generated resume bullet must reference at least one approved evidence item.",
        502,
      );
    }

    for (const evidenceId of bullet.supportingEvidenceIds) {
      if (!selected.has(evidenceId)) {
        throw new EvidenceError(
          "Generated bullets referenced evidence outside the confirmed selection.",
          502,
        );
      }
    }
  }
}

export async function replaceGeneratedResumeBullets(
  supabase: SupabaseClient<Database>,
  roleVariantId: string,
  generationMetadata: ResumeGenerationMetadata,
  bullets: PersistedGeneratedResumeBullet[],
) {
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: {
        input_role_variant_id: string;
        input_generation_metadata: Json;
        input_bullets: Json;
      },
    ) => Promise<{
      data: unknown;
      error: {
        message: string;
        code?: string;
      } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc("replace_generated_resume_bullets", {
    input_role_variant_id: roleVariantId,
    input_generation_metadata: generationMetadata as unknown as Json,
    input_bullets: bullets as unknown as Json,
  });

  if (error) {
    throw new EvidenceError(error.message, error.code === "42501" ? 403 : 400);
  }

  if (!Array.isArray(data)) {
    throw new EvidenceError("Resume bullets could not be persisted.", 500);
  }

  return data as string[];
}

export async function updateResumeBullet(
  supabase: SupabaseClient<Database>,
  userId: string,
  bulletId: string,
  patch: {
    draftText?: string | null;
    approvalStatus?: ResumeBulletApprovalStatus;
  },
) {
  const bullet = await getResumeBulletById(supabase, userId, bulletId);

  if (!bullet) {
    throw new EvidenceError("Resume bullet not found.", 404);
  }

  if (
    patch.approvalStatus &&
    !resumeBulletApprovalStatuses.includes(patch.approvalStatus)
  ) {
    throw new EvidenceError("Resume bullet approval status is invalid.", 400);
  }

  const updatePayload: Database["public"]["Tables"]["resume_bullets"]["Update"] = {};

  if (patch.draftText !== undefined && patch.draftText !== null) {
    updatePayload.draft_text = patch.draftText;
    updatePayload.is_user_edited = true;
  }

  if (patch.approvalStatus !== undefined) {
    updatePayload.approval_status = patch.approvalStatus;
  }

  const { error } = await supabase
    .from("resume_bullets")
    .update(updatePayload)
    .eq("id", bulletId)
    .eq("user_id", userId);

  if (error) {
    throw new EvidenceError(error.message, 400);
  }

  const updatedBullet = await getResumeBulletById(supabase, userId, bulletId);

  if (!updatedBullet) {
    throw new EvidenceError("Updated resume bullet could not be reloaded.", 500);
  }

  return updatedBullet;
}
