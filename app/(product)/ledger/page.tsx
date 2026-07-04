import { LedgerWorkspace } from "@/components/evidence/ledger-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getErrorMessage } from "@/lib/evidence/errors";
import { parseLedgerFilters } from "@/lib/evidence/ledger";
import {
  getLedgerEvidenceDetail,
  listLedgerEvidence,
  listLedgerProjectNames,
} from "@/lib/evidence/queries";
import { createClient } from "@/lib/supabase/server";

interface LedgerPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filters = parseLedgerFilters(resolvedSearchParams);
  let records: Awaited<ReturnType<typeof listLedgerEvidence>> = [];
  let projectOptions: Awaited<ReturnType<typeof listLedgerProjectNames>> = [];
  let selectedEvidence: Awaited<ReturnType<typeof getLedgerEvidenceDetail>> | null =
    null;
  let selectionMissing = false;
  let errorMessage: string | undefined;

  try {
    [records, projectOptions] = await Promise.all([
      listLedgerEvidence(supabase, viewer.userId, filters),
      listLedgerProjectNames(supabase, viewer.userId),
    ]);

    const selectedRequested = Boolean(filters.evidence);
    const selectedEvidenceId =
      filters.evidence ?? records[0]?.id ?? null;
    const selectedExistsInList = selectedEvidenceId
      ? records.some((record) => record.id === selectedEvidenceId)
      : false;
    selectionMissing = selectedRequested && !selectedExistsInList;
    selectedEvidence =
      selectedEvidenceId && selectedExistsInList
        ? await getLedgerEvidenceDetail(
            supabase,
            viewer.userId,
            selectedEvidenceId,
          )
        : null;
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  return (
    <LedgerWorkspace
      filters={filters}
      records={records}
      projectOptions={projectOptions}
      selectedEvidence={selectedEvidence}
      selectionMissing={selectionMissing}
      errorMessage={errorMessage}
    />
  );
}
