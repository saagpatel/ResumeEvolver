import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { parseChangelogEntryPatch } from "@/lib/changelog/contracts";
import { updateChangelogEntry } from "@/lib/changelog/mutations";

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
    const patch = parseChangelogEntryPatch(await request.json());
    const supabase = await createClient();
    const entry = await updateChangelogEntry(supabase, viewer.userId, id, patch);

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Changelog entry patch is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
