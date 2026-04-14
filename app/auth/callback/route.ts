import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  clearGitHubImportCookie,
  githubImportPurpose,
  setGitHubImportCookie,
} from "@/lib/github/auth";
import { getGitHubViewer } from "@/lib/github/client";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  let next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const purpose = requestUrl.searchParams.get("purpose");

  if (!next.startsWith("/")) {
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(`${requestUrl.origin}${next}`);

      if (purpose === githubImportPurpose) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const providerToken = (session as { provider_token?: string } | null)
          ?.provider_token;

        if (providerToken) {
          try {
            const viewer = await getGitHubViewer(providerToken);
            await setGitHubImportCookie(response, viewer.grantedScopes);
          } catch {
            clearGitHubImportCookie(response);
          }
        } else {
          clearGitHubImportCookie(response);
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
}
