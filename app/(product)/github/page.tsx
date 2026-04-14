import { GitHubWorkspace } from "@/components/github/github-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getGitHubImportCapability } from "@/lib/github/auth";
import { createClient } from "@/lib/supabase/server";

function subDays(value: Date, days: number) {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000);
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function GitHubPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const capability = await getGitHubImportCapability(supabase, viewer);
  const today = new Date();

  return (
    <GitHubWorkspace
      capability={capability}
      defaultFrom={toDateInputValue(subDays(today, 30))}
      defaultTo={toDateInputValue(today)}
    />
  );
}
