import { expect, test } from "@playwright/test";

test("authenticated exports and review-cycle reflect saved outputs without new workflow state", async ({
  page,
}) => {
  const loginResponse = await page.request.post("/api/test-auth/login");
  expect(loginResponse.ok()).toBeTruthy();

  const createEvidenceResponse = await page.request.post("/api/evidence", {
    data: {
      type: "manual_note",
      title: "April platform delivery",
      rawInput: "Delivered trusted platform work with approved evidence.",
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
      jobDescriptionRaw: "Platform reliability and delivery.",
      notes: "Focus on trusted execution.",
    },
  });
  expect(createRoleResponse.ok()).toBeTruthy();
  const createdRole = (await createRoleResponse.json()) as {
    role: { id: string };
  };

  const generateResumeResponse = await page.request.post("/api/resume/generate", {
    data: {
      roleVariantId: createdRole.role.id,
      evidenceIds: [createdEvidence.evidence.id],
    },
  });
  expect(generateResumeResponse.ok()).toBeTruthy();
  const generatedResume = (await generateResumeResponse.json()) as {
    bullets: Array<{ id: string }>;
  };

  const approveResumeBulletResponse = await page.request.patch(
    `/api/resume/bullets/${generatedResume.bullets[0]?.id}`,
    {
      data: { approvalStatus: "approved_private" },
    },
  );
  expect(approveResumeBulletResponse.ok()).toBeTruthy();

  const generateMonthlyChangelogResponse = await page.request.post(
    "/api/changelog/generate",
    {
      data: {
        periodType: "monthly",
        periodStart: "2026-04-01",
        evidenceIds: [createdEvidence.evidence.id],
      },
    },
  );
  expect(generateMonthlyChangelogResponse.ok()).toBeTruthy();
  const generatedMonthly = (await generateMonthlyChangelogResponse.json()) as {
    entry: { id: string };
  };

  const approveMonthlyResponse = await page.request.patch(
    `/api/changelog/${generatedMonthly.entry.id}`,
    {
      data: { approvalStatus: "approved_private" },
    },
  );
  expect(approveMonthlyResponse.ok()).toBeTruthy();

  const generateQuarterlyChangelogResponse = await page.request.post(
    "/api/changelog/generate",
    {
      data: {
        periodType: "quarterly",
        periodStart: "2026-04-01",
        evidenceIds: [createdEvidence.evidence.id],
      },
    },
  );
  expect(generateQuarterlyChangelogResponse.ok()).toBeTruthy();
  const generatedQuarterly = (await generateQuarterlyChangelogResponse.json()) as {
    entry: { id: string };
  };

  const approveQuarterlyResponse = await page.request.patch(
    `/api/changelog/${generatedQuarterly.entry.id}`,
    {
      data: { approvalStatus: "approved_private" },
    },
  );
  expect(approveQuarterlyResponse.ok()).toBeTruthy();

  await page.goto("/exports");
  await expect(page.getByTestId("exports-page")).toBeVisible();
  await page.getByRole("button", { name: "Save resume export" }).click();

  await expect(
    page.getByText("Staff platform engineer", { exact: false }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Download resume-bullets-staff-platform-engineer/i }),
  ).toBeVisible();

  await page.goto("/review-cycle");
  await expect(page.getByTestId("review-cycle-page")).toBeVisible();
  await expect(page.getByText("Create fresh exports")).toBeVisible();
  await expect(page.getByText("Staff platform engineer")).toBeVisible();
});
