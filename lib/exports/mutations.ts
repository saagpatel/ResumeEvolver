import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";

export async function createExport(
  supabase: SupabaseClient<Database>,
  userId: string,
  payload: {
    targetType: Database["public"]["Tables"]["exports"]["Row"]["target_type"];
    targetId: string | null;
    format: Database["public"]["Tables"]["exports"]["Row"]["format"];
    content: string;
  },
) {
  const insertPayload: Database["public"]["Tables"]["exports"]["Insert"] = {
    user_id: userId,
    target_type: payload.targetType,
    target_id: payload.targetId,
    format: payload.format,
    content: payload.content,
    status: "ready",
  };

  const { data, error } = await supabase
    .from("exports")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new EvidenceError(error.message, 400);
  }

  if (!data) {
    throw new EvidenceError("The export could not be saved.", 500);
  }

  return data;
}
