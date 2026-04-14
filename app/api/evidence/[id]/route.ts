import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  parseManualEvidencePatch,
  validateManualEvidenceRules,
} from "@/lib/evidence/contracts";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { getEditableManualEvidence, saveManualEvidence } from "@/lib/evidence/mutations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const existingEvidence = await getEditableManualEvidence(
      supabase,
      viewer.userId,
      id,
    );
    const patch = parseManualEvidencePatch(await request.json());
    const mergedInput = {
      type: patch.type ?? existingEvidence.type,
      title: patch.title ?? existingEvidence.title,
      rawInput: patch.rawInput ?? existingEvidence.raw_input,
      projectName:
        patch.projectName === undefined
          ? existingEvidence.project_name
          : patch.projectName,
      timeStart:
        patch.timeStart === undefined
          ? existingEvidence.time_start
          : patch.timeStart,
      timeEnd:
        patch.timeEnd === undefined ? existingEvidence.time_end : patch.timeEnd,
      links: patch.links ?? existingEvidence.links,
    };

    validateManualEvidenceRules(mergedInput, mergedInput.links);

    const evidence = await saveManualEvidence(
      supabase,
      viewer.userId,
      mergedInput,
      id,
    );

    return NextResponse.json({ evidence });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Evidence update is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
