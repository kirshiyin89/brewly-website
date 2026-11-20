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
└── js/chatbot.js       Placeholder for the future chatbot widget (empty for now)
```

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
