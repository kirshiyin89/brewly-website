# Brewly Coffee – local website

A small, static demo website for the fictional coffee shop **Brewly Coffee** (Budapest, Hungary). It is the test target for the Spring AI crawler in `fintech-ai-assistant`.

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

- It talks to the anonymous endpoint `POST /api/public/brewly/chat` in `fintech-ai-assistant`.
- The conversation continues across pages in the same browser tab (kept in `sessionStorage`). "New chat" starts over.
- Replies are plain text with a small subset of markdown (`**bold**`, `- ` bullet lists). Model output is never inserted as raw HTML.

### Configuration

The backend URL comes from `data-api-base` on the script tag. The default is `http://localhost:8080`:

```html
<script src="js/chatbot.js" data-api-base="https://api.example.com"></script>
```

The backend must allow the website's origin. Set `PUBLIC_CHAT_ALLOWED_ORIGINS` (comma-separated, default `http://localhost:3000`) for the `fintech-ai-assistant` app.

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

The port matters: the crawler in `fintech-ai-assistant` expects the site at `http://localhost:3000`. If you use another port, the crawler configuration must change too.

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

The business is fictional and is for demonstration purposes only.
