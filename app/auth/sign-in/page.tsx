import { redirect } from "next/navigation";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { getViewer } from "@/lib/auth/viewer";

export default async function SignInPage() {
  const viewer = await getViewer();

  if (viewer) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">Private-first sign-in</div>
        <h1>Sign in with GitHub to unlock the ledger shell.</h1>
        <p className="lede">
          ResumeEvolver uses GitHub social login through Supabase Auth for
          identity and the protected shell. GitHub import is connected
          separately inside the app so the base sign-in stays narrow.
        </p>

        <div className="button-row">
          <GitHubSignInButton />
        </div>

        <p className="auth-note">
          Base sign-in scope request: <strong>read:user user:email</strong>
        </p>
      </section>
    </main>
  );
}
