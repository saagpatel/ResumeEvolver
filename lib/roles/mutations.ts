import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RoleVariantInput } from "./contracts";
import { EvidenceError } from "@/lib/evidence/errors";
import { getRoleVariantById } from "./queries";

export async function createRoleVariant(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: RoleVariantInput,
) {
  const { data, error } = await supabase
    .from("role_variants")
    .insert({
      user_id: userId,
      name: input.name,
      target_title: input.targetTitle,
      job_description_raw: input.jobDescriptionRaw,
      notes: input.notes,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw new EvidenceError(error?.message ?? "Unable to create role variant.", 400);
  }

  const role = await getRoleVariantById(supabase, userId, data.id);

  if (!role) {
    throw new EvidenceError("Created role variant could not be reloaded.", 500);
  }

  return role;
}

export async function updateRoleVariant(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleVariantId: string,
  patch: Partial<RoleVariantInput>,
) {
  const role = await getRoleVariantById(supabase, userId, roleVariantId);

  if (!role) {
    throw new EvidenceError("Role variant not found.", 404);
  }

  const { error } = await supabase
    .from("role_variants")
    .update({
      name: patch.name,
      target_title: patch.targetTitle,
      job_description_raw: patch.jobDescriptionRaw,
      notes: patch.notes,
    })
    .eq("id", roleVariantId)
    .eq("user_id", userId);

  if (error) {
    throw new EvidenceError(error.message, 400);
  }

  const updatedRole = await getRoleVariantById(supabase, userId, roleVariantId);

  if (!updatedRole) {
    throw new EvidenceError("Updated role variant could not be reloaded.", 500);
  }

  return updatedRole;
}
