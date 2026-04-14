import { ExportWorkspace } from "@/components/exports/export-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getErrorMessage } from "@/lib/evidence/errors";
import {
  listEvidenceSnapshotCandidates,
  listExportHistory,
  listExportableChangelogTargets,
  listExportableResumeTargets,
} from "@/lib/exports/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ExportsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  let resumeTargets = [] as Awaited<ReturnType<typeof listExportableResumeTargets>>;
  let changelogTargets =
    [] as Awaited<ReturnType<typeof listExportableChangelogTargets>>;
  let evidenceCandidates =
    [] as Awaited<ReturnType<typeof listEvidenceSnapshotCandidates>>;
  let history = [] as Awaited<ReturnType<typeof listExportHistory>>;
  let errorMessage: string | null = null;

  try {
    [resumeTargets, changelogTargets, evidenceCandidates, history] =
      await Promise.all([
        listExportableResumeTargets(supabase, viewer.userId),
        listExportableChangelogTargets(supabase, viewer.userId),
        listEvidenceSnapshotCandidates(supabase, viewer.userId),
        listExportHistory(supabase, viewer.userId),
      ]);
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return (
    <ExportWorkspace
      resumeTargets={resumeTargets}
      changelogTargets={changelogTargets}
      evidenceCandidates={evidenceCandidates}
      history={history}
      errorMessage={errorMessage}
    />
  );
}
