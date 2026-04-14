import { requireViewer } from "@/lib/auth/viewer";

export default async function DashboardPage() {
  const viewer = await requireViewer();

  return (
    <section className="product-panel">
      <div className="page-header">
        <div>
          <div className="eyebrow">Dashboard</div>
          <h1>Approved evidence now flows into drafts, exports, and a lightweight review cadence.</h1>
          <p className="lede">
            {viewer.displayName} can now capture evidence, review it
            deliberately, import bounded GitHub activity, draft resume
            bullets, draft monthly or quarterly changelogs from approved
            evidence with traceable provenance, and save export snapshots
            without weakening the trust model.
          </p>
        </div>
        <div className="helper-text">Milestone 7 complete</div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <div className="metric">
            <span className="metric-value">Drafting live</span>
            <span className="metric-label">
              Roles, review, ledger, drafting, exports, and review-cycle guidance are now active.
            </span>
          </div>
        </article>
        <article className="dashboard-card">
          <div className="metric">
            <span className="metric-value">RLS-first</span>
            <span className="metric-label">
              User-owned tables are locked behind ownership policies.
            </span>
          </div>
        </article>
        <article className="dashboard-card">
          <div className="metric">
            <span className="metric-value">No shortcuts</span>
            <span className="metric-label">
              No runtime service-role path and no post-v1 features pulled forward.
            </span>
          </div>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <h2>What is implemented now</h2>
          <ul className="list">
            <li>GitHub social sign-in through Supabase Auth.</li>
            <li>Protected product layout and dashboard shell.</li>
            <li>Full v1 schema with enums, constraints, and RLS policies.</li>
            <li>Manual evidence capture, review, and approval flow.</li>
            <li>Bounded GitHub import for selected public repositories.</li>
            <li>Ledger filters and downstream linkage visibility.</li>
            <li>Role variants and fail-closed resume drafting.</li>
            <li>Fail-closed monthly and quarterly changelog drafting.</li>
            <li>Saved markdown, text, and JSON exports.</li>
            <li>Read-only review-cycle guidance from live product state.</li>
          </ul>
        </article>
        <article className="dashboard-card">
          <h2>Roadmap status</h2>
          <ul className="list">
            <li>The v1 roadmap is complete through Milestone 7.</li>
            <li>Any next work should be treated as post-v1 backlog, not an implicit Milestone 8.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
