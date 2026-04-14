import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import {
  applyEvidenceStructure,
  getReviewableEvidence,
} from "@/lib/evidence/mutations";
import { structureEvidence } from "@/lib/evidence/structure";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const evidence = await getReviewableEvidence(supabase, viewer.userId, id);
    const structure = await structureEvidence(evidence);
    const updatedEvidence = await applyEvidenceStructure(
      supabase,
      viewer.userId,
      id,
      structure,
    );

    return NextResponse.json({ evidence: updatedEvidence });
  } catch (error) {
    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
