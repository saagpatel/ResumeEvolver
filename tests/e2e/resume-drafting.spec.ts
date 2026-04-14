import { expect, test } from "@playwright/test";

test("authenticated resume drafting preserves edited bullets on regenerate", async ({
  page,
}) => {
  const loginResponse = await page.request.post("/api/test-auth/login");
  expect(loginResponse.ok()).toBeTruthy();

  const createEvidenceResponse = await page.request.post("/api/evidence", {
    data: {
      type: "manual_note",
      title: "Platform reliability improvements",
      rawInput:
        "Stabilized developer platform APIs and reduced regressions with better test coverage.",
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

  const createRoleResponse = await page.request.post("/api/roles", {
    data: {
      name: "Staff platform engineer",
      targetTitle: "Platform lead",
      jobDescriptionRaw: "Developer platform, reliability, and API quality.",
      notes: "Emphasize backend delivery and trusted execution.",
    },
  });
  expect(createRoleResponse.ok()).toBeTruthy();
  const createdRole = (await createRoleResponse.json()) as {
    role: { id: string };
  };

  await page.goto(`/roles?role=${createdRole.role.id}`);
  await expect(page).toHaveURL(/\/roles\?role=/);
  await expect(page.getByLabel("Role variant name")).toHaveValue(
    "Staff platform engineer",
  );
  await page.getByRole("link", { name: "Open in Resume" }).click();

  await expect(page).toHaveURL(/\/resume\?role=/);
  await page
    .getByRole("checkbox", { name: /Platform reliability improvements/i })
    .first()
    .check();
  await page.getByRole("button", { name: "Generate resume bullets" }).click();

  const firstBullet = page.getByLabel("Draft bullet").first();
  await expect(firstBullet).toHaveValue(/Platform reliability improvements/i);

  await firstBullet.fill(
    "Edited bullet that should survive the next regeneration pass.",
  );
  await page.getByRole("button", { name: "Save bullet" }).first().click();
  await expect(firstBullet).toHaveValue(
    "Edited bullet that should survive the next regeneration pass.",
  );

  await page.getByRole("button", { name: "Generate resume bullets" }).click();
  await expect(firstBullet).toHaveValue(
    "Edited bullet that should survive the next regeneration pass.",
  );
});
