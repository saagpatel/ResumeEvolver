import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">Auth callback error</div>
        <h1>GitHub sign-in did not finish cleanly.</h1>
        <p className="lede">
          Check that your Supabase GitHub provider callback URL and redirect
          allow-list are configured for this environment, then try again.
        </p>
        <div className="button-row">
          <Link href="/auth/sign-in" className="button button-primary">
            Return to sign-in
          </Link>
          <Link href="/" className="button button-secondary">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
