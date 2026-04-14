import { ChangelogWorkspace } from "@/components/changelog/changelog-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getErrorMessage } from "@/lib/evidence/errors";
import {
  getDefaultChangelogPeriod,
  resolveChangelogPeriod,
} from "@/lib/changelog/contracts";
import {
  getChangelogEntryForPeriod,
  listApprovedEvidenceForPeriod,
} from "@/lib/changelog/queries";
import { createClient } from "@/lib/supabase/server";

interface ChangelogPageProps {
  searchParams?: Promise<{
    periodType?: "monthly" | "quarterly";
    periodStart?: string;
  }>;
}

function isChangelogGenerationEnabled() {
  return Boolean(
    process.env.OPENAI_API_KEY || process.env.RESUMEEVOLVER_TEST_MODE === "1",
  );
}

export default async function ChangelogPage({
  searchParams,
}: ChangelogPageProps) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const generationEnabled = isChangelogGenerationEnabled();
  let period = getDefaultChangelogPeriod();
  let suggestedEvidence = [] as Awaited<
    ReturnType<typeof listApprovedEvidenceForPeriod>
  >["suggested"];
  let additionalEvidence = [] as Awaited<
    ReturnType<typeof listApprovedEvidenceForPeriod>
  >["additional"];
  let entry = null as Awaited<ReturnType<typeof getChangelogEntryForPeriod>>;
  let errorMessage: string | null = null;
  let noticeMessage: string | null = null;

  try {
    if (resolvedSearchParams?.periodType && resolvedSearchParams?.periodStart) {
      period = resolveChangelogPeriod(
        resolvedSearchParams.periodType,
        resolvedSearchParams.periodStart,
      );
    }
  } catch (error) {
    noticeMessage = `${getErrorMessage(error)} Showing the current monthly period instead.`;
    period = getDefaultChangelogPeriod();
  }

  try {
    const evidence = await listApprovedEvidenceForPeriod(
      supabase,
      viewer.userId,
      period,
    );
    suggestedEvidence = evidence.suggested;
    additionalEvidence = evidence.additional;
    entry = await getChangelogEntryForPeriod(supabase, viewer.userId, period);
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return (
    <ChangelogWorkspace
      key={`${period.periodType}:${period.periodStart}`}
      period={period}
      entry={entry}
      suggestedEvidence={suggestedEvidence}
      additionalEvidence={additionalEvidence}
      generationEnabled={generationEnabled}
      errorMessage={errorMessage}
      noticeMessage={noticeMessage}
    />
  );
}
