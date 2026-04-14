import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export interface Viewer {
  userId: string;
  email: string | null;
  displayName: string;
  githubConnected: boolean;
}

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const userId = String(data.claims.sub);
  const email =
    typeof data.claims.email === "string" ? data.claims.email : null;

  type ProfileSnapshot = Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "display_name" | "github_connected"
  >;

  const {
    data: resolvedProfileData,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("display_name, github_connected")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Could not load the authenticated viewer profile.", {
      cause: profileError,
    });
  }

  const profile = resolvedProfileData as ProfileSnapshot | null;

  return {
    userId,
    email,
    displayName: profile?.display_name ?? email ?? "ResumeEvolver user",
    githubConnected: profile?.github_connected ?? false,
  };
}

export async function requireViewer() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/auth/sign-in");
  }

  return viewer;
}
