"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RoleVariantRecord } from "@/lib/roles/queries";

interface RoleDraft {
  name: string;
  targetTitle: string;
  jobDescriptionRaw: string;
  notes: string;
}

interface RolesWorkspaceProps {
  roleVariants: RoleVariantRecord[];
  selectedRole: RoleVariantRecord | null;
  errorMessage?: string | null;
}

function createEmptyRoleDraft(): RoleDraft {
  return {
    name: "",
    targetTitle: "",
    jobDescriptionRaw: "",
    notes: "",
  };
}

function toRoleDraft(role: RoleVariantRecord | null): RoleDraft {
  if (!role) {
    return createEmptyRoleDraft();
  }

  return {
    name: role.name,
    targetTitle: role.target_title ?? "",
    jobDescriptionRaw: role.job_description_raw ?? "",
    notes: role.notes ?? "",
  };
}

function toRolesHref(roleId?: string | null) {
  if (!roleId) {
    return "/roles" as Route;
  }

  return `/roles?role=${roleId}` as Route;
}

export function RolesWorkspace({
  roleVariants,
  selectedRole,
  errorMessage,
}: RolesWorkspaceProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<RoleDraft>(() => toRoleDraft(selectedRole));
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof RoleDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function beginNewRole() {
    setDraft(createEmptyRoleDraft());
    setIsCreatingNew(true);
    setFormError(null);
  }

  function handleSave() {
    startTransition(async () => {
      setFormError(null);

      const response = await fetch(
        isCreatingNew || !selectedRole
          ? "/api/roles"
          : `/api/roles/${selectedRole.id}`,
        {
          method: isCreatingNew || !selectedRole ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        role?: RoleVariantRecord;
      };

      if (!response.ok || !payload.role) {
        setFormError(payload.error ?? "Could not save the role variant.");
        return;
      }

      setIsCreatingNew(false);

      if (isCreatingNew || !selectedRole) {
        router.push(toRolesHref(payload.role.id));
        return;
      }

      router.refresh();
    });
  }

  return (
    <section className="product-panel" data-testid="roles-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Roles</div>
          <h1>Save role context before you draft anything downstream.</h1>
          <p className="lede">
            Roles are lightweight targeting contexts. They help ResumeEvolver
            suggest approved evidence, but they do not silently pick evidence for
            you.
          </p>
        </div>
        <div className="helper-text">Milestone 5</div>
      </div>

      {errorMessage ? (
        <div className="empty-panel">
          <h2>Roles are unavailable right now.</h2>
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
                <h2>Saved role variants</h2>
                <p className="muted small-text">
                  Create a role context first, then use it in Resume drafting.
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={beginNewRole}
                disabled={isPending}
              >
                New role
              </button>
            </div>

            {roleVariants.length ? (
              <ul className="record-list">
                {roleVariants.map((role) => {
                  const isSelected = !isCreatingNew && role.id === selectedRole?.id;

                  return (
                    <li
                      key={role.id}
                      className={`record-card ${isSelected ? "record-card-active" : ""}`}
                    >
                      <Link href={toRolesHref(role.id)} className="ledger-record-link">
                        <div className="record-head">
                          <strong>{role.name}</strong>
                          <span className="status-pill">Role</span>
                        </div>
                        <p className="muted small-text clamp-3">
                          {role.target_title ??
                            role.notes ??
                            "Saved targeting context ready for downstream drafting."}
                        </p>
                        <div className="record-meta record-meta-stack">
                          <span>{role.target_title ?? "No target title yet"}</span>
                          <span>
                            Updated {new Date(role.updated_at).toLocaleDateString("en-US")}
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
                  No role variants yet. Start with one saved target role, title, or
                  job description.
                </p>
              </div>
            )}
          </aside>

          <div className="workspace-main">
            <section className="editor-stack">
              <div className="section-row">
                <div>
                  <h2>{isCreatingNew || !selectedRole ? "Create role variant" : "Edit role variant"}</h2>
                  <p className="muted small-text">
                    Keep this lightweight. Tags stay out of scope in Milestone 5.
                  </p>
                </div>
                {selectedRole && !isCreatingNew ? (
                  <Link
                    href={`/resume?role=${selectedRole.id}` as Route}
                    className="button button-secondary"
                  >
                    Open in Resume
                  </Link>
                ) : null}
              </div>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">Role variant name</span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) => updateField("name", event.currentTarget.value)}
                    placeholder="Senior product engineer"
                    disabled={isPending}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Target title</span>
                  <input
                    type="text"
                    value={draft.targetTitle}
                    onChange={(event) =>
                      updateField("targetTitle", event.currentTarget.value)
                    }
                    placeholder="Staff engineer, developer platform"
                    disabled={isPending}
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Job description notes</span>
                <textarea
                  rows={8}
                  value={draft.jobDescriptionRaw}
                  onChange={(event) =>
                    updateField("jobDescriptionRaw", event.currentTarget.value)
                  }
                  placeholder="Paste the parts of the role description that matter."
                  disabled={isPending}
                />
              </label>

              <label className="field">
                <span className="field-label">Your notes</span>
                <textarea
                  rows={6}
                  value={draft.notes}
                  onChange={(event) => updateField("notes", event.currentTarget.value)}
                  placeholder="Capture emphasis, scope, constraints, or interview context."
                  disabled={isPending}
                />
              </label>

              {formError ? <p className="error-text">{formError}</p> : null}

              <div className="button-row">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  {isPending
                    ? "Saving..."
                    : isCreatingNew || !selectedRole
                      ? "Save role variant"
                      : "Update role variant"}
                </button>
                {isCreatingNew ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      setDraft(toRoleDraft(selectedRole));
                      setIsCreatingNew(false);
                      setFormError(null);
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
