import { expect, test } from "@playwright/test";

/**
 * AI-dependent flows, run against a local test double of the Messages API.
 * This verifies the app's request/parse/validate/render path end to end; it
 * does not (and cannot) verify the quality of a real model's answers.
 */
test.describe.configure({ mode: "serial" });

test("setup with recommended defaults", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: /Skip — use recommended settings/ }).click();
  await expect(page).toHaveURL(/diagnostic/);
  await page.goto("/");
  await expect(page.getByText("AI tutor not configured")).toHaveCount(0);
});

test("text conversation with coaching corrections and an end-of-session report", async ({ page }) => {
  await page.goto("/speaking/new?scenario=disc-remote-work");
  await page.getByText("Coaching", { exact: true }).click();
  await page.getByText("Text", { exact: true }).click();
  await page.getByRole("button", { name: "Start the conversation" }).click();
  await expect(page).toHaveURL(/\/speaking\/\d+$/);
  await expect(page.getByText("working from home is overrated")).toBeVisible();
  await page.getByLabel("Your message").fill("It depends from the person, I think. For me it is better because I save time.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I see. And why do you think that?")).toBeVisible();
  // Only the correction that quotes the learner is shown; the invented one is filtered out.
  await expect(page.locator(".inline-correction")).toHaveCount(1);
  await expect(page.locator(".inline-correction")).toContainText("depends on");
  await expect(page.getByText("I goed to the moon")).toHaveCount(0);
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(page.getByText("Think about one advantage and one disadvantage.")).toBeVisible();
  await page.getByRole("button", { name: "End & get feedback" }).click();
  await expect(page.getByRole("heading", { name: "Most important corrections" })).toBeVisible();
  await expect(page.getByText("It depends on the person")).toBeVisible();
  await expect(page.getByText("Totally invented sentence")).toHaveCount(0);
  await page.getByRole("button", { name: "Save expression" }).first().click();
  await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();
  await page.getByLabel("Your answer").fill("For me it's hard to strike a balance, but remote work helps.");
  await page.getByRole("button", { name: "Save my answer" }).click();
  await expect(page.getByText(/You used: strike a balance/)).toBeVisible();
  await page.goto("/mistakes");
  await expect(page.getByText("It depends from the person")).toBeVisible();
});

test("writing feedback distinguishes errors and tracks progress across drafts", async ({ page }) => {
  await page.goto("/writing/new?task=w-schedule-change");
  await page.getByRole("button", { name: "Start writing" }).click();
  await page.getByLabel("Draft 1").fill("Dear Mr Evans, In attachment you find the new programme. The tour on Friday is moved to the afternoon because of a private event at the palace. As an alternative we could visit the old town in the morning. Kind regards, Elena");
  await page.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByRole("heading", { name: "Three priorities for your next draft" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Errors (1)" })).toBeVisible();
  await expect(page.getByText("Please find attached").first()).toBeVisible();
  // The revised version is held back until the learner chooses to see it.
  await expect(page.getByText("Dear client, the revised version.")).toHaveCount(0);
  await page.getByRole("button", { name: "Revise my text" }).click();
  await page.getByLabel("Draft 2").fill("Dear Mr Evans, Please find attached the new programme. The tour on Friday has been moved to the afternoon because of a private event at the palace. As an alternative, we could visit the old town in the morning. Kind regards, Elena");
  await page.getByRole("button", { name: "Get feedback" }).click();
  await expect(page.getByText("You fixed the attachment phrase.")).toBeVisible();
});

test("the tutor can check an open answer that differs from the model", async ({ page }) => {
  await page.goto("/grammar/passive-voice/practice");
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Skip" }).click();
  await page.getByLabel("Your answer").fill("Tomorrow the programme will be announced.");
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Ask the tutor to check" }).click();
  await expect(page.locator(".feedback")).toContainText("The tutor says: correct");
});
