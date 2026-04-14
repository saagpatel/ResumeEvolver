export const evidenceTypes = [
  "manual_note",
  "github_pr",
  "github_issue",
  "github_release",
  "certification",
  "project_link",
  "milestone",
] as const;
export const manualEvidenceTypes = [
  "manual_note",
  "certification",
  "project_link",
  "milestone",
] as const;

export const sourceSystems = ["manual", "github"] as const;
export const visibilityDefaults = ["private", "public_safe"] as const;
export const proofStrengths = ["strong", "moderate", "weak"] as const;
export const verificationStatuses = [
  "unreviewed",
  "structured",
  "approved",
  "rejected",
] as const;
export const approvalStatuses = [
  "draft",
  "approved_private",
  "approved_public_safe",
  "needs_more_proof",
  "do_not_use",
] as const;
export const ledgerStatuses = [
  "draft_unreviewed",
  "draft_structured",
  "needs_more_proof",
  "approved_private",
  "approved_public_safe",
  "do_not_use",
] as const;
export const linkTypes = ["github", "cert", "project", "note", "external"] as const;
export const tagTypes = ["skill", "project", "role_family", "tool", "theme"] as const;
export const claimTypes = [
  "fact_backed",
  "evidence_backed_inference",
  "needs_more_proof",
] as const;
export const periodTypes = ["monthly", "quarterly"] as const;
export const visibilities = ["private", "public_safe"] as const;
export const exportTargetTypes = [
  "resume_bullets",
  "changelog_entry",
  "evidence_snapshot",
] as const;
export const exportFormats = ["markdown", "text", "json"] as const;
export const exportStatuses = ["ready", "failed"] as const;
export const evidenceApprovalDecisions = [
  "approved_private",
  "approved_public_safe",
  "needs_more_proof",
  "do_not_use",
  "return_to_draft",
] as const;

export type EvidenceType = (typeof evidenceTypes)[number];
export type ManualEvidenceType = (typeof manualEvidenceTypes)[number];
export type SourceSystem = (typeof sourceSystems)[number];
export type VisibilityDefault = (typeof visibilityDefaults)[number];
export type ProofStrength = (typeof proofStrengths)[number];
export type VerificationStatus = (typeof verificationStatuses)[number];
export type ApprovalStatus = (typeof approvalStatuses)[number];
export type LedgerStatus = (typeof ledgerStatuses)[number];
export type LinkType = (typeof linkTypes)[number];
export type TagType = (typeof tagTypes)[number];
export type ClaimType = (typeof claimTypes)[number];
export type PeriodType = (typeof periodTypes)[number];
export type Visibility = (typeof visibilities)[number];
export type ExportTargetType = (typeof exportTargetTypes)[number];
export type ExportFormat = (typeof exportFormats)[number];
export type ExportStatus = (typeof exportStatuses)[number];
export type EvidenceApprovalDecision = (typeof evidenceApprovalDecisions)[number];

export interface EvidenceStatePair {
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
}

export interface EvidenceLinkInput {
  label: string;
  url: string;
  linkType: LinkType;
}

export interface ManualEvidenceInput {
  type: ManualEvidenceType;
  title: string;
  rawInput: string;
  projectName: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  links?: EvidenceLinkInput[];
}

export interface EvidenceStructureTagSuggestion {
  tagType: TagType;
  name: string;
}

export interface EvidenceStructurePayload {
  factualSummary: string | null;
  proofStrength: ProofStrength | null;
  suggestedTags: EvidenceStructureTagSuggestion[];
  proofGaps: string[];
  roleRelevance: string[];
}
