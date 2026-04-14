import { RolesWorkspace } from "@/components/roles/roles-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getErrorMessage } from "@/lib/evidence/errors";
import { listRoleVariants } from "@/lib/roles/queries";
import { createClient } from "@/lib/supabase/server";

interface RolesPageProps {
  searchParams?: Promise<{
    role?: string;
  }>;
}

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  let roleVariants = [] as Awaited<ReturnType<typeof listRoleVariants>>;
  let selectedRole = null as (typeof roleVariants)[number] | null;
  let errorMessage: string | null = null;

  try {
    roleVariants = await listRoleVariants(supabase, viewer.userId);
    selectedRole =
      roleVariants.find((role) => role.id === resolvedSearchParams?.role) ??
      roleVariants[0] ??
      null;
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return (
    <RolesWorkspace
      key={selectedRole?.id ?? "roles-empty"}
      roleVariants={roleVariants}
      selectedRole={selectedRole}
      errorMessage={errorMessage}
    />
  );
}
