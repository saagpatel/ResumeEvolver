import { expect, test } from "@playwright/test";

test("github import route redirects unauthenticated users to sign-in", async ({
  page,
}) => {
  await page.goto("/github");

  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(page.getByRole("heading", { name: /sign in with github/i })).toBeVisible();
});
