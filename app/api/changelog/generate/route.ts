import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import {
  parseChangelogGenerationRequest,
  resolveChangelogPeriod,
} from "@/lib/changelog/contracts";
import {
  generateChangelogDraft,
  getChangelogGenerationModel,
} from "@/lib/changelog/generate";
import {
  getApprovedEvidenceSelectionForPeriod,
  getChangelogEntryById,
} from "@/lib/changelog/queries";
import {
  buildChangelogGenerationMetadata,
  renderChangelogBody,
  upsertGeneratedChangelogEntry,
} from "@/lib/changelog/mutations";

export const maxDuration = 60;

export async function POST(request: Request) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const { periodType, periodStart, evidenceIds, replaceEdited } =
      parseChangelogGenerationRequest(await request.json());
    const period = resolveChangelogPeriod(periodType, periodStart);
    const supabase = await createClient();
    const evidence = await getApprovedEvidenceSelectionForPeriod(
      supabase,
      viewer.userId,
      period,
      evidenceIds,
    );
    const generated = await generateChangelogDraft(period, evidence);
    const entryId = await upsertGeneratedChangelogEntry(
      supabase,
      period,
      buildChangelogGenerationMetadata(
        period,
        evidenceIds,
        getChangelogGenerationModel(),
      ),
      generated.title,
      renderChangelogBody(generated.sections),
      evidenceIds,
      replaceEdited,
    );
    const entry = await getChangelogEntryById(supabase, viewer.userId, entryId);

    if (!entry) {
      throw new EvidenceError("Generated changelog entry could not be reloaded.", 500);
    }

    console.info("[changelog.generate]", {
      userId: viewer.userId,
      periodType: period.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      selectedEvidenceCount: evidenceIds.length,
      replaceEdited,
      entryId,
      durationMs: Date.now() - startedAt,
      outcome: "success",
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.warn("[changelog.generate]", {
      userId: viewer.userId,
      durationMs: Date.now() - startedAt,
      outcome: "failure",
      error:
        error instanceof EvidenceError || error instanceof Error
          ? error.message
          : "Unexpected error",
    });

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Changelog generation request is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
