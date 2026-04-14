"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type {
  EvidenceSnapshotCandidate,
  ExportHistoryRecord,
  ExportableChangelogTarget,
  ExportableResumeTarget,
} from "@/lib/exports/queries";

interface ExportWorkspaceProps {
  resumeTargets: ExportableResumeTarget[];
  changelogTargets: ExportableChangelogTarget[];
  evidenceCandidates: EvidenceSnapshotCandidate[];
  history: ExportHistoryRecord[];
  errorMessage?: string | null;
}

function formatEvidenceType(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

export function ExportWorkspace({
  resumeTargets,
  changelogTargets,
  evidenceCandidates,
  history,
  errorMessage,
}: ExportWorkspaceProps) {
  const router = useRouter();
  const [selectedResumeTargetId, setSelectedResumeTargetId] = useState(
    resumeTargets[0]?.roleVariantId ?? "",
  );
  const [selectedResumeFormat, setSelectedResumeFormat] = useState<
    "markdown" | "text" | "json"
  >("markdown");
  const [selectedChangelogTargetId, setSelectedChangelogTargetId] = useState(
    changelogTargets[0]?.entryId ?? "",
  );
  const [selectedChangelogFormat, setSelectedChangelogFormat] = useState<
    "markdown" | "text" | "json"
  >("markdown");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedEvidenceCount = selectedEvidenceIds.length;
  const canCreateSnapshot = selectedEvidenceCount > 0 && selectedEvidenceCount <= 100;

  const recentHistory = useMemo(() => history.slice(0, 12), [history]);

  function toggleEvidence(id: string) {
    setSelectedEvidenceIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= 100
          ? current
          : [...current, id],
    );
  }

  function submitExport(
    payload:
      | {
          targetType: "resume_bullets";
          targetId: string;
          format: "markdown" | "text" | "json";
        }
      | {
          targetType: "changelog_entry";
          targetId: string;
          format: "markdown" | "text" | "json";
        }
      | {
          targetType: "evidence_snapshot";
          targetId: null;
          format: "json";
          evidenceIds: string[];
        },
  ) {
    startTransition(async () => {
      setFormError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/exports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        exportRecord?: ExportHistoryRecord;
      };

      if (!response.ok || !data.exportRecord) {
        setFormError(data.error ?? "Could not create the export.");
        return;
      }

      if (payload.targetType === "evidence_snapshot") {
        setSelectedEvidenceIds([]);
      }

      setSuccessMessage(`Saved ${data.exportRecord.targetLabel} as ${data.exportRecord.format}.`);
      router.refresh();
    });
  }

  return (
    <section className="product-panel" data-testid="exports-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Exports</div>
          <h1>Save private export snapshots from approved outputs and selected evidence.</h1>
          <p className="lede">
            Exports are saved snapshots, not transient downloads. Resume and
            changelog exports stay gated to approved derived outputs.
          </p>
        </div>
        <div className="helper-text">Milestone 7</div>
      </div>

      {errorMessage ? (
        <div className="empty-panel">
          <h2>Exports are unavailable right now.</h2>
          <p className="error-text">{errorMessage}</p>
          <p className="muted">
            This is a real read failure, not an empty state. Retry after the data
            path recovers.
          </p>
        </div>
      ) : (
        <div className="workspace-grid">
          <aside className="workspace-sidebar">
            <div className="section-row">
              <div>
                <h2>Create export</h2>
                <p className="muted small-text">
                  Export approved resume outputs, approved changelog entries, or a
                  selected JSON evidence snapshot.
                </p>
              </div>
              <Link href={"/ledger" as Route} className="button button-secondary">
                Open ledger
              </Link>
            </div>

            {formError ? <p className="error-text">{formError}</p> : null}
            {successMessage ? <p className="success-text">{successMessage}</p> : null}

            <div className="editor-stack">
              <section className="empty-panel">
                <h3>Resume export</h3>
                {resumeTargets.length ? (
                  <>
                    <label className="field field-grid-compact">
                      <span className="field-label">Role variant</span>
                      <select
                        value={selectedResumeTargetId}
                        onChange={(event) =>
                          setSelectedResumeTargetId(event.currentTarget.value)
                        }
                        disabled={isPending}
                      >
                        {resumeTargets.map((target) => (
                          <option key={target.roleVariantId} value={target.roleVariantId}>
                            {target.roleName} ({target.approvedBulletCount} approved bullets)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field field-grid-compact">
                      <span className="field-label">Format</span>
                      <select
                        value={selectedResumeFormat}
                        onChange={(event) =>
                          setSelectedResumeFormat(
                            event.currentTarget.value as "markdown" | "text" | "json",
                          )
                        }
                        disabled={isPending}
                      >
                        <option value="markdown">Markdown</option>
                        <option value="text">Text</option>
                        <option value="json">JSON</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        submitExport({
                          targetType: "resume_bullets",
                          targetId: selectedResumeTargetId,
                          format: selectedResumeFormat,
                        })
                      }
                      disabled={!selectedResumeTargetId || isPending}
                    >
                      {isPending ? "Saving..." : "Save resume export"}
                    </button>
                  </>
                ) : (
                  <p className="muted small-text">
                    No approved role-scoped bullet sets are ready to export yet.
                  </p>
                )}
              </section>

              <section className="empty-panel">
                <h3>Changelog export</h3>
                {changelogTargets.length ? (
                  <>
                    <label className="field field-grid-compact">
                      <span className="field-label">Approved changelog</span>
                      <select
                        value={selectedChangelogTargetId}
                        onChange={(event) =>
                          setSelectedChangelogTargetId(event.currentTarget.value)
                        }
                        disabled={isPending}
                      >
                        {changelogTargets.map((target) => (
                          <option key={target.entryId} value={target.entryId}>
                            {target.title} ({target.periodType} {target.periodStart})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field field-grid-compact">
                      <span className="field-label">Format</span>
                      <select
                        value={selectedChangelogFormat}
                        onChange={(event) =>
                          setSelectedChangelogFormat(
                            event.currentTarget.value as "markdown" | "text" | "json",
                          )
                        }
                        disabled={isPending}
                      >
                        <option value="markdown">Markdown</option>
                        <option value="text">Text</option>
                        <option value="json">JSON</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        submitExport({
                          targetType: "changelog_entry",
                          targetId: selectedChangelogTargetId,
                          format: selectedChangelogFormat,
                        })
                      }
                      disabled={!selectedChangelogTargetId || isPending}
                    >
                      {isPending ? "Saving..." : "Save changelog export"}
                    </button>
                  </>
                ) : (
                  <p className="muted small-text">
                    No approved changelog entries are ready to export yet.
                  </p>
                )}
              </section>

              <section className="empty-panel">
                <div className="section-row">
                  <div>
                    <h3>Evidence snapshot</h3>
                    <p className="muted small-text">
                      JSON only. Select up to 100 owned evidence records for a
                      private backup snapshot.
                    </p>
                  </div>
                  <span className="badge">{selectedEvidenceCount} selected</span>
                </div>

                {evidenceCandidates.length ? (
                  <ul className="record-list export-candidate-list">
                    {evidenceCandidates.map((evidence) => {
                      const selected = selectedEvidenceIds.includes(evidence.id);

                      return (
                        <li key={evidence.id} className="record-card">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleEvidence(evidence.id)}
                              disabled={isPending}
                              aria-label={evidence.title}
                            />
                            <div>
                              <strong>{evidence.title}</strong>
                              <p className="muted small-text">
                                {formatEvidenceType(evidence.type)} •{" "}
                                {evidence.projectName ?? "No project"} •{" "}
                                {evidence.ledgerStatus}
                              </p>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small-text">
                    No evidence is available yet for a snapshot export.
                  </p>
                )}

                <button
                  type="button"
                  className="button button-primary"
                  onClick={() =>
                    submitExport({
                      targetType: "evidence_snapshot",
                      targetId: null,
                      format: "json",
                      evidenceIds: selectedEvidenceIds,
                    })
                  }
                  disabled={!canCreateSnapshot || isPending}
                >
                  {isPending ? "Saving..." : "Save evidence snapshot"}
                </button>
              </section>
            </div>
          </aside>

          <div className="workspace-main">
            <div className="section-row">
              <div>
                <h2>Saved export history</h2>
                <p className="muted small-text">
                  Download saved snapshots directly from your private export history.
                </p>
              </div>
            </div>

            {recentHistory.length ? (
              <ul className="record-list">
                {recentHistory.map((entry) => (
                  <li key={entry.id} className="record-card">
                    <div className="section-row">
                      <div>
                        <h3>{entry.targetLabel}</h3>
                        <p className="muted small-text">{entry.targetSummary}</p>
                      </div>
                      <div className="record-meta record-meta-stack">
                        <span>{entry.format.toUpperCase()}</span>
                        <span>{formatDate(entry.createdAt)}</span>
                      </div>
                    </div>

                    <div className="button-row">
                      <a
                        href={`/api/exports/${entry.id}`}
                        className="button button-primary"
                      >
                        Download {entry.fileName}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-panel">
                <h3>No exports saved yet</h3>
                <p className="muted small-text">
                  Create your first export from an approved resume set, approved
                  changelog entry, or selected evidence snapshot.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
