import { expect, test, type Page } from "@playwright/test";

/** Core learning loop without any AI configured. Tests run in order on one database. */
test.describe.configure({ mode: "serial" });

async function answerGap(page: Page, value: string) {
  await page.getByLabel("Your answer").fill(value);
  await page.getByRole("button", { name: "Check" }).click();
}

test("first visit goes to onboarding; completing it leads to the diagnostic", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("use, not just understand");
  await page.getByLabel(/What should I call you/).fill("Elena");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Save and take the 10-minute diagnostic/ }).click();
  await expect(page).toHaveURL(/\/welcome\/diagnostic/);
});

test("the diagnostic produces a provisional profile", async ({ page }) => {
  await page.goto("/welcome/diagnostic");
  await page.getByRole("button", { name: "Start" }).click();
  // Answer every multiple-choice question with option B (some right, some wrong).
  for (let i = 0; i < 18; i++) await page.getByRole("radio").nth(1).click();
  await page.getByLabel("Your email").fill("Dear Mr Smith, welcome to Genoa! The event starts at nine in the morning at Palazzo Ducale. Could you tell me if you need a taxi from the airport? Best regards, Elena");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your answer").fill("Last month we organised a conference for two hundred doctors. The speakers were great but the lunch was late. Next time I would book a bigger caterer.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "See my results" }).click();
  await expect(page.getByRole("heading", { name: /Starting point: around/ })).toBeVisible();
  await expect(page.getByText("not assessed (AI tutor not configured)")).toBeVisible();
  await page.getByRole("link", { name: "Go to my learning space" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Elena");
  await expect(page.getByText(/Estimated level:/)).toBeVisible();
  await expect(page.getByText("AI tutor not configured")).toBeVisible();
});

test("dashboard shows real (empty) data, never invented statistics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recommendations appear as you practise")).toBeVisible();
  await expect(page.getByText("No conversations yet")).toBeVisible();
  // Minutes this week come from the diagnostic only.
  await expect(page.getByText(/of 150 min goal/)).toBeVisible();
});

test("vocabulary: add a set, review with grading and spaced repetition", async ({ page }) => {
  await page.goto("/vocabulary/sets/opinions");
  await page.getByRole("button", { name: /Add all to my collection/ }).click();
  await expect(page.getByText(/Added 8 expressions/)).toBeVisible();
  await page.goto("/vocabulary/review");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("8 expressions to review");
  // First items are recognition (multiple choice): pick option A.
  await page.getByRole("radio").first().click();
  await expect(page.locator(".feedback")).toBeVisible();
  await page.getByRole("radio", { name: "Easy" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Next review:/)).toBeVisible();
  await page.goto("/vocabulary/collection");
  await expect(page.getByText(/of 8 expressions/)).toBeVisible();
  await page.getByLabel("Search").fill("concerned");
  await expect(page.getByText("1 of 8 expressions")).toBeVisible();
});

test("grammar: wrong answers go to the mistake tracker and can be practised", async ({ page }) => {
  await page.goto("/grammar/prepositions/practice");
  await answerGap(page, "in"); // correct: at
  await expect(page.locator(".feedback")).toContainText("Not quite");
  await page.getByRole("button", { name: "Next" }).click();
  await answerGap(page, "in"); // correct
  await expect(page.locator(".feedback")).toContainText("Correct");
  await page.goto("/mistakes");
  await expect(page.getByText("The gala dinner starts in 8 p.m.")).toBeVisible();
  await page.goto("/mistakes/practice");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("worth fixing");
  await page.getByLabel("Your answer").fill("The gala dinner starts at 8 p.m.");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.locator(".feedback")).toContainText("Correct");
});

test("an open answer can be accepted after comparing (never auto-rejected)", async ({ page }) => {
  await page.goto("/grammar/passive-voice/practice");
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Skip" }).click();
  await page.getByLabel("Your answer").fill("Tomorrow the programme will be announced.");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.locator(".feedback")).toContainText("Compare your answer");
  await expect(page.getByText("AI checking isn't configured")).toBeVisible();
  await page.getByRole("button", { name: "Mine is correct too" }).click();
  await expect(page.locator(".feedback")).toContainText("Accepted as correct");
});

test("writing: autosave, checklist self-review, revision and comparison", async ({ page }) => {
  await page.goto("/writing/new?task=w-informal-invite");
  await page.getByRole("button", { name: "Start writing" }).click();
  await expect(page).toHaveURL(/\/writing\/s\/\d+/);
  const text = "Hi Sam! Can't wait to see you. On Saturday we could either walk to Boccadasse for lunch or take the train to Camogli. Let me know what you fancy!";
  await page.getByLabel("Draft 1").fill(text);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10000 });
  await page.reload();
  await expect(page.getByLabel("Draft 1")).toHaveValue(text);
  await page.getByRole("button", { name: "Review with the checklist" }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByRole("heading", { name: "Your self-review" })).toBeVisible();
  await page.getByRole("button", { name: "Revise my text" }).click();
  await page.getByLabel("Draft 2").fill(text.replace("Can't wait", "I can't wait"));
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: "Draft 1 ✓" }).click();
  await page.goto(page.url().replace(/\?.*$/, "") + "?v=2&compare=1");
  await expect(page.locator("ins.ins").first()).toContainText("I");
  await expect(page.locator("del.del").first()).toContainText("Can't");
});

test("speaking without AI: honest notice, and a fluency drill works", async ({ page }) => {
  await page.goto("/speaking/new?scenario=disc-remote-work");
  await expect(page.getByText("AI conversations aren't configured")).toBeVisible();
  await page.goto("/speaking/fluency/fl-weekend");
  await page.getByRole("button", { name: /Start the timer/ }).click();
  await page.getByLabel(/Or type as you would speak/).fill("Last weekend I went to the beach with my sister and we had a long lunch in Sori. The best part was the swim.");
  await page.getByRole("button", { name: "I've finished" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Repeating the same drill tomorrow/)).toBeVisible();
});

test("today's session ticks off steps from real activity", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start today's session/ }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("list", { name: "Session steps" })).toBeVisible();
  await page.getByLabel(/One thing you learnt/).fill("Depend on, not depend from!");
  await page.getByRole("button", { name: "Finish today's session" }).click();
  await expect(page.getByText("Session complete")).toBeVisible();
});

test("progress reflects recorded activity", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByText("No activity yet")).toHaveCount(0);
  await expect(page.getByText(/minutes of active practice/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Prepositions: time, place and dependent prepositions" })).toBeVisible();
});

test("settings validate input and save", async ({ page }) => {
  await page.goto("/settings");
  const minutes = page.getByLabel("Daily session (minutes)", { exact: true });
  await minutes.fill("5");
  await page.getByRole("button", { name: "Save preferences" }).click();
  // The browser blocks out-of-range values before they reach the server (server validation is unit-tested too).
  expect(await minutes.evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);
  await expect(page.getByText("Your preferences have been saved.")).toHaveCount(0);
  await minutes.fill("20");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Your preferences have been saved.")).toBeVisible();
  await expect(page.getByText("Not configured").first()).toBeVisible();
});

test("keyboard users can skip to content and all main sections load", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  for (const name of ["Learning Path", "Speaking Studio", "Writing Workshop", "Vocabulary Lab", "Grammar Lab", "Real English", "My Progress"]) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("real English unit: comprehension and production complete the unit", async ({ page }) => {
  await page.goto("/real-english/travel-genoa-caruggi");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: /Continue to the text/ }).click();
  await expect(page.getByText(/Original text written for My English Studio/)).toBeVisible();
  await page.getByRole("button", { name: "Comprehension questions" }).click();
  await page.getByRole("radio").first().click();
  await expect(page.locator(".feedback").first()).toContainText("Correct");
  await page.getByRole("button", { name: /7\. Your response/ }).click();
  await page.getByLabel("Your response").fill("You should visit Via Garibaldi early in the morning. It is worth exploring because the palaces are breathtaking and the cafés are quiet.");
  await page.getByRole("button", { name: "Save and finish" }).click();
  await expect(page.getByText("Unit complete")).toBeVisible();
});
