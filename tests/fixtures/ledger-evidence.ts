import type { Database } from "@/types/database";

type EvidenceRow = Database["public"]["Tables"]["evidence_items"]["Row"];
type EvidenceLinkRow = Database["public"]["Tables"]["evidence_links"]["Row"];
type ResumeBulletEvidenceRow =
  Database["public"]["Tables"]["resume_bullet_evidence"]["Row"];
type ChangelogEntryEvidenceRow =
  Database["public"]["Tables"]["changelog_entry_evidence"]["Row"];

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000999";

function makeEvidenceRow(overrides: Partial<EvidenceRow>): EvidenceRow {
  return {
    id: "00000000-0000-0000-0000-000000000100",
    user_id: ownerUserId,
    type: "manual_note",
    title: "Evidence record",
    raw_input: "Evidence details",
    factual_summary: null,
    time_start: null,
    time_end: null,
    source_system: "manual",
    source_external_id: null,
    source_url: null,
    project_name: null,
    visibility_default: "private",
    proof_strength: null,
    verification_status: "unreviewed",
    approval_status: "draft",
    ai_structured_payload: {},
    metadata: {},
    created_at: "2026-04-10T12:00:00.000Z",
    updated_at: "2026-04-10T12:00:00.000Z",
    ...overrides,
  };
}

export const ledgerFixtureUserIds = {
  owner: ownerUserId,
  other: otherUserId,
} as const;

export const ledgerEvidenceRows: EvidenceRow[] = [
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000101",
    title: "Unreviewed ops note",
    raw_input: "Captured a recurring support issue and the first proof notes.",
    project_name: "Support Ops",
    created_at: "2026-04-10T08:00:00.000Z",
    updated_at: "2026-04-10T08:00:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000102",
    type: "certification",
    title: "Structured certification",
    factual_summary: "Completed and saved the certification evidence.",
    proof_strength: "strong",
    verification_status: "structured",
    approval_status: "draft",
    project_name: "Support Ops",
    time_start: "2026-04-11T10:00:00.000Z",
    time_end: "2026-04-11T11:00:00.000Z",
    created_at: "2026-04-11T11:30:00.000Z",
    updated_at: "2026-04-11T11:30:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000103",
    type: "project_link",
    title: "Needs more proof project link",
    raw_input: "Linked the project repository but still need more public evidence.",
    proof_strength: "moderate",
    verification_status: "structured",
    approval_status: "needs_more_proof",
    project_name: "Career Site",
    time_start: "2026-04-12T14:00:00.000Z",
    time_end: "2026-04-12T15:00:00.000Z",
    created_at: "2026-04-12T15:30:00.000Z",
    updated_at: "2026-04-12T15:30:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000104",
    type: "milestone",
    title: "Approved private milestone",
    raw_input: "Wrapped the internal migration milestone and documented the outcome.",
    factual_summary: "Completed a private milestone with solid internal proof.",
    proof_strength: "strong",
    verification_status: "approved",
    approval_status: "approved_private",
    project_name: "ResumeEvolver",
    created_at: "2026-04-13T09:00:00.000Z",
    updated_at: "2026-04-13T09:00:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000105",
    user_id: ownerUserId,
    type: "github_pr",
    title: "Approved public-safe GitHub PR",
    raw_input: "Merged a public PR with user-visible UI polish.",
    factual_summary: "Public repo PR with explicit, public-safe approval.",
    time_start: "2026-04-14T17:00:00.000Z",
    time_end: "2026-04-14T18:00:00.000Z",
    source_system: "github",
    source_external_id: "12345",
    source_url: "https://github.com/example/repo/pull/12345",
    project_name: "ResumeEvolver",
    visibility_default: "public_safe",
    proof_strength: "moderate",
    verification_status: "approved",
    approval_status: "approved_public_safe",
    created_at: "2026-04-14T18:30:00.000Z",
    updated_at: "2026-04-14T18:30:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000108",
    user_id: ownerUserId,
    type: "github_issue",
    title: "Reviewable imported GitHub issue",
    raw_input: "Imported GitHub issue waiting for review.",
    source_system: "github",
    source_external_id: "67890",
    source_url: "https://github.com/example/repo/issues/67890",
    project_name: "ResumeEvolver",
    created_at: "2026-04-14T19:00:00.000Z",
    updated_at: "2026-04-14T19:00:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000106",
    title: "Rejected draft",
    raw_input: "A weak claim that should not be used downstream.",
    proof_strength: "weak",
    verification_status: "rejected",
    approval_status: "do_not_use",
    project_name: "Support Ops",
    created_at: "2026-04-09T06:00:00.000Z",
    updated_at: "2026-04-09T06:00:00.000Z",
  }),
  makeEvidenceRow({
    id: "00000000-0000-0000-0000-000000000107",
    user_id: otherUserId,
    title: "Other user's evidence",
    project_name: "Other Project",
    created_at: "2026-04-12T08:00:00.000Z",
    updated_at: "2026-04-12T08:00:00.000Z",
  }),
];

export const ledgerEvidenceLinkRows: EvidenceLinkRow[] = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    evidence_item_id: "00000000-0000-0000-0000-000000000102",
    label: "Certification page",
    url: "https://example.com/certification",
    link_type: "cert",
    created_at: "2026-04-11T11:31:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000202",
    evidence_item_id: "00000000-0000-0000-0000-000000000103",
    label: "Project repository",
    url: "https://github.com/example/project",
    link_type: "github",
    created_at: "2026-04-12T15:31:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000203",
    evidence_item_id: "00000000-0000-0000-0000-000000000105",
    label: "Public pull request",
    url: "https://github.com/example/repo/pull/12345",
    link_type: "github",
    created_at: "2026-04-14T18:31:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000204",
    evidence_item_id: "00000000-0000-0000-0000-000000000107",
    label: "Other user link",
    url: "https://example.com/other",
    link_type: "external",
    created_at: "2026-04-12T08:30:00.000Z",
  },
];

export const ledgerResumeBulletEvidenceRows: ResumeBulletEvidenceRow[] = [
  {
    resume_bullet_id: "00000000-0000-0000-0000-000000000301",
    evidence_item_id: "00000000-0000-0000-0000-000000000104",
  },
  {
    resume_bullet_id: "00000000-0000-0000-0000-000000000302",
    evidence_item_id: "00000000-0000-0000-0000-000000000105",
  },
];

export const ledgerChangelogEntryEvidenceRows: ChangelogEntryEvidenceRow[] = [
  {
    changelog_entry_id: "00000000-0000-0000-0000-000000000401",
    evidence_item_id: "00000000-0000-0000-0000-000000000105",
  },
];
