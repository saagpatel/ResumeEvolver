import { ResumeWorkspace } from "@/components/resume/resume-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getErrorMessage } from "@/lib/evidence/errors";
import { listRoleVariants } from "@/lib/roles/queries";
import {
  listApprovedEvidenceSuggestions,
  listResumeBulletsForRoleVariant,
} from "@/lib/resume/queries";
import { createClient } from "@/lib/supabase/server";

interface ResumePageProps {
  searchParams?: Promise<{
    role?: string;
  }>;
}

function isResumeGenerationEnabled() {
  return Boolean(
    process.env.OPENAI_API_KEY || process.env.RESUMEEVOLVER_TEST_MODE === "1",
  );
}

export default async function ResumePage({ searchParams }: ResumePageProps) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const generationEnabled = isResumeGenerationEnabled();
  let roleVariants = [] as Awaited<ReturnType<typeof listRoleVariants>>;
  let selectedRole = null as (typeof roleVariants)[number] | null;
  let suggestedEvidence = [] as Awaited<
    ReturnType<typeof listApprovedEvidenceSuggestions>
  >["suggested"];
  let fallbackEvidence = [] as Awaited<
    ReturnType<typeof listApprovedEvidenceSuggestions>
  >["recentApproved"];
  let bullets = [] as Awaited<ReturnType<typeof listResumeBulletsForRoleVariant>>;
  let errorMessage: string | null = null;

  try {
    roleVariants = await listRoleVariants(supabase, viewer.userId);
    selectedRole =
      roleVariants.find((role) => role.id === resolvedSearchParams?.role) ??
      roleVariants[0] ??
      null;

    if (selectedRole) {
      const evidenceSuggestions = await listApprovedEvidenceSuggestions(
        supabase,
        viewer.userId,
        selectedRole,
      );
      suggestedEvidence = evidenceSuggestions.suggested;
      fallbackEvidence = evidenceSuggestions.recentApproved;
      bullets = await listResumeBulletsForRoleVariant(
        supabase,
        viewer.userId,
        selectedRole.id,
      );
    }
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return (
    <ResumeWorkspace
      key={selectedRole?.id ?? "resume-empty"}
      roleVariants={roleVariants}
      selectedRole={selectedRole}
      suggestedEvidence={suggestedEvidence}
      fallbackEvidence={fallbackEvidence}
      bullets={bullets}
      generationEnabled={generationEnabled}
      errorMessage={errorMessage}
    />
  );
}
