import { ReviewCycleDashboard } from "@/components/review-cycle/review-cycle-dashboard";
import { requireViewer } from "@/lib/auth/viewer";
import { getErrorMessage } from "@/lib/evidence/errors";
import { getReviewCycleSummary } from "@/lib/review-cycle/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewCyclePage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  let summary = null as Awaited<ReturnType<typeof getReviewCycleSummary>> | null;
  let errorMessage: string | null = null;

  try {
    summary = await getReviewCycleSummary(supabase, viewer.userId);
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return <ReviewCycleDashboard summary={summary} errorMessage={errorMessage} />;
}
