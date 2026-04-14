"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      setErrorMessage(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await fetch("/auth/sign-out", {
        method: "POST",
      });

      window.location.assign("/");
    });
  }

  return (
    <div className="stack-row">
      <button
        type="button"
        className="button button-secondary"
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
      {errorMessage ? <span className="error-text">{errorMessage}</span> : null}
    </div>
  );
}
