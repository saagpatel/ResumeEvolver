import { expect, test } from "@playwright/test";

test("authenticated changelog drafting blocks regeneration after edits until discard is explicit", async ({
  page,
}) => {
  const loginResponse = await page.request.post("/api/test-auth/login");
  expect(loginResponse.ok()).toBeTruthy();

  const createEvidenceResponse = await page.request.post("/api/evidence", {
    data: {
      type: "manual_note",
      title: "April platform delivery",
      rawInput:
        "Closed April platform work with approved evidence and a clear delivery summary.",
      projectName: "Platform",
      timeStart: "2026-04-10T16:00:00.000Z",
      timeEnd: "2026-04-10T17:00:00.000Z",
      links: [],
    },
  });
  expect(createEvidenceResponse.ok()).toBeTruthy();
  const createdEvidence = (await createEvidenceResponse.json()) as {
    evidence: { id: string };
  };

  const approveEvidenceResponse = await page.request.post(
    `/api/evidence/${createdEvidence.evidence.id}/approve`,
    {
      data: { decision: "approved_private" },
    },
  );
  expect(approveEvidenceResponse.ok()).toBeTruthy();

  await page.goto("/changelog?periodType=monthly&periodStart=2026-04-01");
  await expect(page).toHaveURL(/\/changelog\?periodType=monthly&periodStart=2026-04-01/);

  await page.getByRole("checkbox", { name: /April platform delivery/i }).check();
  await page.getByRole("button", { name: "Generate changelog draft" }).click();

  const titleField = page.getByLabel("Title");
  await expect(titleField).toHaveValue("Monthly changelog for 2026-04-01");

  await titleField.fill("Edited changelog title");
  await page.getByRole("button", { name: "Save changelog draft" }).click();
  await expect(titleField).toHaveValue("Edited changelog title");

  await expect(
    page.getByRole("button", { name: "Generate changelog draft" }),
  ).toBeDisabled();

  await page
    .getByRole("checkbox", {
      name: /Discard my edits and regenerate this draft/i,
    })
    .check();
  await page
    .getByRole("button", { name: "Discard edits and regenerate" })
    .click();

  await expect(titleField).toHaveValue("Monthly changelog for 2026-04-01");
});
