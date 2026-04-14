import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { evidenceApprovalSchema } from "@/lib/evidence/contracts";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { applyEvidenceApproval } from "@/lib/evidence/mutations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const { decision } = evidenceApprovalSchema.parse(await request.json());
    const supabase = await createClient();
    const evidence = await applyEvidenceApproval(
      supabase,
      viewer.userId,
      id,
      decision,
    );

    return NextResponse.json({ evidence });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Approval decision is invalid.", issues: error.issues },
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
