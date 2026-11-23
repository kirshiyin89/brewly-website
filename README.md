# Brewly Coffee – local website

A small, static demo website for the fictional coffee shop **Brewly Coffee** (Budapest, Hungary). It is the test target for the Spring AI crawler in `ai-assistant`.

The site is plain HTML, CSS and vanilla JavaScript. It has no build step and no dependencies.

## Structure

```
brewly-website/
├── index.html          Home
├── products.html       Coffees (espresso and filter)
├── brewing-guide.html  Espresso and filter recipes
├── shipping.html       Delivery area, time and costs
├── returns.html        Return policy
├── faq.html            Frequently asked questions
├── css/style.css       Styles
└── js/
    ├── chatbot.js      Loader for the chat widget (included on every page)
    └── brewly-chat/    Chat widget modules (api, session, render, widget, widget.css)
```

## Chat widget

Every page has a floating **Ask Brewly** button. It opens a chat panel that answers questions about public Brewly information (coffees, brewing, delivery, returns). Visitors do not need to log in.

The widget is loaded by the existing `<script src="js/chatbot.js">` tag at the end of each page, so pages need no changes to show it.

- It talks to the anonymous endpoint `POST /api/public/brewly/chat` in `ai-assistant`.
- The conversation continues across pages in the same browser tab (kept in `sessionStorage`). "New chat" starts over.
- Replies are plain text with a small subset of markdown (`**bold**`, `- ` bullet lists). Model output is never inserted as raw HTML.

### Configuration

The backend URL comes from `data-api-base` on the script tag. The default is `http://localhost:8080`:

```html
<script src="js/chatbot.js" data-api-base="https://api.example.com"></script>
```

The backend must allow the website's origin. Set `PUBLIC_CHAT_ALLOWED_ORIGINS` (comma-separated, default `http://localhost:3000`) for the `ai-assistant` app.

Requests are rate-limited per client IP (`app.public-chat.max-requests-per-minute`, default 10). If the site is behind a reverse proxy, the backend must be configured to read the real client address, or all visitors will share one limit.

## Requirements

- Python 3 (any recent version). No other tools are needed.

## Start the site

From this folder, run:

```bash
python3 -m http.server 3000
```

Then open <http://localhost:3000> in your browser.

Stop the server with `Ctrl+C`.

The port matters: the crawler in `ai-assistant` expects the site at `http://localhost:3000`. If you use another port, the crawler configuration must change too.

## Check that it works

With the server running, each page should return HTTP 200:

```bash
for p in index.html products.html brewing-guide.html shipping.html returns.html faq.html; do
  printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/$p"
done
```

## Notes for crawling

- Every page has a `<title>`, a `<meta name="description">` and a `<meta name="category">` tag.
- Page content is inside `<main>`. Header, footer and navigation are outside it, so the crawler can skip them.
- Pages link to each other with normal `<a href>` links, so a crawler can discover all six pages from `index.html`.

## Business facts used on the site

These facts are used consistently across all pages and should stay in sync with the Brewly content in the Spring app:

- Location: Budapest, Hungary
- Coffee types: espresso and filter
- Delivery: within Hungary only, 2–3 business days
- Free delivery for orders above 15,000 HUF
- Unopened packages can be returned within 14 days
- Customer support: support@brewly-coffee.example, +36 1 555 0123, Kávé utca 12, 1051 Budapest (fictional; `contact.html`)
- Support opening hours: Monday to Friday 09:00–17:00, closed at weekends

The business is fictional and is for demonstration purposes only.

## Browser tests for the chat widget

The tests in `e2e/` open the real pages in Chromium and check the chat widget
(`js/brewly-chat/`). The backend is replaced by stubs, so the tests do not need
the Spring Boot app, a database or a Groq key.

```bash
npm install            # once: installs Playwright
npx playwright install chromium   # once: downloads the browser
npm run test:e2e       # runs all tests; a static server starts on port 3000
npm run test:e2e:ui    # the same tests in Playwright's interactive UI
npx playwright show-report   # open the HTML report of the last run
```

Run a single test by part of its title (`-g`), or by file and line:

```bash
npm run test:e2e -- -g "New chat clears the transcript"
npx playwright test e2e/chat-widget.spec.js:243
npx playwright test -g "welcome message" --headed   # watch the browser
```

Screenshots are off by default. To save one for every test, use the `test:e2e:shots`
script (or set `SCREENSHOTS=1`). The images go to `test-results/`:

```bash
npm run test:e2e:shots
npm run test:e2e:shots -- -g "welcome message"   # one test, with screenshots
```

Playwright starts `python3 -m http.server 3000` itself. If port 3000 is already
used by another server, the tests reuse it, so stop that server first if the
pages look wrong.

## Live tests (real backend, not run by default)

The suite in `e2e-live/` calls the real `ai-assistant` backend and the real model. It
checks that the bot answers and stays on topic, with loose text checks, because the
wording changes between runs. It costs a little Groq usage, so run it by hand only.

What it runs:
- two API checks that send a question straight to `POST /api/public/brewly/chat`;
- one browser check that types a question into the widget and waits for a real answer.

To run it:

```bash
# 1. In the ai-assistant folder, start the backend with .env loaded.
cd ../ai-assistant
set -a && . ./.env && set +a
mvn spring-boot:run

# 2. In another terminal, run the live tests.
cd ../brewly-website
npm run test:live
```

The backend must be on `http://localhost:8080`, with the Brewly tenant's public chat
enabled and the site's origin in `PUBLIC_CHAT_ALLOWED_ORIGINS` (default
`http://localhost:3000`). To use another address, set `LIVE_API_BASE`:
`LIVE_API_BASE=http://localhost:9090 npm run test:live`.

If a live test fails because the answer wording changed, check the answer first. Only
relax the regular expression if the answer is still correct.
