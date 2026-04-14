import Link from "next/link";
import type { Route } from "next";
import type { ReviewCycleSummary } from "@/lib/review-cycle/queries";

interface ReviewCycleDashboardProps {
  summary: ReviewCycleSummary | null;
  errorMessage?: string | null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Date(value).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function formatApprovalStatus(value: string | null) {
  if (!value) {
    return "No draft yet";
  }

  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function ReviewCycleDashboard({
  summary,
  errorMessage,
}: ReviewCycleDashboardProps) {
  return (
    <section className="product-panel" data-testid="review-cycle-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Review Cycle</div>
          <h1>See the current month and quarter without turning this into workflow software.</h1>
          <p className="lede">
            Review cycle is read-only guidance. It summarizes backlog, current-period
            drafting, and export freshness from the data you already own.
          </p>
        </div>
        <div className="helper-text">Milestone 7</div>
      </div>

      {errorMessage ? (
        <div className="empty-panel">
          <h2>Review cycle is unavailable right now.</h2>
          <p className="error-text">{errorMessage}</p>
          <p className="muted">
            This is a real read failure, not an empty state. Retry after the data
            path recovers.
          </p>
        </div>
      ) : !summary ? (
        <div className="empty-panel">
          <h2>No review-cycle summary is available.</h2>
          <p className="muted">
            The page loaded without an explicit error, but the expected summary was
            missing.
          </p>
        </div>
      ) : (
        <div className="dashboard-grid review-cycle-grid">
          <article className="dashboard-card">
            <h2>Next step</h2>
            <p className="metric-value review-cycle-title">{summary.nextStep.title}</p>
            <p className="metric-label">{summary.nextStep.description}</p>
          </article>

          <article className="dashboard-card">
            <h2>Review backlog</h2>
            <div className="metric">
              <span className="metric-value">{summary.reviewBacklog.unreviewedCount}</span>
              <span className="metric-label">Unreviewed evidence</span>
            </div>
            <div className="metric">
              <span className="metric-value">
                {summary.reviewBacklog.structuredDecisionCount}
              </span>
              <span className="metric-label">Structured items needing a decision</span>
            </div>
            <div className="button-row">
              <Link href={"/review" as Route} className="button button-secondary">
                Open review
              </Link>
            </div>
          </article>

          <article className="dashboard-card">
            <h2>Evidence momentum</h2>
            <div className="metric">
              <span className="metric-value">
                {summary.evidenceMomentum.approvedThisMonth}
              </span>
              <span className="metric-label">Approved this month</span>
            </div>
            <div className="metric">
              <span className="metric-value">
                {summary.evidenceMomentum.approvedThisQuarter}
              </span>
              <span className="metric-label">Approved this quarter</span>
            </div>
          </article>

          <article className="dashboard-card">
            <h2>Current month changelog</h2>
            <p className="metric-label">{summary.changelogCoverage.month.label}</p>
            <p className="metric-value">
              {formatApprovalStatus(summary.changelogCoverage.month.approvalStatus)}
            </p>
            <p className="metric-label">
              Updated {formatDate(summary.changelogCoverage.month.updatedAt)}
            </p>
            <div className="button-row">
              <Link
                href={
                  `/changelog?periodType=${summary.changelogCoverage.month.periodType}&periodStart=${summary.changelogCoverage.month.periodStart}` as Route
                }
                className="button button-secondary"
              >
                Open changelog
              </Link>
            </div>
          </article>

          <article className="dashboard-card">
            <h2>Current quarter changelog</h2>
            <p className="metric-label">{summary.changelogCoverage.quarter.label}</p>
            <p className="metric-value">
              {formatApprovalStatus(summary.changelogCoverage.quarter.approvalStatus)}
            </p>
            <p className="metric-label">
              Updated {formatDate(summary.changelogCoverage.quarter.updatedAt)}
            </p>
            <div className="button-row">
              <Link
                href={
                  `/changelog?periodType=${summary.changelogCoverage.quarter.periodType}&periodStart=${summary.changelogCoverage.quarter.periodStart}` as Route
                }
                className="button button-secondary"
              >
                Open quarter
              </Link>
            </div>
          </article>

          <article className="dashboard-card">
            <h2>Approved resume coverage</h2>
            <div className="metric">
              <span className="metric-value">
                {summary.resumeCoverage.approvedRoleSetCount}
              </span>
              <span className="metric-label">Role sets approved for export</span>
            </div>
            {summary.resumeCoverage.roles.length ? (
              <ul className="list muted small-text">
                {summary.resumeCoverage.roles.map((role) => (
                  <li key={role.roleVariantId}>
                    {role.roleName} ({role.approvedBulletCount} approved bullet
                    {role.approvedBulletCount === 1 ? "" : "s"})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small-text">
                No role-targeted resume bullet set is approved yet.
              </p>
            )}
          </article>

          <article className="dashboard-card">
            <h2>Export recency</h2>
            <ul className="list muted small-text">
              <li>Resume exports: {formatDate(summary.exportRecency.resumeBullets)}</li>
              <li>Changelog exports: {formatDate(summary.exportRecency.changelogEntry)}</li>
              <li>Evidence snapshots: {formatDate(summary.exportRecency.evidenceSnapshot)}</li>
            </ul>
            <div className="button-row">
              <Link href={"/exports" as Route} className="button button-secondary">
                Open exports
              </Link>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
