"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEmptyManualEvidenceDraft,
  toManualEvidencePayload,
  type ManualEvidenceDraft,
} from "@/lib/evidence/drafts";
import type { EvidenceRecordWithLinks } from "@/lib/evidence/queries";
import { ManualEvidenceEditor } from "./manual-evidence-editor";

interface InboxWorkspaceProps {
  recentEvidence: EvidenceRecordWithLinks[];
}

function toReviewHref(evidenceId: string) {
  return `/review?evidence=${evidenceId}` as Route;
}

export function InboxWorkspace({ recentEvidence }: InboxWorkspaceProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ManualEvidenceDraft>(
    createEmptyManualEvidenceDraft(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      setErrorMessage(null);

      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toManualEvidencePayload(draft)),
      });

      const payload = (await response.json()) as {
        error?: string;
        evidence?: EvidenceRecordWithLinks;
      };

      if (!response.ok || !payload.evidence) {
        setErrorMessage(payload.error ?? "Could not save evidence.");
        return;
      }

      setDraft(createEmptyManualEvidenceDraft());
      router.push(toReviewHref(payload.evidence.id));
      router.refresh();
    });
  }

  return (
    <section className="product-panel">
      <div className="page-header">
        <div>
          <div className="eyebrow">Inbox</div>
          <h1>Capture one evidence item at a time.</h1>
          <p className="lede">
            Save raw proof first. Structure and approval happen later in review.
          </p>
        </div>
        <div className="helper-text">Milestone 2</div>
      </div>

      <div className="workspace-grid">
        <div className="workspace-main">
          <ManualEvidenceEditor
            draft={draft}
            onChange={setDraft}
            onSubmit={handleCreate}
            submitLabel="Save evidence"
            pendingLabel="Saving evidence..."
            isSubmitting={isPending}
            errorMessage={errorMessage}
            helperMessage="New manual evidence always starts as unreviewed draft evidence."
          />
        </div>

        <aside className="workspace-sidebar">
          <div className="section-row">
            <div>
              <h2>Recent captures</h2>
              <p className="muted small-text">
                The latest editable evidence items are ready for review.
              </p>
            </div>
          </div>

          {recentEvidence.length ? (
            <ul className="record-list">
              {recentEvidence.map((evidence) => (
                <li key={evidence.id} className="record-card">
                  <div className="record-head">
                    <strong>{evidence.title}</strong>
                    <span className="status-pill">{evidence.type}</span>
                  </div>
                  <p className="muted small-text clamp-3">
                    {evidence.raw_input}
                  </p>
                  <div className="record-meta">
                    <span>
                      {evidence.verification_status} / {evidence.approval_status}
                    </span>
                    <Link
                      href={toReviewHref(evidence.id)}
                      className="text-link"
                    >
                      Open in review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-panel">
              <p className="muted">
                No evidence captured yet. Your first manual note will show up here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
