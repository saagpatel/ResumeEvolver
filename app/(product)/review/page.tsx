import { ReviewWorkspace } from "@/components/evidence/review-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { env } from "@/lib/env";
import { listReviewQueueEvidence } from "@/lib/evidence/queries";
import { createClient } from "@/lib/supabase/server";
import type { EvidenceType } from "@/types/domain";
import { evidenceTypes } from "@/types/domain";

interface ReviewPageProps {
  searchParams?: Promise<{
    evidence?: string;
    type?: string;
  }>;
}

function parseTypeFilter(value: string | undefined): EvidenceType | null {
  if (!value) {
    return null;
  }

  return evidenceTypes.includes(value as EvidenceType)
    ? (value as EvidenceType)
    : null;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedType = parseTypeFilter(resolvedSearchParams?.type);
  const queue = await listReviewQueueEvidence(
    supabase,
    viewer.userId,
    selectedType ?? undefined,
  );
  const selectedEvidenceId = resolvedSearchParams?.evidence;
  const selectedEvidence =
    queue.find((evidence) => evidence.id === selectedEvidenceId) ?? queue[0] ?? null;

  return (
    <ReviewWorkspace
      queue={queue}
      selectedEvidence={selectedEvidence}
      selectedType={selectedType}
      structuringEnabled={Boolean(env.OPENAI_API_KEY)}
    />
  );
}
