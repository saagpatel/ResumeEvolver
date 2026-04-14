export interface ProductRoute {
  href:
    | "/dashboard"
    | "/inbox"
    | "/review"
    | "/ledger"
    | "/github"
    | "/resume"
    | "/changelog"
    | "/roles"
    | "/exports"
    | "/review-cycle";
  label: string;
  summary: string;
  milestone: string;
}

export const productRoutes: ProductRoute[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    summary: "Workflow overview and product status.",
    milestone: "Milestone 1",
  },
  {
    href: "/inbox",
    label: "Inbox",
    summary: "Fast evidence capture.",
    milestone: "Milestone 2",
  },
  {
    href: "/review",
    label: "Review",
    summary: "Structured evidence review and approval.",
    milestone: "Milestone 2",
  },
  {
    href: "/ledger",
    label: "Ledger",
    summary: "Searchable evidence source of truth.",
    milestone: "Milestone 3",
  },
  {
    href: "/github",
    label: "GitHub",
    summary: "Bounded public-repo import and reconnect state.",
    milestone: "Milestone 4",
  },
  {
    href: "/resume",
    label: "Resume",
    summary: "Role-targeted bullet drafting.",
    milestone: "Milestone 5",
  },
  {
    href: "/changelog",
    label: "Changelog",
    summary: "Monthly and quarterly drafting.",
    milestone: "Milestone 6",
  },
  {
    href: "/roles",
    label: "Roles",
    summary: "Saved role-targeting contexts.",
    milestone: "Milestone 5",
  },
  {
    href: "/exports",
    label: "Exports",
    summary: "Saved private export snapshots and history.",
    milestone: "Milestone 7",
  },
  {
    href: "/review-cycle",
    label: "Review Cycle",
    summary: "Read-only month and quarter guidance.",
    milestone: "Milestone 7",
  },
];
