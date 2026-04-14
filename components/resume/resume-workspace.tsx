"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClaimType } from "@/types/domain";
import type { RoleVariantRecord } from "@/lib/roles/queries";
import type {
  ResumeBulletRecord,
  ResumeCandidateEvidence,
} from "@/lib/resume/queries";
import type { ResumeBulletApprovalStatus } from "@/lib/resume/contracts";

interface ResumeWorkspaceProps {
  roleVariants: RoleVariantRecord[];
  selectedRole: RoleVariantRecord | null;
  suggestedEvidence: ResumeCandidateEvidence[];
  fallbackEvidence: ResumeCandidateEvidence[];
  bullets: ResumeBulletRecord[];
  generationEnabled: boolean;
  errorMessage?: string | null;
}

const claimTypeLabels: Record<ClaimType, string> = {
  fact_backed: "Fact-backed",
  evidence_backed_inference: "Evidence-backed inference",
  needs_more_proof: "Needs more proof",
};

const bulletApprovalOptions: Array<{
  value: ResumeBulletApprovalStatus;
  label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "approved_private", label: "Approved private" },
  { value: "approved_public_safe", label: "Approved public-safe" },
  { value: "do_not_use", label: "Do not use" },
];

function toResumeHref(roleId?: string | null) {
  if (!roleId) {
    return "/resume" as Route;
  }

  return `/resume?role=${roleId}` as Route;
}

function formatEvidenceType(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function ResumeBulletCard({
  bullet,
  onSaved,
}: {
  bullet: ResumeBulletRecord;
  onSaved: (bullet: ResumeBulletRecord) => void;
}) {
  const [draftText, setDraftText] = useState(bullet.draft_text);
  const [approvalStatus, setApprovalStatus] = useState<ResumeBulletApprovalStatus>(
    bullet.approval_status as ResumeBulletApprovalStatus,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges =
    draftText !== bullet.draft_text || approvalStatus !== bullet.approval_status;

  function handleSave() {
    if (!hasChanges) {
      return;
    }

    startTransition(async () => {
      setErrorMessage(null);

      const response = await fetch(`/api/resume/bullets/${bullet.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draftText: draftText !== bullet.draft_text ? draftText : undefined,
          approvalStatus:
            approvalStatus !== bullet.approval_status ? approvalStatus : undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        bullet?: ResumeBulletRecord;
      };

      if (!response.ok || !payload.bullet) {
        setErrorMessage(payload.error ?? "Could not update the resume bullet.");
        return;
      }

      onSaved(payload.bullet);
    });
  }

  return (
    <article className="record-card resume-bullet-card">
      <div className="section-row">
        <div>
          <h3>{claimTypeLabels[bullet.claim_type]}</h3>
          <p className="muted small-text">
            Proof strength: {bullet.proof_strength}. Status: {bullet.approval_status}.
          </p>
        </div>
        <div className="record-meta record-meta-stack">
          <span>{bullet.is_user_edited ? "User edited" : "Model draft"}</span>
          <span>
            Updated {new Date(bullet.updated_at).toLocaleDateString("en-US")}
          </span>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Draft bullet</span>
        <textarea
          rows={4}
          value={draftText}
          onChange={(event) => setDraftText(event.currentTarget.value)}
          disabled={isPending}
        />
      </label>

      <label className="field field-grid-compact">
        <span className="field-label">Approval state</span>
        <select
          value={approvalStatus}
          onChange={(event) =>
            setApprovalStatus(event.currentTarget.value as ResumeBulletApprovalStatus)
          }
          disabled={isPending}
        >
          {bulletApprovalOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <div className="button-row">
        <button
          type="button"
          className="button button-primary"
          onClick={handleSave}
          disabled={!hasChanges || isPending}
        >
          {isPending ? "Saving..." : "Save bullet"}
        </button>
      </div>

      <section className="links-section">
        <div className="section-row">
          <div>
            <h4>Supporting evidence</h4>
            <p className="muted small-text">
              Every draft stays linked to approved evidence ids.
            </p>
          </div>
        </div>

        <ul className="link-list">
          {bullet.supportingEvidence.map((evidence) => (
            <li key={`${bullet.id}-${evidence.id}`} className="link-card">
              <div className="record-head">
                <strong>{evidence.title}</strong>
                <span className="status-pill">{formatEvidenceType(evidence.type)}</span>
              </div>
              <div className="record-meta record-meta-stack">
                <span>{evidence.projectName ?? "No project"}</span>
                <span>{evidence.proofStrength ?? "Proof not set"}</span>
                <span>{evidence.sourceSystem === "github" ? "GitHub" : "Manual"}</span>
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
    </article>
  );
}

export function ResumeWorkspace({
  roleVariants,
  selectedRole,
  suggestedEvidence,
  fallbackEvidence,
  bullets,
  generationEnabled,
  errorMessage,
}: ResumeWorkspaceProps) {
  const router = useRouter();
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [currentBullets, setCurrentBullets] = useState(bullets);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleEvidence(id: string) {
    setSelectedEvidenceIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function handleGenerate() {
    if (!selectedRole) {
      return;
    }

    startTransition(async () => {
      setFormError(null);

      const response = await fetch("/api/resume/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleVariantId: selectedRole.id,
          evidenceIds: selectedEvidenceIds,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        bullets?: ResumeBulletRecord[];
      };

      if (!response.ok || !payload.bullets) {
        setFormError(payload.error ?? "Resume drafting failed.");
        return;
      }

      setCurrentBullets(payload.bullets);
      router.refresh();
    });
  }

  function updateBullet(nextBullet: ResumeBulletRecord) {
    setCurrentBullets((current) =>
      current.map((bullet) => (bullet.id === nextBullet.id ? nextBullet : bullet)),
    );
  }

  return (
    <section className="product-panel" data-testid="resume-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Resume</div>
          <h1>Draft resume bullets from approved evidence only.</h1>
          <p className="lede">
            Resume drafting is fail-closed. You confirm the evidence set first, and
            every bullet keeps its provenance.
          </p>
        </div>
        <div className="helper-text">Milestone 5</div>
      </div>

      {errorMessage ? (
        <div className="empty-panel">
          <h2>Resume drafting is unavailable right now.</h2>
          <p className="error-text">{errorMessage}</p>
          <p className="muted">
            This is a real read failure, not an empty state. Retry after the data
            path recovers.
          </p>
        </div>
      ) : !roleVariants.length ? (
        <div className="empty-panel">
          <h2>Create a role variant before drafting bullets.</h2>
          <p className="muted">
            Milestone 5 keeps drafting tied to an explicit saved role context.
          </p>
          <div className="button-row">
            <Link href="/roles" className="button button-primary">
              Create a role variant
            </Link>
          </div>
        </div>
      ) : (
        <div className="workspace-grid">
          <aside className="workspace-sidebar">
            <div className="section-row">
              <div>
                <h2>Role context</h2>
                <p className="muted small-text">
                  Choose the saved role variant that should guide evidence
                  suggestions.
                </p>
              </div>
              <Link href="/roles" className="button button-secondary">
                Edit roles
              </Link>
            </div>

            <ul className="record-list">
              {roleVariants.map((role) => {
                const isSelected = role.id === selectedRole?.id;

                return (
                  <li
                    key={role.id}
                    className={`record-card ${isSelected ? "record-card-active" : ""}`}
                  >
                    <Link href={toResumeHref(role.id)} className="ledger-record-link">
                      <div className="record-head">
                        <strong>{role.name}</strong>
                        <span className="status-pill">Role</span>
                      </div>
                      <p className="muted small-text clamp-3">
                        {role.target_title ??
                          role.notes ??
                          "Saved targeting context ready for evidence confirmation."}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {selectedRole ? (
              <div className="empty-panel">
                <h3>Selected role</h3>
                <p className="muted small-text">
                  {selectedRole.target_title ?? "No target title saved yet."}
                </p>
                <p className="muted small-text clamp-3">
                  {selectedRole.notes ??
                    selectedRole.job_description_raw ??
                    "No extra notes saved yet."}
                </p>
              </div>
            ) : null}
          </aside>

          <div className="workspace-main">
            {selectedRole ? (
              <div className="editor-stack">
                <section className="links-section">
                  <div className="section-row">
                    <div>
                      <h2>Confirm approved evidence</h2>
                      <p className="muted small-text">
                        Suggestions help you choose. They do not silently select
                        evidence for generation.
                      </p>
                    </div>
                    <div className="helper-text">
                      {selectedEvidenceIds.length} selected
                    </div>
                  </div>

                  {!generationEnabled ? (
                    <div className="empty-panel">
                      <p className="muted">
                        Resume generation is unavailable until the OpenAI key or
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
                                  disabled={isPending}
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
                                    <span>
                                      Match score {evidence.matchScore}
                                    </span>
                                    <span>{evidence.proof_strength ?? "Proof not set"}</span>
                                  </div>
                                  {evidence.matchedTerms.length ? (
                                    <p className="muted small-text">
                                      Matched terms: {evidence.matchedTerms.join(", ")}
                                    </p>
                                  ) : null}
                                </div>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="empty-panel">
                        <p className="muted">
                          No strong suggestions yet. You can still confirm from the
                          recent approved fallback list below.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="evidence-section">
                    <h3>Recent approved fallback</h3>
                    {fallbackEvidence.length ? (
                      <ul className="record-list">
                        {fallbackEvidence.map((evidence) => {
                          const selected = selectedEvidenceIds.includes(evidence.id);

                          return (
                            <li key={evidence.id} className="record-card">
                              <label className="selection-card">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleEvidence(evidence.id)}
                                  disabled={isPending}
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
                                    <span>{evidence.source_system === "github" ? "GitHub" : "Manual"}</span>
                                    <span>{evidence.proof_strength ?? "Proof not set"}</span>
                                  </div>
                                </div>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="empty-panel">
                        <p className="muted">
                          No approved evidence is available yet. Approve evidence in
                          Review before drafting resume bullets.
                        </p>
                      </div>
                    )}
                  </div>

                  {formError ? <p className="error-text">{formError}</p> : null}

                  <div className="button-row">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={handleGenerate}
                      disabled={
                        !generationEnabled ||
                        !selectedRole ||
                        !selectedEvidenceIds.length ||
                        isPending
                      }
                    >
                      {isPending ? "Generating..." : "Generate resume bullets"}
                    </button>
                  </div>
                </section>

                <section className="editor-stack">
                  <div className="section-row">
                    <div>
                      <h2>Drafted bullets</h2>
                      <p className="muted small-text">
                        Regeneration replaces untouched drafts and preserves bullets
                        you edited yourself.
                      </p>
                    </div>
                    <div className="helper-text">
                      {currentBullets.length} bullet{currentBullets.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  {currentBullets.length ? (
                    <div className="editor-stack">
                      {currentBullets.map((bullet) => (
                        <ResumeBulletCard
                          key={`${bullet.id}:${bullet.updated_at}`}
                          bullet={bullet}
                          onSaved={updateBullet}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-panel">
                      <p className="muted">
                        No bullets drafted yet. Confirm approved evidence and run
                        generation to create the first set.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="empty-panel">
                <p className="muted">Select a role variant to begin drafting.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
