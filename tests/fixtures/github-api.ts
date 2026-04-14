import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
} from "@/lib/github/client";

export const githubFixtureRepository: GitHubRepository = {
  id: 1001,
  full_name: "openai/resume-evolver-demo",
  private: false,
  html_url: "https://github.com/openai/resume-evolver-demo",
};

export const githubFixturePullRequests: GitHubPullRequest[] = [
  {
    id: 2001,
    number: 14,
    title: "Polish review queue copy",
    body: "Tightened the review queue copy for imported evidence.",
    html_url: "https://github.com/openai/resume-evolver-demo/pull/14",
    state: "closed",
    draft: false,
    merged_at: "2026-04-10T18:00:00.000Z",
    closed_at: "2026-04-10T18:00:00.000Z",
    created_at: "2026-04-09T16:00:00.000Z",
    user: { login: "octocat" },
  },
];

export const githubFixtureIssues: GitHubIssue[] = [
  {
    id: 3001,
    number: 22,
    title: "Tighten import summary layout",
    body: "Import summary cards need better warning copy.",
    html_url: "https://github.com/openai/resume-evolver-demo/issues/22",
    state: "closed",
    closed_at: "2026-04-11T10:00:00.000Z",
    created_at: "2026-04-10T10:00:00.000Z",
    user: { login: "hubot" },
  },
  {
    id: 3002,
    number: 23,
    title: "Issue API row that is actually a pull request",
    body: "Should be filtered from the issue importer.",
    html_url: "https://github.com/openai/resume-evolver-demo/issues/23",
    state: "closed",
    closed_at: "2026-04-11T12:00:00.000Z",
    created_at: "2026-04-10T12:00:00.000Z",
    user: { login: "hubot" },
    pull_request: {
      url: "https://api.github.com/repos/openai/resume-evolver-demo/pulls/23",
    },
  },
];

export const githubFixtureReleases: GitHubRelease[] = [
  {
    id: 4001,
    tag_name: "v0.3.0",
    name: "Ledger release",
    body: "Shipped the private evidence ledger milestone.",
    html_url: "https://github.com/openai/resume-evolver-demo/releases/tag/v0.3.0",
    draft: false,
    prerelease: false,
    created_at: "2026-04-08T08:00:00.000Z",
    published_at: "2026-04-12T08:00:00.000Z",
    author: { login: "octocat" },
  },
];
