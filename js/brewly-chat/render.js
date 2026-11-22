/*
 * Renders assistant text into a DOM element.
 *
 * Model output is never inserted with innerHTML. Only a small markdown subset
 * is supported: **bold** text, "- " or "* " bullet lists, and line breaks.
 * Everything else is shown as plain text.
 */

const BULLET_PATTERN = /^\s*[-*]\s+(.*)$/;
const BOLD_PATTERN = /(\*\*[^*]+\*\*)/;

/**
 * Replaces the contents of `container` with the rendered `text`.
 *
 * @param {HTMLElement} container
 * @param {string} text
 */
export function renderText(container, text) {
  container.replaceChildren();

  let list = null;
  let paragraph = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const bullet = rawLine.match(BULLET_PATTERN);

    if (bullet) {
      if (!list) {
        list = document.createElement("ul");
        container.append(list);
      }

      const item = document.createElement("li");
      appendInline(item, bullet[1].trim());
      list.append(item);
      paragraph = null;
      continue;
    }

    if (!line) {
      list = null;
      paragraph = null;
      continue;
    }

    if (!paragraph) {
      paragraph = document.createElement("p");
      container.append(paragraph);
      list = null;
    } else {
      paragraph.append(document.createElement("br"));
    }

    appendInline(paragraph, line);
  }
}

function appendInline(parent, text) {
  for (const part of text.split(BOLD_PATTERN)) {
    if (!part) {
      continue;
    }

    if (/^\*\*[^*]+\*\*$/.test(part)) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      parent.append(strong);
    } else {
      parent.append(document.createTextNode(part));
    }
  }
}
