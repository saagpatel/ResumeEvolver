import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EvidenceError } from "@/lib/evidence/errors";
import type { Viewer } from "@/lib/auth/viewer";
import type { Database } from "@/types/database";
import type {
  GitHubImportCapability,
  GitHubImportCookiePayload,
} from "./contracts";
import { GitHubApiError, getGitHubViewer } from "./client";

export const githubImportCookieName = "resumeevolver-github-import";
export const githubImportPurpose = "github-import";

type SessionWithProviderToken = {
  provider_token?: string;
  provider_refresh_token?: string;
};

function decodeCookiePayload(
  value: string | undefined,
): GitHubImportCookiePayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as GitHubImportCookiePayload;

    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.grantedScopes) ||
      typeof parsed.validatedAt !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function encodeCookiePayload(payload: GitHubImportCookiePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

async function getGitHubProviderToken(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new EvidenceError("Could not resolve the current GitHub session.", 500);
  }

  const providerToken = (session as SessionWithProviderToken | null)?.provider_token;
  return typeof providerToken === "string" && providerToken.length > 0
    ? providerToken
    : null;
}

export async function setGitHubImportCookie(
  response: Response & {
    cookies: {
      set: (
        name: string,
        value: string,
        options: Record<string, boolean | number | string>,
      ) => void;
    };
  },
  grantedScopes: string[],
) {
  response.cookies.set(
    githubImportCookieName,
    encodeCookiePayload({
      version: 1,
      grantedScopes,
      validatedAt: new Date().toISOString(),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  );
}

export function clearGitHubImportCookie(
  response: Response & {
    cookies: {
      delete: (name: string) => void;
    };
  },
) {
  response.cookies.delete(githubImportCookieName);
}

export async function getGitHubImportCapability(
  supabase: SupabaseClient<Database>,
  viewer: Viewer,
): Promise<GitHubImportCapability> {
  if (!viewer.githubConnected) {
    return { status: "not_linked" };
  }

  const cookieStore = await cookies();
  const cookieValue = decodeCookiePayload(
    cookieStore.get(githubImportCookieName)?.value,
  );

  if (!cookieValue) {
    return { status: "reconnect_required", reason: "missing_scope" };
  }

  const providerToken = await getGitHubProviderToken(supabase);

  if (!providerToken) {
    return { status: "reconnect_required", reason: "missing_token" };
  }

  try {
    const viewerContext = await getGitHubViewer(providerToken);
    return {
      status: "ready",
      grantedScopes: viewerContext.grantedScopes,
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) {
      return { status: "reconnect_required", reason: "expired_token" };
    }

    throw error;
  }
}

export async function requireGitHubImportToken(
  supabase: SupabaseClient<Database>,
  viewer: Viewer,
) {
  const capability = await getGitHubImportCapability(supabase, viewer);

  if (capability.status !== "ready") {
    throw new EvidenceError(
      "Reconnect GitHub import access before running an import.",
      409,
    );
  }

  const providerToken = await getGitHubProviderToken(supabase);

  if (!providerToken) {
    throw new EvidenceError(
      "GitHub import access is missing for this session.",
      409,
    );
  }

  return {
    providerToken,
    grantedScopes: capability.grantedScopes,
  };
}
