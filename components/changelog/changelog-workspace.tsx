"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ChangelogApprovalStatus,
  ResolvedChangelogPeriod,
} from "@/lib/changelog/contracts";
import type {
  ChangelogCandidateEvidence,
  ChangelogEntryRecord,
} from "@/lib/changelog/queries";

interface ChangelogWorkspaceProps {
  period: ResolvedChangelogPeriod;
  entry: ChangelogEntryRecord | null;
  suggestedEvidence: ChangelogCandidateEvidence[];
  additionalEvidence: ChangelogCandidateEvidence[];
  generationEnabled: boolean;
  errorMessage?: string | null;
  noticeMessage?: string | null;
}

const changelogApprovalOptions: Array<{
  value: ChangelogApprovalStatus;
  label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "approved_private", label: "Approved private" },
  { value: "approved_public_safe", label: "Approved public-safe" },
  { value: "do_not_use", label: "Do not use" },
];

function formatEvidenceType(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatPeriodLabel(period: ResolvedChangelogPeriod) {
  const start = new Date(`${period.periodStart}T00:00:00.000Z`);
  const end = new Date(`${period.periodEnd}T00:00:00.000Z`);

  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function alignPeriodStart(periodType: ResolvedChangelogPeriod["periodType"], value: string) {
  if (!value) {
    return value;
  }

  const [yearText, monthText] = value.split("-").slice(0, 2);
  const year = Number(yearText);
  const month = Number(monthText);

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return value;
  }

  const alignedMonth =
    periodType === "quarterly"
      ? month <= 3
        ? 1
        : month <= 6
          ? 4
          : month <= 9
            ? 7
            : 10
      : month;

  return `${String(year).padStart(4, "0")}-${String(alignedMonth).padStart(2, "0")}-01`;
}

export function ChangelogWorkspace({
  period,
  entry,
  suggestedEvidence,
  additionalEvidence,
  generationEnabled,
  errorMessage,
  noticeMessage,
}: ChangelogWorkspaceProps) {
  const router = useRouter();
  const [periodType, setPeriodType] = useState<ResolvedChangelogPeriod["periodType"]>(
    period.periodType,
  );
  const [periodStart, setPeriodStart] = useState(period.periodStart);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [replaceEdited, setReplaceEdited] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(entry);
  const [draftTitle, setDraftTitle] = useState(entry?.title ?? "");
  const [draftBody, setDraftBody] = useState(entry?.body ?? "");
  const [approvalStatus, setApprovalStatus] = useState<ChangelogApprovalStatus>(
    (entry?.approval_status as ChangelogApprovalStatus | undefined) ?? "draft",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();

  function toggleEvidence(id: string) {
    setSelectedEvidenceIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function loadPeriod() {
    const nextPeriodStart = alignPeriodStart(periodType, periodStart);
    setPeriodStart(nextPeriodStart);
    router.push(
      `/changelog?periodType=${periodType}&periodStart=${nextPeriodStart}` as Route,
    );
  }

  function handleGenerate() {
    startTransition(async () => {
      setFormError(null);

      const response = await fetch("/api/changelog/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodType,
          periodStart,
          evidenceIds: selectedEvidenceIds,
          replaceEdited,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        entry?: ChangelogEntryRecord;
      };

      if (!response.ok || !payload.entry) {
        setFormError(payload.error ?? "Changelog drafting failed.");
        return;
      }

      setCurrentEntry(payload.entry);
      setDraftTitle(payload.entry.title);
      setDraftBody(payload.entry.body);
      setApprovalStatus(payload.entry.approval_status as ChangelogApprovalStatus);
      setReplaceEdited(false);
      router.refresh();
    });
  }

  function handleSaveDraft() {
    if (!currentEntry) {
      return;
    }

    startSavingTransition(async () => {
      setSaveError(null);

      const response = await fetch(`/api/changelog/${currentEntry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: draftTitle !== currentEntry.title ? draftTitle : undefined,
          body: draftBody !== currentEntry.body ? draftBody : undefined,
          approvalStatus:
            approvalStatus !== currentEntry.approval_status
              ? approvalStatus
              : undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        entry?: ChangelogEntryRecord;
      };

      if (!response.ok || !payload.entry) {
        setSaveError(payload.error ?? "Could not save the changelog draft.");
        return;
      }

      setCurrentEntry(payload.entry);
      setDraftTitle(payload.entry.title);
      setDraftBody(payload.entry.body);
      setApprovalStatus(payload.entry.approval_status as ChangelogApprovalStatus);
      router.refresh();
    });
  }

  const currentEntryIsEdited = Boolean(currentEntry?.is_user_edited);
  const draftHasChanges =
    currentEntry !== null &&
    (draftTitle !== currentEntry.title ||
      draftBody !== currentEntry.body ||
      approvalStatus !== currentEntry.approval_status);

  return (
    <section className="product-panel" data-testid="changelog-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Changelog</div>
          <h1>Draft a changelog only from approved evidence inside one period.</h1>
          <p className="lede">
            Changelog drafting is fail-closed. You choose the period, confirm the
            evidence, and every draft stays linked to supporting proof.
          </p>
        </div>
        <div className="helper-text">Milestone 6</div>
      </div>

      {errorMessage ? (
        <div className="empty-panel">
          <h2>Changelog drafting is unavailable right now.</h2>
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
                <h2>Choose period</h2>
                <p className="muted small-text">
                  One draft exists per monthly or quarterly period.
                </p>
              </div>
              <Link href="/ledger" className="button button-secondary">
                Open ledger
              </Link>
            </div>

            <div className="editor-stack">
              <label className="field field-grid-compact">
                <span className="field-label">Period type</span>
                <select
                  value={periodType}
                  onChange={(event) => {
                    const nextType =
                      event.currentTarget.value as ResolvedChangelogPeriod["periodType"];
                    setPeriodType(nextType);
                    setPeriodStart((current) => alignPeriodStart(nextType, current));
                  }}
                  disabled={isPending || isSaving}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>

              <label className="field field-grid-compact">
                <span className="field-label">Period start</span>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.currentTarget.value)}
                  disabled={isPending || isSaving}
                />
              </label>

              <div className="button-row">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={loadPeriod}
                  disabled={isPending || isSaving}
                >
                  Load period
                </button>
              </div>

              <div className="empty-panel">
                <h3>Current period</h3>
                <p className="muted small-text">{formatPeriodLabel(period)}</p>
                <p className="muted small-text">
                  Use the first day of the month or quarter.
                </p>
              </div>

              {noticeMessage ? (
                <div className="empty-panel">
                  <p className="muted">{noticeMessage}</p>
                </div>
              ) : null}

              {currentEntry ? (
                <div className="empty-panel">
                  <h3>Current draft</h3>
                  <p className="muted small-text">
                    Status: {currentEntry.approval_status}. Visibility:{" "}
                    {currentEntry.visibility}.
                  </p>
                  <p className="muted small-text">
                    Updated{" "}
                    {new Date(currentEntry.updated_at).toLocaleDateString("en-US")}
                  </p>
                </div>
              ) : (
                <div className="empty-panel">
                  <h3>No draft yet</h3>
                  <p className="muted small-text">
                    Confirm approved evidence for this period first, then generate a
                    changelog draft.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <div className="workspace-main">
            <div className="editor-stack">
              <section className="links-section">
                <div className="section-row">
                  <div>
                    <h2>Confirm approved evidence</h2>
                    <p className="muted small-text">
                      Suggestions help you choose. They do not silently select
                      evidence for you.
                    </p>
                  </div>
                  <div className="helper-text">
                    {selectedEvidenceIds.length} selected
                  </div>
                </div>

                {!generationEnabled ? (
                  <div className="empty-panel">
                    <p className="muted">
                      Changelog generation is unavailable until the OpenAI key or
                      test mode is configured.
                    </p>
                  </div>
                ) : null}

                <div className="evidence-section">
                  <h3>Suggested evidence</h3>
                  {suggestedEvidence.length ? (
                    <ul className="record-list">
                      {suggestedEvidence.map((evidence) => {
                        const selected = selectedEvidenceIds.includes(evidence.id);

                        return (
                          <li key={evidence.id} className="record-card">
                            <label className="selection-card">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleEvidence(evidence.id)}
                                disabled={isPending || isSaving}
                              />
                              <div className="selection-card-body">
                                <div className="record-head">
                                  <strong>{evidence.title}</strong>
                                  <span className="status-pill">
                                    {formatEvidenceType(evidence.type)}
                                  </span>
                                </div>
                                <p className="muted small-text clamp-3">
                                  {evidence.factual_summary ?? "No factual summary yet."}
                                </p>
                                <div className="record-meta record-meta-stack">
                                  <span>{evidence.project_name ?? "No project"}</span>
                                  <span>{evidence.effectiveDate}</span>
                                  <span>{evidence.proof_strength ?? "Proof not set"}</span>
                                </div>
                                <p className="muted small-text">
                                  {evidence.suggestionReason}
                                </p>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="empty-panel">
                      <p className="muted">
                        No approved evidence falls inside this period yet.
                      </p>
                    </div>
                  )}
                </div>

                {additionalEvidence.length ? (
                  <div className="evidence-section">
                    <h3>More approved evidence in this period</h3>
                    <ul className="record-list">
                      {additionalEvidence.map((evidence) => {
                        const selected = selectedEvidenceIds.includes(evidence.id);

                        return (
                          <li key={evidence.id} className="record-card">
                            <label className="selection-card">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleEvidence(evidence.id)}
                                disabled={isPending || isSaving}
                              />
                              <div className="selection-card-body">
                                <div className="record-head">
                                  <strong>{evidence.title}</strong>
                                  <span className="status-pill">
                                    {formatEvidenceType(evidence.type)}
                                  </span>
                                </div>
                                <div className="record-meta record-meta-stack">
                                  <span>{evidence.project_name ?? "No project"}</span>
                                  <span>{evidence.effectiveDate}</span>
                                  <span>
                                    {evidence.source_system === "github"
                                      ? "GitHub"
                                      : "Manual"}
                                  </span>
                                </div>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {currentEntryIsEdited ? (
                  <div className="empty-panel">
                    <h3>Edited draft protection is active</h3>
                    <p className="muted small-text">
                      This period already has user edits. Regeneration is blocked
                      unless you explicitly discard them.
                    </p>
                    <label className="selection-card">
                      <input
                        type="checkbox"
                        checked={replaceEdited}
                        onChange={(event) =>
                          setReplaceEdited(event.currentTarget.checked)
                        }
                        disabled={isPending || isSaving}
                      />
                      <div className="selection-card-body">
                        <strong>Discard my edits and regenerate this draft</strong>
                        <p className="muted small-text">
                          This replaces the current draft text with a new generated
                          version for the same period.
                        </p>
                      </div>
                    </label>
                  </div>
                ) : null}

                {formError ? <p className="error-text">{formError}</p> : null}

                <div className="button-row">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleGenerate}
                    disabled={
                      !generationEnabled ||
                      !selectedEvidenceIds.length ||
                      isPending ||
                      isSaving ||
                      (currentEntryIsEdited && !replaceEdited)
                    }
                  >
                    {isPending
                      ? "Generating..."
                      : currentEntryIsEdited && replaceEdited
                        ? "Discard edits and regenerate"
                        : "Generate changelog draft"}
                  </button>
                </div>
              </section>

              <section className="editor-stack">
                <div className="section-row">
                  <div>
                    <h2>Draft editor</h2>
                    <p className="muted small-text">
                      Title and body edits mark the draft as user edited.
                    </p>
                  </div>
                </div>

                {currentEntry ? (
                  <>
                    <label className="field">
                      <span className="field-label">Title</span>
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.currentTarget.value)}
                        disabled={isSaving}
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Body</span>
                      <textarea
                        rows={14}
                        value={draftBody}
                        onChange={(event) => setDraftBody(event.currentTarget.value)}
                        disabled={isSaving}
                      />
                    </label>

                    <label className="field field-grid-compact">
                      <span className="field-label">Approval state</span>
                      <select
                        value={approvalStatus}
                        onChange={(event) =>
                          setApprovalStatus(
                            event.currentTarget.value as ChangelogApprovalStatus,
                          )
                        }
                        disabled={isSaving}
                      >
                        {changelogApprovalOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {saveError ? <p className="error-text">{saveError}</p> : null}

                    <div className="button-row">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={handleSaveDraft}
                        disabled={!draftHasChanges || isSaving || isPending}
                      >
                        {isSaving ? "Saving..." : "Save changelog draft"}
                      </button>
                    </div>

                    <section className="links-section">
                      <div className="section-row">
                        <div>
                          <h3>Supporting evidence</h3>
                          <p className="muted small-text">
                            The draft stays linked to the evidence you confirmed for
                            this period.
                          </p>
                        </div>
                      </div>

                      <ul className="link-list">
                        {currentEntry.supportingEvidence.map((evidence) => (
                          <li
                            key={`${currentEntry.id}-${evidence.id}`}
                            className="link-card"
                          >
                            <div className="record-head">
                              <strong>{evidence.title}</strong>
                              <span className="status-pill">
                                {formatEvidenceType(evidence.type)}
                              </span>
                            </div>
                            <div className="record-meta record-meta-stack">
                              <span>{evidence.projectName ?? "No project"}</span>
                              <span>
                                {evidence.sourceSystem === "github"
                                  ? "GitHub"
                                  : "Manual"}
                              </span>
                              <span>{evidence.approvalStatus}</span>
                            </div>
                            <Link
                              href={`/ledger?evidence=${evidence.id}` as Route}
                              className="text-link"
                            >
                              Open in ledger
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </>
                ) : (
                  <div className="empty-panel">
                    <p className="muted">
                      No changelog draft exists for this period yet.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
