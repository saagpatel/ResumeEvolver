import { describe, expect, it } from "vitest";
import {
  allowedEvidenceStates,
  getApprovalTransition,
  getStructuredStatePair,
  isApprovedEvidence,
  isEditableEvidence,
  isValidEvidenceStatePair,
} from "@/lib/evidence/state-machine";

describe("evidence state machine", () => {
  it("accepts every allowed state pair", () => {
    for (const state of allowedEvidenceStates) {
      expect(
        isValidEvidenceStatePair(
          state.verificationStatus,
          state.approvalStatus,
        ),
      ).toBe(true);
    }
  });

  it("rejects invalid combinations", () => {
    expect(isValidEvidenceStatePair("approved", "draft")).toBe(false);
    expect(isValidEvidenceStatePair("rejected", "approved_private")).toBe(false);
    expect(isValidEvidenceStatePair("unreviewed", "approved_public_safe")).toBe(
      false,
    );
  });

  it("only treats approved evidence as generation-safe", () => {
    expect(isApprovedEvidence("approved", "approved_private")).toBe(true);
    expect(isApprovedEvidence("approved", "approved_public_safe")).toBe(true);
    expect(isApprovedEvidence("structured", "draft")).toBe(false);
  });

  it("only treats reviewable states as editable in Milestone 2", () => {
    expect(isEditableEvidence("unreviewed", "draft")).toBe(true);
    expect(isEditableEvidence("structured", "draft")).toBe(true);
    expect(isEditableEvidence("structured", "needs_more_proof")).toBe(true);
    expect(isEditableEvidence("approved", "approved_private")).toBe(false);
    expect(isEditableEvidence("rejected", "do_not_use")).toBe(false);
  });

  it("moves editable evidence into the correct structured state", () => {
    expect(getStructuredStatePair("unreviewed", "draft")).toEqual({
      verificationStatus: "structured",
      approvalStatus: "draft",
    });
    expect(getStructuredStatePair("structured", "needs_more_proof")).toEqual({
      verificationStatus: "structured",
      approvalStatus: "needs_more_proof",
    });
    expect(getStructuredStatePair("approved", "approved_private")).toBeNull();
  });

  it("maps review decisions onto allowed approval transitions", () => {
    expect(
      getApprovalTransition(
        { verificationStatus: "structured", approvalStatus: "draft" },
        "approved_private",
      ),
    ).toEqual({
      verificationStatus: "approved",
      approvalStatus: "approved_private",
    });
    expect(
      getApprovalTransition(
        { verificationStatus: "structured", approvalStatus: "needs_more_proof" },
        "return_to_draft",
      ),
    ).toEqual({
      verificationStatus: "structured",
      approvalStatus: "draft",
    });
    expect(
      getApprovalTransition(
        { verificationStatus: "approved", approvalStatus: "approved_private" },
        "do_not_use",
      ),
    ).toBeNull();
  });
});
