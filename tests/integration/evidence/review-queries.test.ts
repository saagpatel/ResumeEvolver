import { describe, expect, it } from "vitest";
import { listReviewQueueEvidence } from "@/lib/evidence/queries";
import { createFakeSupabase } from "@/tests/fixtures/fake-supabase";
import {
  ledgerEvidenceLinkRows,
  ledgerEvidenceRows,
  ledgerFixtureUserIds,
} from "@/tests/fixtures/ledger-evidence";

describe("review queue queries", () => {
  it("includes reviewable GitHub evidence alongside manual evidence", async () => {
    const supabase = createFakeSupabase({
      evidence_items: ledgerEvidenceRows,
      evidence_links: ledgerEvidenceLinkRows,
    });

    const queue = await listReviewQueueEvidence(
      supabase,
      ledgerFixtureUserIds.owner,
    );

    expect(queue.map((record) => record.type)).toEqual([
      "github_issue",
      "project_link",
      "certification",
      "manual_note",
    ]);
  });
});
