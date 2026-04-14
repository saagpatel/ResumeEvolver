import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  parseManualEvidenceInput,
  validateManualEvidenceRules,
} from "@/lib/evidence/contracts";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { saveManualEvidence } from "@/lib/evidence/mutations";

export async function POST(request: Request) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const input = parseManualEvidenceInput(payload);

    validateManualEvidenceRules(input);

    const supabase = await createClient();
    const evidence = await saveManualEvidence(supabase, viewer.userId, input);

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Manual evidence input is invalid.", issues: error.issues },
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
