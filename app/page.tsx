import Link from "next/link";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { getViewer } from "@/lib/auth/viewer";

export default async function HomePage() {
  const viewer = await getViewer();

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="eyebrow">Private-first career evidence ledger</div>
        <h1>Capture real proof first. Draft later. Publish only on purpose.</h1>
        <p className="lede">
          ResumeEvolver helps technical operators and side-project builders turn
          real work evidence into traceable resume bullets and changelog drafts
          without drifting into AI fiction.
        </p>
        <div className="landing-actions">
          {viewer ? (
            <Link href="/dashboard" className="button button-primary">
              Go to dashboard
            </Link>
          ) : (
            <GitHubSignInButton />
          )}
          <Link href="/auth/sign-in" className="button button-secondary">
            View sign-in flow
          </Link>
        </div>
      </section>

      <section className="landing-grid">
        <article className="card">
          <h2>What it is</h2>
          <p>
            A reusable ledger of evidence items with deliberate review and
            approval before any draft is generated.
          </p>
        </article>
        <article className="card">
          <h2>What it is not</h2>
          <p>
            Not a social profile, not an ATS, not a fake-accomplishment engine,
            and not a generic AI coach.
          </p>
        </article>
        <article className="card">
          <h2>Milestone 6 complete</h2>
          <p>
            Manual capture, deliberate review, Ledger, GitHub import, role
            variants, resume drafting, and changelog drafting are now live on
            top of the auth, schema, and RLS foundation.
          </p>
        </article>
      </section>
    </main>
  );
}
