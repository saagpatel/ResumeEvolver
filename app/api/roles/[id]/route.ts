import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { EvidenceError, getErrorMessage } from "@/lib/evidence/errors";
import { parseRoleVariantPatch } from "@/lib/roles/contracts";
import { updateRoleVariant } from "@/lib/roles/mutations";

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
    const patch = parseRoleVariantPatch(await request.json());
    const supabase = await createClient();
    const roleVariant = await updateRoleVariant(supabase, viewer.userId, id, patch);

    return NextResponse.json({ role: roleVariant });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Role variant patch is invalid.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EvidenceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
