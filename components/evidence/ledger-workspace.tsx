import type { Route } from "next";
import Link from "next/link";
import type { LedgerFilters } from "@/lib/evidence/ledger";
import {
  hasActiveLedgerFilters,
  ledgerStatusLabels,
} from "@/lib/evidence/ledger";
import type {
  LedgerDetailRecord,
  LedgerSummaryRecord,
} from "@/lib/evidence/queries";
import { isEditableEvidence } from "@/lib/evidence/state-machine";
import { evidenceTypes, proofStrengths } from "@/types/domain";
import type { LedgerStatus } from "@/types/domain";

interface LedgerWorkspaceProps {
  filters: LedgerFilters;
  records: LedgerSummaryRecord[];
  projectOptions: string[];
  selectedEvidence: LedgerDetailRecord | null;
  selectionMissing: boolean;
  errorMessage?: string | null;
}

function toLedgerHref(
  filters: LedgerFilters,
  overrides: Partial<Record<keyof LedgerFilters, string | undefined>>,
) {
  const params = new URLSearchParams();
  const nextFilters = {
    ...filters,
    ...overrides,
  };

  for (const [key, value] of Object.entries(nextFilters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return (query ? `/ledger?${query}` : "/ledger") as Route;
}

function formatEvidenceType(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatEvidenceTimeSummary(record: {
  time_start: string | null;
  time_end: string | null;
  created_at: string;
}) {
  if (record.time_start && record.time_end) {
    return `${formatDateTime(record.time_start)} to ${formatDateTime(record.time_end)}`;
  }

  if (record.time_start) {
    return `Started ${formatDateTime(record.time_start)}`;
  }

  if (record.time_end) {
    return `Ended ${formatDateTime(record.time_end)}`;
  }

  return `Recorded ${formatDateTime(record.created_at)}`;
}

function formatLedgerStatus(status: LedgerStatus) {
  return ledgerStatusLabels[status];
}

function formatSourceSystem(value: string) {
  return value === "github" ? "GitHub" : "Manual";
}

function getProjectOptions(filters: LedgerFilters, projectOptions: string[]) {
  if (!filters.project || projectOptions.includes(filters.project)) {
    return projectOptions;
  }

  return [filters.project, ...projectOptions];
}

function renderUsageCount(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function LedgerWorkspace({
  filters,
  records,
  projectOptions,
  selectedEvidence,
  selectionMissing,
  errorMessage,
}: LedgerWorkspaceProps) {
  const resolvedProjectOptions = getProjectOptions(filters, projectOptions);

  return (
    <section className="product-panel" data-testid="ledger-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Ledger</div>
          <h1>Browse your evidence as the source of truth.</h1>
          <p className="lede">
            Ledger is read-first. Review still owns edits and approvals.
          </p>
        </div>
        <div className="helper-text">Milestone 3</div>
      </div>

      <form className="ledger-filter-grid" method="get">
        <label className="field">
          <span className="field-label">Type</span>
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">All evidence types</option>
            {evidenceTypes.map((type) => (
              <option key={type} value={type}>
                {formatEvidenceType(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Ledger status</span>
          <select name="ledgerStatus" defaultValue={filters.ledgerStatus ?? ""}>
            <option value="">All statuses</option>
            {Object.entries(ledgerStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Proof strength</span>
          <select name="proofStrength" defaultValue={filters.proofStrength ?? ""}>
            <option value="">Any proof strength</option>
            {proofStrengths.map((proofStrength) => (
              <option key={proofStrength} value={proofStrength}>
                {proofStrength.charAt(0).toUpperCase() + proofStrength.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Project</span>
          <select name="project" defaultValue={filters.project ?? ""}>
            <option value="">All projects</option>
            {resolvedProjectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">From</span>
          <input type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>

        <label className="field">
          <span className="field-label">To</span>
          <input type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>

        <div className="button-row ledger-filter-actions">
          <button type="submit" className="button button-primary">
            Apply filters
          </button>
          <Link href="/ledger" className="button button-secondary">
            Clear filters
          </Link>
        </div>
      </form>

      {errorMessage ? (
        <div className="empty-panel">
          <h2>Ledger is unavailable right now.</h2>
          <p className="error-text">{errorMessage}</p>
          <p className="muted">
            This is a real read failure, not an empty state. Try again after the
            query path recovers.
          </p>
        </div>
      ) : (
        <div className="workspace-grid ledger-grid">
          <aside className="workspace-sidebar">
            <div className="section-row">
              <div>
                <h2>Evidence records</h2>
                <p className="muted small-text">
                  {records.length
                    ? `${records.length} record${records.length === 1 ? "" : "s"} match the current view.`
                    : hasActiveLedgerFilters(filters)
                      ? "No evidence matches the current filters."
                      : "No evidence has been captured yet."}
                </p>
              </div>
            </div>

            {records.length ? (
              <ul className="record-list" data-testid="ledger-record-list">
                {records.map((record) => {
                  const isSelected = record.id === selectedEvidence?.id;

                  return (
                    <li
                      key={record.id}
                      className={`record-card ${isSelected ? "record-card-active" : ""}`}
                    >
                      <Link
                        href={toLedgerHref(filters, { evidence: record.id })}
                        className="ledger-record-link"
                      >
                        <div className="record-head">
                          <strong data-testid={`ledger-record-title-${record.id}`}>
                            {record.title}
                          </strong>
                          <span className="status-pill">
                            {formatEvidenceType(record.type)}
                          </span>
                        </div>
                        <div className="record-meta record-meta-stack">
                          <span>{formatLedgerStatus(record.ledgerStatus)}</span>
                          <span>{formatSourceSystem(record.source_system)}</span>
                          <span>{record.project_name ?? "No project"}</span>
                        </div>
                        <p className="muted small-text">
                          {formatEvidenceTimeSummary(record)}
                        </p>
                        <div className="record-meta record-meta-stack">
                          <span>{record.proof_strength ?? "Proof not set"}</span>
                          <span>{renderUsageCount("link", record.linkCount)}</span>
                          <span>
                            {renderUsageCount(
                              "resume reference",
                              record.downstreamResumeBulletCount,
                            )}
                          </span>
                          <span>
                            {renderUsageCount(
                              "changelog reference",
                              record.downstreamChangelogCount,
                            )}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-panel">
                <p className="muted">
                  {hasActiveLedgerFilters(filters)
                    ? "Try widening your filters or clearing the selected project and dates."
                    : "Capture evidence in Inbox and review it deliberately before using it downstream."}
                </p>
              </div>
            )}
          </aside>

          <div className="workspace-main">
            {selectionMissing ? (
              <div className="empty-panel">
                <h2>Selected evidence is outside the current view.</h2>
                <p className="muted">
                  Adjust the filters or pick another evidence record from the list.
                </p>
              </div>
            ) : selectedEvidence ? (
              <article className="ledger-detail" data-testid="ledger-detail">
                <div className="section-row">
                  <div>
                    <div className="eyebrow">Evidence detail</div>
                    <h2>{selectedEvidence.title}</h2>
                    <p className="lede">
                      {selectedEvidence.factual_summary ??
                        "No factual summary saved yet. Review can still structure this evidence later."}
                    </p>
                  </div>
                  <div className="ledger-detail-actions">
                    <span className="status-pill">
                      {formatLedgerStatus(selectedEvidence.ledgerStatus)}
                    </span>
                    {selectedEvidence.source_system === "manual" &&
                    isEditableEvidence(
                      selectedEvidence.verification_status,
                      selectedEvidence.approval_status,
                    ) ? (
                      <Link
                        href={`/review?evidence=${selectedEvidence.id}` as Route}
                        className="button button-secondary"
                      >
                        Open in review
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="review-summary-grid">
                  <div className="card compact-card">
                    <div className="metric">
                      <span className="metric-label">Evidence type</span>
                      <span className="metric-value metric-value-small">
                        {formatEvidenceType(selectedEvidence.type)}
                      </span>
                    </div>
                  </div>
                  <div className="card compact-card">
                    <div className="metric">
                      <span className="metric-label">Proof strength</span>
                      <span className="metric-value metric-value-small">
                        {selectedEvidence.proof_strength ?? "Not set"}
                      </span>
                    </div>
                  </div>
                  <div className="card compact-card">
                    <div className="metric">
                      <span className="metric-label">Project</span>
                      <span className="metric-value metric-value-small">
                        {selectedEvidence.project_name ?? "No project"}
                      </span>
                    </div>
                  </div>
                  <div className="card compact-card">
                    <div className="metric">
                      <span className="metric-label">Source system</span>
                      <span className="metric-value metric-value-small">
                        {formatSourceSystem(selectedEvidence.source_system)}
                      </span>
                    </div>
                  </div>
                </div>

                <section className="card compact-card">
                  <h3>Timing and approval</h3>
                  <div className="ledger-detail-grid">
                    <div>
                      <div className="field-label">Recorded window</div>
                      <p className="muted">
                        {formatEvidenceTimeSummary(selectedEvidence)}
                      </p>
                    </div>
                    <div>
                      <div className="field-label">Verification / approval</div>
                      <p className="muted">
                        {selectedEvidence.verification_status} /{" "}
                        {selectedEvidence.approval_status}
                      </p>
                    </div>
                    <div>
                      <div className="field-label">Visibility default</div>
                      <p className="muted">{selectedEvidence.visibility_default}</p>
                    </div>
                    <div>
                      <div className="field-label">Created</div>
                      <p className="muted">{formatDateTime(selectedEvidence.created_at)}</p>
                    </div>
                  </div>
                </section>

                <section className="card compact-card">
                  <h3>Supporting links</h3>
                  {selectedEvidence.source_url ? (
                    <p className="muted small-text">
                      Source reference:{" "}
                      <a
                        href={selectedEvidence.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-link"
                      >
                        {selectedEvidence.source_url}
                      </a>
                    </p>
                  ) : null}

                  {selectedEvidence.links.length ? (
                    <ul className="ledger-link-list">
                      {selectedEvidence.links.map((link) => (
                        <li key={`${link.linkType}-${link.label}-${link.url}`}>
                          <span className="status-pill">{link.linkType}</span>
                          <strong>{link.label}</strong>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-link"
                          >
                            {link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      No supporting links are saved on this record yet.
                    </p>
                  )}
                </section>

                <section className="card compact-card">
                  <h3>Raw evidence</h3>
                  <pre className="ledger-raw-input">{selectedEvidence.raw_input}</pre>
                </section>

                <section className="card compact-card">
                  <h3>Downstream linkage</h3>
                  <div className="ledger-detail-grid">
                    <div>
                      <div className="field-label">Resume bullets</div>
                      {selectedEvidence.downstreamResumeBulletIds.length ? (
                        <ul className="list list-tight">
                          {selectedEvidence.downstreamResumeBulletIds.map((id) => (
                            <li key={id}>
                              <code>{id}</code>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">No resume bullets use this evidence yet.</p>
                      )}
                    </div>
                    <div>
                      <div className="field-label">Changelog entries</div>
                      {selectedEvidence.downstreamChangelogIds.length ? (
                        <ul className="list list-tight">
                          {selectedEvidence.downstreamChangelogIds.map((id) => (
                            <li key={id}>
                              <code>{id}</code>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">No changelog entries use this evidence yet.</p>
                      )}
                    </div>
                  </div>
                </section>
              </article>
            ) : (
              <div className="empty-panel">
                <h2>No evidence selected</h2>
                <p className="muted">
                  Choose an evidence record from the list to inspect its detail and
                  downstream traceability.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
