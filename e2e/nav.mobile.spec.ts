import { expect, test } from "@playwright/test";

test("mobile navigation opens, navigates and closes", async ({ page }) => {
  await page.goto("/grammar");
  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Vocabulary Lab" }).click();
  await expect(page).toHaveURL(/\/vocabulary$/);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  // No horizontal scrolling on phone widths.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
