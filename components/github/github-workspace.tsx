"use client";

import { useMemo, useState, useTransition } from "react";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import type {
  GitHubImportCapability,
  GitHubImportSummary,
  GitHubImportType,
} from "@/lib/github/contracts";

interface GitHubWorkspaceProps {
  capability: GitHubImportCapability;
  defaultFrom: string;
  defaultTo: string;
}

const importTypeOptions: Array<{ value: GitHubImportType; label: string }> = [
  { value: "pull_request", label: "Pull requests" },
  { value: "issue", label: "Issues" },
  { value: "release", label: "Releases" },
];

const reconnectReasonLabels: Record<
  Exclude<GitHubImportCapability, { status: "ready" } | { status: "not_linked" }>["reason"],
  string
> = {
  missing_scope: "GitHub identity is linked, but import access has not been connected yet.",
  missing_token: "GitHub import access is missing for this session. Reconnect before importing.",
  expired_token: "GitHub import access expired. Reconnect before importing again.",
};

export function GitHubWorkspace({
  capability,
  defaultFrom,
  defaultTo,
}: GitHubWorkspaceProps) {
  const [repos, setRepos] = useState(["", "", ""]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [types, setTypes] = useState<GitHubImportType[]>(
    importTypeOptions.map((option) => option.value),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<GitHubImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const importReady = capability.status === "ready";

  const normalizedRepos = useMemo(
    () => repos.map((repo) => repo.trim()).filter(Boolean),
    [repos],
  );
  const canImport = importReady && !isPending && normalizedRepos.length > 0;

  function updateRepo(index: number, value: string) {
    setRepos((current) =>
      current.map((repo, currentIndex) => (currentIndex === index ? value : repo)),
    );
  }

  function toggleType(type: GitHubImportType) {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type],
    );
  }

  function handleImport() {
    startTransition(async () => {
      setErrorMessage(null);
      setSummary(null);

      const response = await fetch("/api/evidence/import/github", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repos: normalizedRepos,
          from,
          to,
          types,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        summary?: GitHubImportSummary;
      };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "GitHub import failed.");
        return;
      }

      setSummary(payload.summary ?? null);
    });
  }

  return (
    <section className="product-panel">
      <div className="page-header">
        <div>
          <div className="eyebrow">GitHub import</div>
          <h1>Import bounded public GitHub activity into the evidence ledger.</h1>
          <p className="lede">
            Imports stay repo-scoped, time-window scoped, and always land as draft
            evidence that still needs review.
          </p>
        </div>
        <div className="helper-text">Milestone 4</div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <h2>Connection status</h2>
          {capability.status === "ready" ? (
            <>
              <p className="muted">
                GitHub import access is connected for this session.
              </p>
              <p className="helper-text">
                Granted scopes:{" "}
                {capability.grantedScopes.length
                  ? capability.grantedScopes.join(", ")
                  : "(no explicit scopes)"}
              </p>
            </>
          ) : capability.status === "not_linked" ? (
            <>
              <p className="muted">
                Sign in with GitHub first, then connect import access from here.
              </p>
              <GitHubSignInButton next="/github" label="Sign in with GitHub" />
            </>
          ) : (
            <>
              <p className="muted">{reconnectReasonLabels[capability.reason]}</p>
              <GitHubSignInButton
                next="/github"
                purpose="github-import"
                label="Connect GitHub for import"
                pendingLabel="Redirecting to reconnect..."
              />
            </>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Import rules</h2>
          <ul className="list">
            <li>Public repositories only.</li>
            <li>Choose one to three repositories per import run.</li>
            <li>Windows must stay within 90 days.</li>
            <li>Imported records stay private, draft, and unreviewed by default.</li>
          </ul>
        </article>
      </div>

      <section className="editor-stack">
        <div className="field-grid">
          {repos.map((repo, index) => (
            <label key={`repo-${index}`} className="field">
              <span className="field-label">Repository {index + 1}</span>
              <input
                type="text"
                value={repo}
                onChange={(event) => updateRepo(index, event.currentTarget.value)}
                placeholder="owner/name"
                disabled={!importReady || isPending}
              />
            </label>
          ))}
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.currentTarget.value)}
              disabled={!importReady || isPending}
            />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.currentTarget.value)}
              disabled={!importReady || isPending}
            />
          </label>
        </div>

        <section className="links-section">
          <div className="section-row">
            <div>
              <h3>Import types</h3>
              <p className="muted small-text">
                Choose which public GitHub records should be normalized into
                evidence candidates.
              </p>
            </div>
          </div>

          <div className="button-row">
            {importTypeOptions.map((option) => {
              const selected = types.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={selected ? "button button-primary" : "button button-secondary"}
                  onClick={() => toggleType(option.value)}
                  disabled={!importReady || isPending}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="button-row">
          <button
            type="button"
            className="button button-primary"
            onClick={handleImport}
            disabled={!canImport}
          >
            {isPending ? "Importing..." : "Run GitHub import"}
          </button>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        {summary ? (
          <section className="review-actions">
            <div className="section-row">
              <div>
                <h3>Latest import summary</h3>
                <p className="muted small-text">
                  Status: {summary.status}. Imported records now appear in Review and
                  Ledger.
                </p>
              </div>
            </div>

            <div className="review-summary-grid">
              <article className="placeholder-card">
                <h4>Created</h4>
                <p className="muted">{summary.totals.created}</p>
              </article>
              <article className="placeholder-card">
                <h4>Updated</h4>
                <p className="muted">{summary.totals.updated}</p>
              </article>
              <article className="placeholder-card">
                <h4>Unchanged</h4>
                <p className="muted">{summary.totals.unchanged}</p>
              </article>
              <article className="placeholder-card">
                <h4>Warnings</h4>
                <p className="muted">{summary.warnings.length}</p>
              </article>
            </div>

            <div className="record-list">
              {summary.repos.map((repo) => (
                <article key={repo.repo} className="record-card">
                  <div className="record-head">
                    <strong>{repo.repo}</strong>
                    <span className="status-pill">{repo.status}</span>
                  </div>
                  <div className="record-meta">
                    <span>created {repo.created}</span>
                    <span>updated {repo.updated}</span>
                    <span>unchanged {repo.unchanged}</span>
                    <span>failed {repo.failed}</span>
                  </div>
                  {repo.warnings.length ? (
                    <ul className="list muted small-text">
                      {repo.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </section>
  );
}
