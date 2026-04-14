import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { createClient } from "@/lib/supabase/server";
import { getRoleVariantById } from "@/lib/roles/queries";
import {
  generateResumeBullets,
  getResumeGenerationModel,
} from "@/lib/resume/generate";
import {
  buildResumeGenerationMetadata,
  deriveResumeBulletProofStrength,
  replaceGeneratedResumeBullets,
  validateGeneratedResumeBullets,
} from "@/lib/resume/mutations";
import {
  getApprovedEvidenceSelection,
  listResumeBulletsForRoleVariant,
} from "@/lib/resume/queries";
import { parseResumeGenerationRequest } from "@/lib/resume/contracts";
import type { PersistedGeneratedResumeBullet } from "@/lib/resume/contracts";
import type { ApprovedEvidenceForGeneration } from "@/lib/resume/queries";

export const maxDuration = 60;

export async function POST(request: Request) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { roleVariantId, evidenceIds } = parseResumeGenerationRequest(
      await request.json(),
    );
    const supabase = await createClient();
    const roleVariant = await getRoleVariantById(supabase, viewer.userId, roleVariantId);

    if (!roleVariant) {
      throw new EvidenceError("Role variant not found.", 404);
    }

    const evidence = await getApprovedEvidenceSelection(
      supabase,
      viewer.userId,
      evidenceIds,
    );
    const generated = await generateResumeBullets(roleVariant, evidence);

    const evidenceById = new Map(evidence.map((row) => [row.id, row]));
    const persistedBullets: PersistedGeneratedResumeBullet[] = generated.bullets.map((bullet) => {
      const supportingEvidence = bullet.supportingEvidenceIds
        .map((id) => evidenceById.get(id))
        .filter(
          (row): row is ApprovedEvidenceForGeneration => row !== undefined,
        );

      return {
        draftText: bullet.draftText,
        claimType: bullet.claimType,
        proofStrength: deriveResumeBulletProofStrength(supportingEvidence),
        supportingEvidenceIds: bullet.supportingEvidenceIds,
      };
    });

    validateGeneratedResumeBullets(persistedBullets, evidenceIds);

    await replaceGeneratedResumeBullets(
      supabase,
      roleVariantId,
      buildResumeGenerationMetadata(
        roleVariantId,
        evidenceIds,
        getResumeGenerationModel(),
      ),
      persistedBullets,
    );

    const bullets = await listResumeBulletsForRoleVariant(
      supabase,
      viewer.userId,
      roleVariantId,
    );

    return NextResponse.json({ bullets });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Resume generation request is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
