import type {
  ApprovalStatus,
  EvidenceApprovalDecision,
  EvidenceStatePair,
  LedgerStatus,
  VerificationStatus,
} from "@/types/domain";

export const allowedEvidenceStates: readonly EvidenceStatePair[] = [
  { verificationStatus: "unreviewed", approvalStatus: "draft" },
  { verificationStatus: "structured", approvalStatus: "draft" },
  { verificationStatus: "structured", approvalStatus: "needs_more_proof" },
  { verificationStatus: "approved", approvalStatus: "approved_private" },
  { verificationStatus: "approved", approvalStatus: "approved_public_safe" },
  { verificationStatus: "rejected", approvalStatus: "do_not_use" },
] as const;

const allowedStateKeys = new Set(
  allowedEvidenceStates.map(
    ({ verificationStatus, approvalStatus }) =>
      `${verificationStatus}:${approvalStatus}`,
  ),
);

export function isValidEvidenceStatePair(
  verificationStatus: VerificationStatus,
  approvalStatus: ApprovalStatus,
) {
  return allowedStateKeys.has(`${verificationStatus}:${approvalStatus}`);
}

export function isApprovedEvidence(
  verificationStatus: VerificationStatus,
  approvalStatus: ApprovalStatus,
) {
  return (
    verificationStatus === "approved" &&
    (approvalStatus === "approved_private" ||
      approvalStatus === "approved_public_safe")
  );
}

export function getLedgerStatus(
  verificationStatus: VerificationStatus,
  approvalStatus: ApprovalStatus,
): LedgerStatus | null {
  const stateKey = `${verificationStatus}:${approvalStatus}`;

  switch (stateKey) {
    case "unreviewed:draft":
      return "draft_unreviewed";
    case "structured:draft":
      return "draft_structured";
    case "structured:needs_more_proof":
      return "needs_more_proof";
    case "approved:approved_private":
      return "approved_private";
    case "approved:approved_public_safe":
      return "approved_public_safe";
    case "rejected:do_not_use":
      return "do_not_use";
    default:
      return null;
  }
}

export function isEditableEvidence(
  verificationStatus: VerificationStatus,
  approvalStatus: ApprovalStatus,
) {
  return (
    (verificationStatus === "unreviewed" && approvalStatus === "draft") ||
    (verificationStatus === "structured" && approvalStatus === "draft") ||
    (verificationStatus === "structured" && approvalStatus === "needs_more_proof")
  );
}

export function getStructuredStatePair(
  verificationStatus: VerificationStatus,
  approvalStatus: ApprovalStatus,
): EvidenceStatePair | null {
  if (verificationStatus === "unreviewed" && approvalStatus === "draft") {
    return { verificationStatus: "structured", approvalStatus: "draft" };
  }

  if (verificationStatus === "structured" && isEditableEvidence(verificationStatus, approvalStatus)) {
    return { verificationStatus: "structured", approvalStatus };
  }

  return null;
}

export function getApprovalTransition(
  current: EvidenceStatePair,
  decision: EvidenceApprovalDecision,
): EvidenceStatePair | null {
  const currentKey = `${current.verificationStatus}:${current.approvalStatus}`;

  switch (currentKey) {
    case "unreviewed:draft":
      if (decision === "approved_private") {
        return { verificationStatus: "approved", approvalStatus: "approved_private" };
      }
      if (decision === "approved_public_safe") {
        return {
          verificationStatus: "approved",
          approvalStatus: "approved_public_safe",
        };
      }
      if (decision === "needs_more_proof") {
        return { verificationStatus: "structured", approvalStatus: "needs_more_proof" };
      }
      if (decision === "do_not_use") {
        return { verificationStatus: "rejected", approvalStatus: "do_not_use" };
      }
      return null;
    case "structured:draft":
      if (decision === "approved_private") {
        return { verificationStatus: "approved", approvalStatus: "approved_private" };
      }
      if (decision === "approved_public_safe") {
        return {
          verificationStatus: "approved",
          approvalStatus: "approved_public_safe",
        };
      }
      if (decision === "needs_more_proof") {
        return { verificationStatus: "structured", approvalStatus: "needs_more_proof" };
      }
      if (decision === "do_not_use") {
        return { verificationStatus: "rejected", approvalStatus: "do_not_use" };
      }
      return null;
    case "structured:needs_more_proof":
      if (decision === "return_to_draft") {
        return { verificationStatus: "structured", approvalStatus: "draft" };
      }
      if (decision === "approved_private") {
        return { verificationStatus: "approved", approvalStatus: "approved_private" };
      }
      if (decision === "approved_public_safe") {
        return {
          verificationStatus: "approved",
          approvalStatus: "approved_public_safe",
        };
      }
      if (decision === "do_not_use") {
        return { verificationStatus: "rejected", approvalStatus: "do_not_use" };
      }
      return null;
    default:
      return null;
  }
}
