import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";
import {
  changelogApprovalStatuses,
  changelogGeneratePromptVersion,
  getChangelogVisibilityForApprovalStatus,
  type ChangelogEntryPatch,
  type ChangelogGenerationMetadata,
  type ResolvedChangelogPeriod,
} from "./contracts";
import { getChangelogEntryById } from "./queries";

export function buildChangelogGenerationMetadata(
  period: ResolvedChangelogPeriod,
  evidenceIds: string[],
  model: string,
): ChangelogGenerationMetadata {
  return {
    source: "ai",
    prompt_version: changelogGeneratePromptVersion,
    model,
    period_type: period.periodType,
    period_start: period.periodStart,
    period_end: period.periodEnd,
    selected_evidence_ids: evidenceIds,
    generated_at: new Date().toISOString(),
  };
}

export function renderChangelogBody(
  sections: Array<{ heading: string; bullets: string[] }>,
) {
  return sections
    .map((section) =>
      [`## ${section.heading}`, ...section.bullets.map((bullet) => `- ${bullet}`)].join(
        "\n",
      ),
    )
    .join("\n\n");
}

export async function upsertGeneratedChangelogEntry(
  supabase: SupabaseClient<Database>,
  period: ResolvedChangelogPeriod,
  generationMetadata: ChangelogGenerationMetadata,
  title: string,
  body: string,
  evidenceIds: string[],
  replaceEdited: boolean,
) {
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: {
        input_period_type: ResolvedChangelogPeriod["periodType"];
        input_period_start: string;
        input_period_end: string;
        input_generation_metadata: Json;
        input_title: string;
        input_body: string;
        input_evidence_ids: string[];
        input_replace_edited: boolean;
      },
    ) => Promise<{
      data: unknown;
      error: {
        message: string;
        code?: string;
      } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc("upsert_generated_changelog_entry", {
    input_period_type: period.periodType,
    input_period_start: period.periodStart,
    input_period_end: period.periodEnd,
    input_generation_metadata: generationMetadata as unknown as Json,
    input_title: title,
    input_body: body,
    input_evidence_ids: evidenceIds,
    input_replace_edited: replaceEdited,
  });

  if (error) {
    if (error.message.includes("requires explicit replaceEdited")) {
      throw new EvidenceError(error.message, 409);
    }

    if (
      error.message.includes("approved evidence") ||
      error.message.includes("selected period")
    ) {
      throw new EvidenceError(error.message, 409);
    }

    throw new EvidenceError(error.message, error.code === "42501" ? 403 : 400);
  }

  if (typeof data !== "string" || !data.length) {
    throw new EvidenceError("Changelog draft could not be persisted.", 500);
  }

  return data;
}

export async function updateChangelogEntry(
  supabase: SupabaseClient<Database>,
  userId: string,
  entryId: string,
  patch: ChangelogEntryPatch,
) {
  const entry = await getChangelogEntryById(supabase, userId, entryId);

  if (!entry) {
    throw new EvidenceError("Changelog entry not found.", 404);
  }

  if (
    patch.approvalStatus &&
    !changelogApprovalStatuses.includes(patch.approvalStatus)
  ) {
    throw new EvidenceError("Changelog approval status is invalid.", 400);
  }

  if (patch.approvalStatus === "approved_public_safe") {
    const hasUnsafeEvidence = entry.supportingEvidence.some(
      (evidence) => evidence.approvalStatus !== "approved_public_safe",
    );

    if (hasUnsafeEvidence) {
      throw new EvidenceError(
        "Changelog entries can only become public-safe when every linked evidence item is already public-safe.",
        409,
      );
    }
  }

  const updatePayload: Database["public"]["Tables"]["changelog_entries"]["Update"] =
    {};

  if (patch.title !== undefined) {
    updatePayload.title = patch.title;
    updatePayload.is_user_edited = true;
  }

  if (patch.body !== undefined) {
    updatePayload.body = patch.body;
    updatePayload.is_user_edited = true;
  }

  if (patch.approvalStatus !== undefined) {
    updatePayload.approval_status = patch.approvalStatus;
    updatePayload.visibility = getChangelogVisibilityForApprovalStatus(
      patch.approvalStatus,
    );
  }

  const { error } = await supabase
    .from("changelog_entries")
    .update(updatePayload)
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) {
    throw new EvidenceError(error.message, 400);
  }

  const updatedEntry = await getChangelogEntryById(supabase, userId, entryId);

  if (!updatedEntry) {
    throw new EvidenceError("Updated changelog entry could not be reloaded.", 500);
  }

  return updatedEntry;
}

export function isChangelogEntryEdited(
  entry: { is_user_edited: boolean } | null,
) {
  return Boolean(entry?.is_user_edited);
}

export function canPublishChangelogEntryPublicly(
  supportingEvidence: Array<{ approvalStatus: Database["public"]["Tables"]["evidence_items"]["Row"]["approval_status"] }>,
) {
  return supportingEvidence.every(
    (evidence) => evidence.approvalStatus === "approved_public_safe",
  );
}
