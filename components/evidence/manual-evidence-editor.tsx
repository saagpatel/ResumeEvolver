"use client";

import type { LinkType, ManualEvidenceType } from "@/types/domain";
import {
  createEmptyEvidenceLinkDraft,
  type ManualEvidenceDraft,
} from "@/lib/evidence/drafts";

const manualTypeOptions: Array<{
  value: ManualEvidenceType;
  label: string;
  hint: string;
}> = [
  {
    value: "manual_note",
    label: "Manual note",
    hint: "Fast capture for evidence you want to review later.",
  },
  {
    value: "certification",
    label: "Certification",
    hint: "Credential or course completion with a supporting link.",
  },
  {
    value: "project_link",
    label: "Project link",
    hint: "Project work anchored to a live URL or repository.",
  },
  {
    value: "milestone",
    label: "Milestone",
    hint: "A meaningful outcome, launch, or completed phase.",
  },
];

const linkTypeOptions: Array<{ value: LinkType; label: string }> = [
  { value: "external", label: "External" },
  { value: "project", label: "Project" },
  { value: "github", label: "GitHub" },
  { value: "cert", label: "Certification" },
  { value: "note", label: "Note" },
];

interface ManualEvidenceEditorProps {
  draft: ManualEvidenceDraft;
  disabled?: boolean;
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  helperMessage?: string | null;
  onChange: (draft: ManualEvidenceDraft) => void;
  onSubmit: () => void;
}

function getLinkHint(type: ManualEvidenceType) {
  if (type === "certification") {
    return "Certification evidence needs at least one cert or external link.";
  }

  if (type === "project_link") {
    return "Project-link evidence needs at least one project, external, or GitHub link.";
  }

  return "Links are optional here, but they help future review and traceability.";
}

export function ManualEvidenceEditor({
  draft,
  disabled = false,
  submitLabel,
  pendingLabel,
  isSubmitting,
  errorMessage,
  helperMessage,
  onChange,
  onSubmit,
}: ManualEvidenceEditorProps) {
  function updateDraft<K extends keyof ManualEvidenceDraft>(
    key: K,
    value: ManualEvidenceDraft[K],
  ) {
    onChange({
      ...draft,
      [key]: value,
    });
  }

  function updateLink(
    index: number,
    key: keyof ManualEvidenceDraft["links"][number],
    value: string,
  ) {
    const nextLinks = draft.links.map((link, currentIndex) =>
      currentIndex === index ? { ...link, [key]: value } : link,
    );

    onChange({
      ...draft,
      links: nextLinks,
    });
  }

  function addLink() {
    onChange({
      ...draft,
      links: [...draft.links, createEmptyEvidenceLinkDraft()],
    });
  }

  function removeLink(index: number) {
    onChange({
      ...draft,
      links: draft.links.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  return (
    <section className="editor-stack">
      <div className="field-grid field-grid-compact">
        <label className="field">
          <span className="field-label">Evidence type</span>
          <select
            value={draft.type}
            onChange={(event) =>
              updateDraft("type", event.currentTarget.value as ManualEvidenceType)
            }
            disabled={disabled}
          >
            {manualTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {manualTypeOptions.find((option) => option.value === draft.type)?.hint}
          </span>
        </label>

        <label className="field">
          <span className="field-label">Project name</span>
          <input
            type="text"
            value={draft.projectName}
            onChange={(event) => updateDraft("projectName", event.currentTarget.value)}
            placeholder="Optional project or initiative"
            disabled={disabled}
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Title</span>
        <input
          type="text"
          value={draft.title}
          onChange={(event) => updateDraft("title", event.currentTarget.value)}
          placeholder="Short evidence title"
          disabled={disabled}
        />
      </label>

      <label className="field">
        <span className="field-label">Raw evidence</span>
        <textarea
          value={draft.rawInput}
          onChange={(event) => updateDraft("rawInput", event.currentTarget.value)}
          placeholder="Capture what happened, what you touched, what changed, and what proof exists."
          rows={8}
          disabled={disabled}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Start time</span>
          <input
            type="datetime-local"
            value={draft.timeStart}
            onChange={(event) => updateDraft("timeStart", event.currentTarget.value)}
            disabled={disabled}
          />
        </label>

        <label className="field">
          <span className="field-label">End time</span>
          <input
            type="datetime-local"
            value={draft.timeEnd}
            onChange={(event) => updateDraft("timeEnd", event.currentTarget.value)}
            disabled={disabled}
          />
        </label>
      </div>

      <section className="links-section">
        <div className="section-row">
          <div>
            <h3>Supporting links</h3>
            <p className="muted small-text">{getLinkHint(draft.type)}</p>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={addLink}
            disabled={disabled}
          >
            Add link
          </button>
        </div>

        {draft.links.length ? (
          <div className="link-list">
            {draft.links.map((link, index) => (
              <div key={`${index}-${link.label}-${link.url}`} className="link-card">
                <div className="field-grid">
                  <label className="field">
                    <span className="field-label">Label</span>
                    <input
                      type="text"
                      value={link.label}
                      onChange={(event) =>
                        updateLink(index, "label", event.currentTarget.value)
                      }
                      placeholder="What this link proves"
                      disabled={disabled}
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Link type</span>
                    <select
                      value={link.linkType}
                      onChange={(event) =>
                        updateLink(index, "linkType", event.currentTarget.value)
                      }
                      disabled={disabled}
                    >
                      {linkTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">URL</span>
                  <input
                    type="url"
                    value={link.url}
                    onChange={(event) =>
                      updateLink(index, "url", event.currentTarget.value)
                    }
                    placeholder="https://..."
                    disabled={disabled}
                  />
                </label>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => removeLink(index)}
                  disabled={disabled}
                >
                  Remove link
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <p className="muted">
              No supporting links yet. Add them when you want stronger proof or
              easier review.
            </p>
          </div>
        )}
      </section>

      {helperMessage ? <p className="helper-text">{helperMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <div className="button-row">
        <button
          type="button"
          className="button button-primary"
          onClick={onSubmit}
          disabled={disabled || isSubmitting}
        >
          {isSubmitting ? pendingLabel : submitLabel}
        </button>
      </div>
    </section>
  );
}
