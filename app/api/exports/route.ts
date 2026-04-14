import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import {
  buildExportFilename,
  parseExportCreateRequest,
} from "@/lib/exports/contracts";
import { createExport } from "@/lib/exports/mutations";
import {
  getEvidenceSnapshotSelection,
  getExportHistoryRecordById,
} from "@/lib/exports/queries";
import {
  serializeChangelogEntry,
  serializeEvidenceSnapshot,
  serializeResumeBullets,
} from "@/lib/exports/serialize";
import { getRoleVariantById } from "@/lib/roles/queries";
import { listResumeBulletsForRoleVariant } from "@/lib/resume/queries";
import { getChangelogEntryById } from "@/lib/changelog/queries";

function isApprovedDerivedStatus(value: string) {
  return value === "approved_private" || value === "approved_public_safe";
}

export async function POST(request: Request) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const payload = parseExportCreateRequest(await request.json());
    const supabase = await createClient();
    let content = "";
    let targetId: string | null = payload.targetId;
    let targetLabel = "";

    if (payload.targetType === "resume_bullets") {
      const roleVariant = await getRoleVariantById(
        supabase,
        viewer.userId,
        payload.targetId,
      );

      if (!roleVariant) {
        throw new EvidenceError("Role variant not found.", 404);
      }

      const approvedBullets = (
        await listResumeBulletsForRoleVariant(supabase, viewer.userId, payload.targetId)
      ).filter((bullet) => isApprovedDerivedStatus(bullet.approval_status));

      if (!approvedBullets.length) {
        throw new EvidenceError(
          "Resume exports require at least one approved bullet.",
          409,
        );
      }

      targetLabel = roleVariant.name;
      content = serializeResumeBullets(roleVariant, approvedBullets, payload.format);
    } else if (payload.targetType === "changelog_entry") {
      const entry = await getChangelogEntryById(supabase, viewer.userId, payload.targetId);

      if (!entry) {
        throw new EvidenceError("Changelog entry not found.", 404);
      }

      if (!isApprovedDerivedStatus(entry.approval_status)) {
        throw new EvidenceError(
          "Changelog exports require an approved changelog entry.",
          409,
        );
      }

      targetLabel = entry.title;
      content = serializeChangelogEntry(entry, payload.format);
    } else {
      const evidence = await getEvidenceSnapshotSelection(
        supabase,
        viewer.userId,
        payload.evidenceIds,
      );

      targetId = null;
      targetLabel = "Evidence snapshot";
      content = serializeEvidenceSnapshot(evidence);
    }

    const created = await createExport(supabase, viewer.userId, {
      targetType: payload.targetType,
      targetId,
      format: payload.format,
      content,
    });
    const exportRecord = await getExportHistoryRecordById(
      supabase,
      viewer.userId,
      created.id,
    );

    if (!exportRecord) {
      throw new EvidenceError("The saved export could not be reloaded.", 500);
    }

    console.info("[exports.create]", {
      userId: viewer.userId,
      targetType: payload.targetType,
      format: payload.format,
      targetId,
      exportId: created.id,
      fileName: buildExportFilename({
        targetType: payload.targetType,
        targetLabel,
        format: payload.format,
        createdAt: created.created_at,
      }),
      durationMs: Date.now() - startedAt,
      outcome: "success",
    });

    return NextResponse.json({ exportRecord });
  } catch (error) {
    console.warn("[exports.create]", {
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
        { error: "Export request is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
