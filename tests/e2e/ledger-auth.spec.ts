import { expect, test } from "@playwright/test";

test("ledger route redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/ledger");

  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(page.getByRole("heading", { name: /sign in with github/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in with github/i })).toBeVisible();
});
