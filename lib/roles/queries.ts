import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/errors";

type RoleVariantRow = Database["public"]["Tables"]["role_variants"]["Row"];

export type RoleVariantRecord = RoleVariantRow;

function assertNoQueryError(error: PostgrestError | null, message: string) {
  if (error) {
    throw new EvidenceError(message, 500);
  }
}

export async function listRoleVariants(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("role_variants")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  assertNoQueryError(error, "Could not load role variants.");

  return (data ?? []) as RoleVariantRecord[];
}

export async function getRoleVariantById(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleVariantId: string,
) {
  const { data, error } = await supabase
    .from("role_variants")
    .select("*")
    .eq("user_id", userId)
    .eq("id", roleVariantId)
    .maybeSingle();

  assertNoQueryError(error, "Could not load role variant.");

  return (data ?? null) as RoleVariantRecord | null;
}
