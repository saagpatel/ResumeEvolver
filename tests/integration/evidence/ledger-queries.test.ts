import { describe, expect, it } from "vitest";
import { EvidenceError } from "@/lib/evidence/errors";
import {
  getLedgerEvidenceDetail,
  listLedgerEvidence,
  listLedgerProjectNames,
} from "@/lib/evidence/queries";
import { createFakeSupabase } from "@/tests/fixtures/fake-supabase";
import {
  ledgerChangelogEntryEvidenceRows,
  ledgerEvidenceLinkRows,
  ledgerEvidenceRows,
  ledgerFixtureUserIds,
  ledgerResumeBulletEvidenceRows,
} from "@/tests/fixtures/ledger-evidence";

function createLedgerSupabase(errorMap?: Record<string, string>) {
  return createFakeSupabase(
    {
      evidence_items: ledgerEvidenceRows,
      evidence_links: ledgerEvidenceLinkRows,
      resume_bullet_evidence: ledgerResumeBulletEvidenceRows,
      changelog_entry_evidence: ledgerChangelogEntryEvidenceRows,
    },
    errorMap,
  );
}

describe("ledger evidence queries", () => {
  it("lists owned evidence, applies filters, and adds summary counts", async () => {
    const supabase = createLedgerSupabase();

    const records = await listLedgerEvidence(supabase, ledgerFixtureUserIds.owner, {
      project: "ResumeEvolver",
      ledgerStatus: "approved_public_safe",
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000105",
      ledgerStatus: "approved_public_safe",
      linkCount: 1,
      downstreamResumeBulletCount: 1,
      downstreamChangelogCount: 1,
    });
  });

  it("applies date windows using evidence intervals or created_at fallback", async () => {
    const supabase = createLedgerSupabase();

    const records = await listLedgerEvidence(supabase, ledgerFixtureUserIds.owner, {
      from: "2026-04-11",
      to: "2026-04-12",
    });

    expect(records.map((record) => record.id)).toEqual([
      "00000000-0000-0000-0000-000000000103",
      "00000000-0000-0000-0000-000000000102",
    ]);
  });

  it("returns unique sorted project names for owned evidence only", async () => {
    const supabase = createLedgerSupabase();

    const projectNames = await listLedgerProjectNames(
      supabase,
      ledgerFixtureUserIds.owner,
    );

    expect(projectNames).toEqual([
      "Career Site",
      "ResumeEvolver",
      "Support Ops",
    ]);
  });

  it("loads full detail with links and downstream ids", async () => {
    const supabase = createLedgerSupabase();

    const detail = await getLedgerEvidenceDetail(
      supabase,
      ledgerFixtureUserIds.owner,
      "00000000-0000-0000-0000-000000000105",
    );

    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({
      id: "00000000-0000-0000-0000-000000000105",
      ledgerStatus: "approved_public_safe",
      downstreamResumeBulletIds: ["00000000-0000-0000-0000-000000000302"],
      downstreamChangelogIds: ["00000000-0000-0000-0000-000000000401"],
    });
    expect(detail?.links).toEqual([
      {
        label: "Public pull request",
        url: "https://github.com/example/repo/pull/12345",
        linkType: "github",
      },
    ]);
  });

  it("throws a real error when a ledger query fails", async () => {
    const supabase = createLedgerSupabase({
      evidence_items: "db offline",
    });

    await expect(
      listLedgerEvidence(supabase, ledgerFixtureUserIds.owner, {}),
    ).rejects.toMatchObject({
      message: "Could not load ledger evidence.",
      status: 500,
    } satisfies Pick<EvidenceError, "message" | "status">);
  });
});
