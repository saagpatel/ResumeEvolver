import { InboxWorkspace } from "@/components/evidence/inbox-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { listRecentEditableEvidence } from "@/lib/evidence/queries";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const recentEvidence = await listRecentEditableEvidence(
    supabase,
    viewer.userId,
    6,
  );

  return <InboxWorkspace recentEvidence={recentEvidence} />;
}
