import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { requireGitHubImportToken } from "@/lib/github/auth";
import { githubImportRequestSchema } from "@/lib/github/contracts";
import { runGitHubImport } from "@/lib/github/import";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const input = githubImportRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const { providerToken } = await requireGitHubImportToken(supabase, viewer);
    const summary = await runGitHubImport(
      supabase,
      viewer.userId,
      providerToken,
      input,
    );

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "GitHub import input is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
