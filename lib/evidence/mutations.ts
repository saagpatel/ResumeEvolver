import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Json } from "@/types/database";
import type {
  EvidenceApprovalDecision,
  EvidenceStructurePayload,
  ManualEvidenceInput,
  ManualEvidenceType,
} from "@/types/domain";
import { manualEvidenceTypes } from "@/types/domain";
import {
  getApprovalTransition,
  getStructuredStatePair,
  isEditableEvidence,
} from "@/lib/evidence/state-machine";
import { toStructurePayloadJson } from "./contracts";
import { EvidenceError } from "./errors";
import { getEvidenceByIdWithLinks, type EvidenceRecordWithLinks } from "./queries";

export type EditableManualEvidence = EvidenceRecordWithLinks & {
  type: ManualEvidenceType;
  source_system: "manual";
};

export type ReviewableEvidence = EvidenceRecordWithLinks;

export async function saveManualEvidence(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  input: ManualEvidenceInput,
  evidenceId?: string | null,
) {
  const inputLinks = (input.links ?? []).map((link) => ({
    label: link.label,
    url: link.url,
    linkType: link.linkType,
  })) as Json;

  const { data, error } = await supabase.rpc("save_manual_evidence", {
    evidence_id: evidenceId ?? null,
    input_type: input.type,
    input_title: input.title,
    input_raw_input: input.rawInput,
    input_project_name: input.projectName,
    input_time_start: input.timeStart,
    input_time_end: input.timeEnd,
    input_links: inputLinks,
  });

  if (error || !data) {
    throw new EvidenceError(
      error?.message ?? "Unable to save manual evidence.",
      error?.code === "42501" ? 403 : 400,
    );
  }

  const savedEvidence = await getEvidenceByIdWithLinks(supabase, viewerId, data);

  if (!savedEvidence) {
    throw new EvidenceError("Saved evidence could not be reloaded.", 500);
  }

  return savedEvidence;
}

export async function getEditableManualEvidence(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  evidenceId: string,
): Promise<EditableManualEvidence> {
  const evidence = await getReviewableEvidence(supabase, viewerId, evidenceId);

  if (evidence.source_system !== "manual") {
    throw new EvidenceError("Only manual evidence is editable in Milestone 4.", 400);
  }

  if (!manualEvidenceTypes.includes(evidence.type as ManualEvidenceType)) {
    throw new EvidenceError("Evidence item type is not editable in Milestone 4.", 400);
  }

  return evidence as EditableManualEvidence;
}

export async function getReviewableEvidence(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  evidenceId: string,
): Promise<ReviewableEvidence> {
  const evidence = await getEvidenceByIdWithLinks(supabase, viewerId, evidenceId);

  if (!evidence) {
    throw new EvidenceError("Evidence item not found.", 404);
  }

  if (!isEditableEvidence(evidence.verification_status, evidence.approval_status)) {
    throw new EvidenceError(
      "Approved or rejected evidence is read-only in the review flow.",
      409,
    );
  }

  return evidence;
}

export async function applyEvidenceStructure(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  evidenceId: string,
  payload: EvidenceStructurePayload,
) {
  const evidence = await getReviewableEvidence(supabase, viewerId, evidenceId);
  const nextState = getStructuredStatePair(
    evidence.verification_status,
    evidence.approval_status,
  );

  if (!nextState) {
    throw new EvidenceError("Evidence item cannot be structured in its current state.", 409);
  }

  const { error } = await supabase
    .from("evidence_items")
    .update({
      factual_summary: payload.factualSummary,
      proof_strength: payload.proofStrength,
      ai_structured_payload: toStructurePayloadJson(payload),
      verification_status: nextState.verificationStatus,
      approval_status: nextState.approvalStatus,
    })
    .eq("id", evidence.id)
    .eq("user_id", viewerId);

  if (error) {
    throw new EvidenceError(error.message, 400);
  }

  const updatedEvidence = await getEvidenceByIdWithLinks(supabase, viewerId, evidenceId);

  if (!updatedEvidence) {
    throw new EvidenceError("Structured evidence could not be reloaded.", 500);
  }

  return updatedEvidence;
}

export async function applyEvidenceApproval(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  evidenceId: string,
  decision: EvidenceApprovalDecision,
) {
  const evidence = await getReviewableEvidence(supabase, viewerId, evidenceId);
  const nextState = getApprovalTransition(
    {
      verificationStatus: evidence.verification_status,
      approvalStatus: evidence.approval_status,
    },
    decision,
  );

  if (!nextState) {
    throw new EvidenceError("That approval transition is not allowed.", 409);
  }

  const { error } = await supabase
    .from("evidence_items")
    .update({
      verification_status: nextState.verificationStatus,
      approval_status: nextState.approvalStatus,
    })
    .eq("id", evidence.id)
    .eq("user_id", viewerId);

  if (error) {
    throw new EvidenceError(error.message, 400);
  }

  const updatedEvidence = await getEvidenceByIdWithLinks(supabase, viewerId, evidenceId);

  if (!updatedEvidence) {
    throw new EvidenceError("Updated evidence could not be reloaded.", 500);
  }

  return updatedEvidence;
}
