"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

interface GitHubSignInButtonProps {
  next?: string;
  purpose?: "sign-in" | "github-import";
  label?: string;
  pendingLabel?: string;
}

export function GitHubSignInButton({
  next = "/dashboard",
  purpose = "sign-in",
  label = "Sign in with GitHub",
  pendingLabel = "Redirecting to GitHub...",
}: GitHubSignInButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSignIn() {
    startTransition(async () => {
      setErrorMessage(null);

      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", next);
      redirectTo.searchParams.set("purpose", purpose);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: {
            scope: "read:user user:email",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
      }
    });
  }

  return (
    <div className="stack-row">
      <button
        type="button"
        className="button button-primary"
        onClick={handleSignIn}
        disabled={isPending}
      >
        {isPending ? pendingLabel : label}
      </button>
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </div>
  );
}
