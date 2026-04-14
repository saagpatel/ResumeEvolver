import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { parseResumeBulletPatch } from "@/lib/resume/contracts";
import { updateResumeBullet } from "@/lib/resume/mutations";

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
    const patch = parseResumeBulletPatch(await request.json());
    const supabase = await createClient();
    const bullet = await updateResumeBullet(supabase, viewer.userId, id, patch);

    return NextResponse.json({ bullet });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Resume bullet patch is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
