// Browser tests for the Brewly chat widget (js/brewly-chat/).
//
// The backend is replaced by stubs: page.route() answers the widget's POST to
// /api/public/brewly/chat. The tests never call Groq or the real ai-assistant.
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const CHAT_ENDPOINT = "**/api/public/brewly/chat";

// The widget is on the page as <brewly-chat> with a Shadow DOM. Playwright's CSS
// locators pierce open shadow roots, so plain selectors work inside the widget.
const widget = (page) => page.locator("brewly-chat");
const launcher = (page) => page.locator("brewly-chat .launcher");
const panel = (page) => page.locator("brewly-chat .panel");
const input = (page) => page.locator("brewly-chat #question");
const sendButton = (page) => page.locator("brewly-chat .send");

// Replies with the given answer text, the same JSON shape as the real endpoint.
function answer(text) {
  return (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ answer: text }),
  });
}

// Replies with an error status, with the same CORS header a real response has.
function failWith(status) {
  return (route) => route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ error: "stub" }),
  });
}

// Records each request body sent to the chat endpoint and answers it with `reply`.
async function stubChat(page, reply = answer("Stub answer.")) {
  const requests = [];
  await page.route(CHAT_ENDPOINT, async (route) => {
    requests.push(route.request().postDataJSON());
    await reply(route);
  });
  return requests;
}

async function openWidget(page) {
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
}

async function ask(page, question) {
  await input(page).fill(question);
  await sendButton(page).click();
}

test.beforeEach(async ({ page }) => {
  // Safety net: any call to the backend that a test did not stub is blocked.
  // Stubs registered later in a test take precedence over this one.
  await page.route("**/api/**", (route) => route.abort("blockedbyclient"));
});

test.describe("widget on the website", () => {
  test("appears on every page of the site", async ({ page }) => {
    const siteRoot = path.join(__dirname, "..");
    const pages = fs.readdirSync(siteRoot).filter((name) => name.endsWith(".html"));
    expect(pages.length).toBeGreaterThan(0);

    for (const name of pages) {
      await page.goto(`/${name}`);
      await expect(widget(page), `widget missing on ${name}`).toHaveCount(1);
      await expect(launcher(page), `launcher missing on ${name}`).toBeVisible();
    }
  });

  test("opens with the launcher and closes with Escape", async ({ page }) => {
    await page.goto("/index.html");
    await expect(panel(page)).toBeHidden();

    await openWidget(page);
    await expect(launcher(page)).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(launcher(page)).toBeVisible();
    await expect(launcher(page)).toBeFocused();
  });

  test("shows the welcome message and suggestions", async ({ page }) => {
    await page.goto("/index.html");
    await openWidget(page);

    await expect(page.locator("brewly-chat .msg.assistant").first())
      .toContainText("Hi, I'm the Brewly assistant");
    await expect(page.locator("brewly-chat .suggestions button")).toHaveCount(3);
  });
});

test.describe("sending questions", () => {
  test("sends the question and shows the formatted answer", async ({ page }) => {
    const requests = await stubChat(
      page,
      answer("**Espresso** is our house blend.\n- Filter: available\n- Beans: whole or ground"),
    );
    await page.goto("/products.html");
    await openWidget(page);

    await ask(page, "What coffees do you sell?");

    const reply = page.locator("brewly-chat .msg.assistant").last();
    await expect(reply.locator("strong")).toHaveText("Espresso");
    await expect(reply.locator("li")).toHaveCount(2);
    await expect(reply.locator("li").first()).toHaveText("Filter: available");

    expect(requests).toHaveLength(1);
    expect(requests[0].question).toBe("What coffees do you sell?");
    expect(requests[0].conversationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("a suggestion button sends its question", async ({ page }) => {
    const requests = await stubChat(page);
    await page.goto("/index.html");
    await openWidget(page);

    await page.locator("brewly-chat .suggestions button", {
      hasText: "How long does delivery take?",
    }).click();

    await expect(page.locator("brewly-chat .msg.user")).toHaveText("How long does delivery take?");
    await expect(page.locator("brewly-chat .suggestions button")).toHaveCount(0);
    expect(requests[0].question).toBe("How long does delivery take?");
  });

  test("disables Send and shows a placeholder while waiting", async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route(CHAT_ENDPOINT, async (route) => {
      await gate;
      await answer("Done.")(route);
    });
    await page.goto("/index.html");
    await openWidget(page);

    await ask(page, "Do you deliver?");

    await expect(sendButton(page)).toBeDisabled();
    await expect(page.locator("brewly-chat .msg.pending")).toContainText("Thinking");

    release();
    await expect(sendButton(page)).toBeEnabled();
    await expect(page.locator("brewly-chat .msg.pending")).toHaveCount(0);
  });

  test("Enter sends the question and Shift+Enter adds a new line", async ({ page }) => {
    const requests = await stubChat(page);
    await page.goto("/index.html");
    await openWidget(page);

    await input(page).fill("First line");
    await page.keyboard.press("Shift+Enter");
    await input(page).pressSequentially("second line");
    expect(requests).toHaveLength(0);

    await page.keyboard.press("Enter");
    await expect(page.locator("brewly-chat .msg.user")).toContainText("second line");
    expect(requests[0].question).toBe("First line\nsecond line");
  });

  test("the input stops at 500 characters", async ({ page }) => {
    await page.goto("/index.html");
    await openWidget(page);

    await input(page).pressSequentially("x".repeat(510));

    await expect(input(page)).toHaveValue("x".repeat(500));
  });
});

test.describe("error messages", () => {
  const cases = [
    { name: "rate limit (429)", reply: failWith(429), text: "asking questions very quickly" },
    { name: "question rejected (400)", reply: failWith(400), text: "up to 500 characters" },
    { name: "server error (500)", reply: failWith(500), text: "something went wrong" },
    {
      name: "no network",
      reply: (route) => route.abort("connectionrefused"),
      text: "can't reach the assistant",
    },
  ];

  for (const { name, reply, text } of cases) {
    test(`shows a friendly message for ${name}`, async ({ page }) => {
      await stubChat(page, reply);
      await page.goto("/index.html");
      await openWidget(page);

      await ask(page, "Hello?");

      await expect(page.locator("brewly-chat .msg.error")).toContainText(text);
    });
  }

  test("an error is not kept when the visitor moves to another page", async ({ page }) => {
    await stubChat(page, failWith(500));
    await page.goto("/index.html");
    await openWidget(page);
    await ask(page, "Hello?");
    await expect(page.locator("brewly-chat .msg.error")).toHaveCount(1);

    await page.goto("/products.html");
    await openWidget(page);

    await expect(page.locator("brewly-chat .msg.error")).toHaveCount(0);
  });
});

test.describe("conversation memory", () => {
  test("the conversation continues on another page", async ({ page }) => {
    const requests = await stubChat(page, answer("We ship within Hungary."));
    await page.goto("/index.html");
    await openWidget(page);
    await ask(page, "Where do you ship?");
    await expect(page.locator("brewly-chat .msg.assistant").last())
      .toContainText("We ship within Hungary.");

    await page.goto("/shipping.html");
    await openWidget(page);

    await expect(page.locator("brewly-chat .msg.user")).toHaveText("Where do you ship?");
    await expect(page.locator("brewly-chat .msg.assistant").last())
      .toContainText("We ship within Hungary.");

    await ask(page, "And how long?");
    await expect(page.locator("brewly-chat .msg.user")).toHaveCount(2);

    // Both questions belong to the same conversation id.
    expect(requests).toHaveLength(2);
    expect(requests[1].conversationId).toBe(requests[0].conversationId);
  });

  test("New chat clears the transcript and starts a new conversation", async ({ page }) => {
    const requests = await stubChat(page);
    await page.goto("/index.html");
    await openWidget(page);
    await ask(page, "First question");
    await expect(page.locator("brewly-chat .msg.user")).toHaveCount(1);

    await page.locator('brewly-chat [data-action="reset"]').click();

    await expect(page.locator("brewly-chat .msg.user")).toHaveCount(0);
    await expect(page.locator("brewly-chat .msg.assistant").first())
      .toContainText("Hi, I'm the Brewly assistant");

    await ask(page, "Second question");
    await expect(page.locator("brewly-chat .msg.user")).toHaveCount(1);
    expect(requests[1].conversationId).not.toBe(requests[0].conversationId);
  });
});
