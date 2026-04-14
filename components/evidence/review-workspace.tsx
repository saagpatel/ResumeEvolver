"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toManualEvidenceDraft,
  toManualEvidencePayload,
  type ManualEvidenceDraft,
} from "@/lib/evidence/drafts";
import type { EvidenceRecordWithLinks } from "@/lib/evidence/queries";
import type { EvidenceApprovalDecision, EvidenceType, ManualEvidenceType } from "@/types/domain";
import { evidenceTypes, manualEvidenceTypes } from "@/types/domain";
import { ManualEvidenceEditor } from "./manual-evidence-editor";

interface ReviewWorkspaceProps {
  queue: EvidenceRecordWithLinks[];
  selectedEvidence: EvidenceRecordWithLinks | null;
  selectedType: EvidenceType | null;
  structuringEnabled: boolean;
}

const reviewTypeLabels: Record<EvidenceType, string> = {
  manual_note: "Manual note",
  github_pr: "GitHub PR",
  github_issue: "GitHub issue",
  github_release: "GitHub release",
  certification: "Certification",
  project_link: "Project link",
  milestone: "Milestone",
};

function isManualReviewableEvidence(
  evidence: EvidenceRecordWithLinks,
): evidence is EvidenceRecordWithLinks & {
  type: ManualEvidenceType;
  source_system: "manual";
} {
  return (
    evidence.source_system === "manual" &&
    manualEvidenceTypes.includes(evidence.type as ManualEvidenceType)
  );
}

function toReviewHref(options?: {
  evidenceId?: string;
  type?: EvidenceType | null;
}) {
  const params = new URLSearchParams();

  if (options?.evidenceId) {
    params.set("evidence", options.evidenceId);
  }

  if (options?.type) {
    params.set("type", options.type);
  }

  return `/review${params.toString() ? `?${params.toString()}` : ""}` as Route;
}

function ReviewActions({
  evidence,
  structuringEnabled,
  isActionPending,
  onApprove,
  onStructure,
}: {
  evidence: EvidenceRecordWithLinks;
  structuringEnabled: boolean;
  isActionPending: boolean;
  onApprove: (decision: EvidenceApprovalDecision) => void;
  onStructure: () => void;
}) {
  return (
    <section className="review-actions">
      <div className="section-row">
        <div>
          <h3>Review actions</h3>
          <p className="muted small-text">
            Approvals are explicit. Structured output never auto-approves.
          </p>
        </div>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={onStructure}
          disabled={!structuringEnabled || isActionPending}
        >
          {structuringEnabled
            ? isActionPending
              ? "Working..."
              : "Structure with AI"
            : "AI structuring unavailable"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onApprove("needs_more_proof")}
          disabled={isActionPending}
        >
          Mark needs more proof
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={() => onApprove("approved_private")}
          disabled={isActionPending}
        >
          Approve private
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onApprove("approved_public_safe")}
          disabled={isActionPending}
        >
          Approve public-safe
        </button>
        {evidence.approval_status === "needs_more_proof" ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onApprove("return_to_draft")}
            disabled={isActionPending}
          >
            Return to draft
          </button>
        ) : null}
        <button
          type="button"
          className="button button-danger"
          onClick={() => onApprove("do_not_use")}
          disabled={isActionPending}
        >
          Do not use
        </button>
      </div>

      <div className="review-summary-grid">
        <article className="placeholder-card">
          <h4>Current state</h4>
          <p className="muted">
            {evidence.verification_status} / {evidence.approval_status}
          </p>
        </article>
        <article className="placeholder-card">
          <h4>Proof strength</h4>
          <p className="muted">{evidence.proof_strength ?? "Not structured yet"}</p>
        </article>
        <article className="placeholder-card">
          <h4>Supporting links</h4>
          <p className="muted">{evidence.links.length}</p>
        </article>
      </div>
    </section>
  );
}

export function ReviewWorkspace({
  queue,
  selectedEvidence,
  selectedType,
  structuringEnabled,
}: ReviewWorkspaceProps) {
  const router = useRouter();

  function updateTypeFilter(value: string) {
    router.push(
      toReviewHref({
        type: value ? (value as EvidenceType) : null,
      }),
    );
  }

  return (
    <section className="product-panel">
      <div className="page-header">
        <div>
          <div className="eyebrow">Review</div>
          <h1>Review evidence before it becomes usable downstream.</h1>
          <p className="lede">
            Manual and imported GitHub evidence both pass through this queue before
            they can be used elsewhere.
          </p>
        </div>
        <div className="helper-text">Milestone 4</div>
      </div>

      <div className="workspace-grid">
        <aside className="workspace-sidebar">
          <div className="field">
            <span className="field-label">Filter by type</span>
            <select
              value={selectedType ?? ""}
              onChange={(event) => updateTypeFilter(event.currentTarget.value)}
            >
              <option value="">All reviewable types</option>
              {evidenceTypes.map((type) => (
                <option key={type} value={type}>
                  {reviewTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>

          {queue.length ? (
            <ul className="record-list">
              {queue.map((evidence) => {
                const isSelected = evidence.id === selectedEvidence?.id;

                return (
                  <li
                    key={evidence.id}
                    className={`record-card ${isSelected ? "record-card-active" : ""}`}
                  >
                    <Link
                      href={toReviewHref({
                        evidenceId: evidence.id,
                        type: selectedType,
                      })}
                    >
                      <div className="record-head">
                        <strong>{evidence.title}</strong>
                        <span className="status-pill">
                          {reviewTypeLabels[evidence.type]}
                        </span>
                      </div>
                      <p className="muted small-text clamp-3">
                        {evidence.factual_summary ?? evidence.raw_input}
                      </p>
                      <div className="record-meta">
                        <span>
                          {evidence.verification_status} / {evidence.approval_status}
                        </span>
                        <span>{evidence.source_system === "github" ? "GitHub" : "Manual"}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-panel">
              <p className="muted">
                Nothing needs review right now. Approved items drop out of this queue.
              </p>
            </div>
          )}
        </aside>

        <div className="workspace-main">
          {selectedEvidence ? (
            <ReviewEditorPane
              key={selectedEvidence.id}
              selectedEvidence={selectedEvidence}
              structuringEnabled={structuringEnabled}
            />
          ) : (
            <div className="empty-panel">
              <h2>No review item selected</h2>
              <p className="muted">
                Capture evidence in Inbox, import from GitHub, or choose an item from
                the queue to start review.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface ReviewEditorPaneProps {
  selectedEvidence: EvidenceRecordWithLinks;
  structuringEnabled: boolean;
}

function ReviewEditorPane({
  selectedEvidence,
  structuringEnabled,
}: ReviewEditorPaneProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ManualEvidenceDraft | null>(
    isManualReviewableEvidence(selectedEvidence)
      ? toManualEvidenceDraft(selectedEvidence)
      : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();

  async function runAction(
    input: RequestInit & { url: string },
    fallbackMessage: string,
  ) {
    const response = await fetch(input.url, {
      ...input,
      headers: {
        "Content-Type": "application/json",
        ...(input.headers ?? {}),
      },
    });
    const payload = (await response.json()) as {
      error?: string;
      evidence?: EvidenceRecordWithLinks;
    };

    if (!response.ok) {
      setErrorMessage(payload.error ?? fallbackMessage);
      return null;
    }

    return payload.evidence ?? null;
  }

  function handleSave() {
    if (!draft) {
      return;
    }

    startSaveTransition(async () => {
      setErrorMessage(null);
      const evidence = await runAction(
        {
          url: `/api/evidence/${selectedEvidence.id}`,
          method: "PATCH",
          body: JSON.stringify(toManualEvidencePayload(draft)),
        },
        "Could not save evidence changes.",
      );

      if (!evidence || !isManualReviewableEvidence(evidence)) {
        return;
      }

      setDraft(toManualEvidenceDraft(evidence));
      router.refresh();
    });
  }

  function handleApproval(decision: EvidenceApprovalDecision) {
    startActionTransition(async () => {
      setErrorMessage(null);
      const evidence = await runAction(
        {
          url: `/api/evidence/${selectedEvidence.id}/approve`,
          method: "POST",
          body: JSON.stringify({ decision }),
        },
        "Could not update approval state.",
      );

      if (!evidence) {
        return;
      }

      router.refresh();
    });
  }

  function handleStructure() {
    if (!structuringEnabled) {
      return;
    }

    startActionTransition(async () => {
      setErrorMessage(null);
      const evidence = await runAction(
        {
          url: `/api/evidence/${selectedEvidence.id}/structure`,
          method: "POST",
          body: JSON.stringify({}),
        },
        "Could not structure evidence.",
      );

      if (!evidence) {
        return;
      }

      if (isManualReviewableEvidence(evidence)) {
        setDraft(toManualEvidenceDraft(evidence));
      }

      router.refresh();
    });
  }

  return (
    <>
      {draft ? (
        <ManualEvidenceEditor
          draft={draft}
          onChange={setDraft}
          onSubmit={handleSave}
          submitLabel="Save edits"
          pendingLabel="Saving edits..."
          isSubmitting={isSaving}
          errorMessage={errorMessage}
          helperMessage={
            selectedEvidence.approval_status === "needs_more_proof"
              ? "This item is waiting for more proof before approval."
              : null
          }
        />
      ) : (
        <section className="editor-stack">
          <div className="section-row">
            <div>
              <h3>Imported source record</h3>
              <p className="muted small-text">
                Imported GitHub evidence stays read-only here. Review, structure, and
                approval still happen in this queue.
              </p>
            </div>
            <span className="status-pill">
              {reviewTypeLabels[selectedEvidence.type]}
            </span>
          </div>

          <div className="review-summary-grid">
            <article className="placeholder-card">
              <h4>Repository</h4>
              <p className="muted">{selectedEvidence.project_name ?? "Unknown repo"}</p>
            </article>
            <article className="placeholder-card">
              <h4>Source system</h4>
              <p className="muted">GitHub</p>
            </article>
            <article className="placeholder-card">
              <h4>Source URL</h4>
              <p className="muted">
                {selectedEvidence.source_url ? (
                  <a
                    href={selectedEvidence.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open on GitHub
                  </a>
                ) : (
                  "Unavailable"
                )}
              </p>
            </article>
          </div>

          <label className="field">
            <span className="field-label">Imported evidence body</span>
            <textarea value={selectedEvidence.raw_input} rows={14} readOnly />
          </label>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </section>
      )}

      <ReviewActions
        evidence={selectedEvidence}
        structuringEnabled={structuringEnabled}
        isActionPending={isActionPending}
        onApprove={handleApproval}
        onStructure={handleStructure}
      />
    </>
  );
}
