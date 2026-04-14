import "server-only";

const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_ACCEPT_HEADER = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";
const MAX_GITHUB_PAGES = 10;

export interface GitHubViewerContext {
  login: string;
  grantedScopes: string[];
}

export interface GitHubRepository {
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  draft: boolean;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  user: {
    login: string;
  } | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  closed_at: string | null;
  created_at: string;
  user: {
    login: string;
  } | null;
  pull_request?: {
    url: string;
  };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: {
    login: string;
  } | null;
}

export class GitHubApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

interface GitHubResponse<T> {
  data: T;
  headers: Headers;
}

function parseGrantedScopes(headerValue: string | null) {
  return (headerValue ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function getNextPageNumber(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const nextMatch = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>; rel="next"/);
  return nextMatch ? Number(nextMatch[1]) : null;
}

async function fetchGitHubJson<T>(
  token: string,
  path: string,
  hasRetried = false,
): Promise<GitHubResponse<T>> {
  const response = await fetch(`${GITHUB_API_ROOT}${path}`, {
    headers: {
      Accept: GITHUB_ACCEPT_HEADER,
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "ResumeEvolver",
    },
    cache: "no-store",
  });

  if (
    !response.ok &&
    !hasRetried &&
    [502, 503, 504].includes(response.status)
  ) {
    return fetchGitHubJson(token, path, true);
  }

  if (!response.ok) {
    throw new GitHubApiError(
      `GitHub request failed with status ${response.status}.`,
      response.status,
    );
  }

  return {
    data: (await response.json()) as T,
    headers: response.headers,
  };
}

async function listPaginated<T>(
  token: string,
  path: string,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let nextPage: number | null = 1;
  let truncated = false;

  for (let pageCount = 0; nextPage && pageCount < MAX_GITHUB_PAGES; pageCount += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const { data, headers } = await fetchGitHubJson<T[]>(
      token,
      `${path}${separator}per_page=100&page=${nextPage}`,
    );

    items.push(...data);
    nextPage = getNextPageNumber(headers.get("link"));
  }

  if (nextPage) {
    truncated = true;
  }

  return { items, truncated };
}

export async function getGitHubViewer(token: string): Promise<GitHubViewerContext> {
  const { data, headers } = await fetchGitHubJson<{ login: string }>(token, "/user");

  return {
    login: data.login,
    grantedScopes: parseGrantedScopes(headers.get("x-oauth-scopes")),
  };
}

export async function getGitHubRepository(
  token: string,
  repoFullName: string,
): Promise<GitHubRepository> {
  const { data } = await fetchGitHubJson<GitHubRepository>(
    token,
    `/repos/${repoFullName}`,
  );

  return data;
}

export async function listGitHubPullRequests(
  token: string,
  repoFullName: string,
) {
  return listPaginated<GitHubPullRequest>(
    token,
    `/repos/${repoFullName}/pulls?state=all&sort=updated&direction=desc`,
  );
}

export async function listGitHubIssues(token: string, repoFullName: string) {
  return listPaginated<GitHubIssue>(
    token,
    `/repos/${repoFullName}/issues?state=all&sort=updated&direction=desc`,
  );
}

export async function listGitHubReleases(token: string, repoFullName: string) {
  return listPaginated<GitHubRelease>(token, `/repos/${repoFullName}/releases`);
}
