// Live tests: these talk to the REAL ai-assistant backend and the real model.
// Answers vary from run to run, so the checks are loose on purpose: they test that the
// bot answers and stays on topic, not the exact wording.
//
// Start the backend first (see README, "Live tests"). Override the address with
// LIVE_API_BASE if it is not on http://localhost:8080.
const { test, expect } = require("@playwright/test");

const API_BASE = (process.env.LIVE_API_BASE || "http://localhost:8080").replace(/\/+$/, "");
const CHAT_PATH = "/api/public/brewly/chat";

// Sends one question straight to the backend, the same request the widget makes.
async function askBackend(request, question, conversationId = crypto.randomUUID()) {
  const response = await request.post(`${API_BASE}${CHAT_PATH}`, {
    data: { conversationId, question },
  });
  expect(response.status(), "backend should answer with HTTP 200").toBe(200);
  const body = await response.json();
  expect(typeof body.answer).toBe("string");
  return body.answer;
}

test("the backend answers a delivery question on topic", async ({ request }) => {
  const answer = await askBackend(request, "How long does delivery take?");

  expect(answer.trim().length).toBeGreaterThan(20);
  expect(answer).toMatch(/deliver|days?|shipping/i);
});

test("the backend answers a coffee question about the products", async ({ request }) => {
  const answer = await askBackend(request, "What coffees do you sell?");

  expect(answer).toMatch(/coffee|espresso|filter|bean/i);
});

test("the widget shows a real answer from the backend", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("brewly-chat .launcher").click();

  const question = page.locator("brewly-chat #question");
  await question.fill("What is your return policy?");
  await page.locator("brewly-chat .send").click();

  const reply = page.locator("brewly-chat .msg.assistant").last();
  // Wait until the pending bubble is gone and a real answer is in place.
  await expect(page.locator("brewly-chat .msg.pending")).toHaveCount(0, { timeout: 90000 });
  await expect(reply).not.toContainText("Thinking");
  await expect(page.locator("brewly-chat .msg.error")).toHaveCount(0);
  await expect(reply).toContainText(/return|days|policy|refund|unopened/i);
});
