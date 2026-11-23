/*
 * Renders assistant text into a DOM element.
 *
 * Model output is never inserted with innerHTML. Only a small markdown subset
 * is supported: **bold** text, "- " bullet lists, "1. " numbered lists, "#" headings,
 * pipe tables and line breaks. Everything else is shown as plain text.
 */

const BULLET_PATTERN = /^\s*[-*]\s+(.*)$/;
const NUMBERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const BOLD_PATTERN = /(\*\*[^*]+\*\*)/;

/**
 * Replaces the contents of `container` with the rendered `text`.
 *
 * @param {HTMLElement} container
 * @param {string} text
 */
export function renderText(container, text) {
  container.replaceChildren();

  const lines = text.split("\n");
  // The list or paragraph that the next lines may continue. Other blocks close them.
  let openList = null;
  let openParagraph = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (isTableStart(lines, index)) {
      const table = readTable(lines, index);
      container.append(table.element);
      openList = null;
      openParagraph = null;
      index = table.lastLine;
      continue;
    }

    const heading = rawLine.match(HEADING_PATTERN);
    if (heading) {
      const title = document.createElement("p");
      title.className = "heading";
      appendInline(title, heading[1]);
      container.append(title);
      openList = null;
      openParagraph = null;
      continue;
    }

    const bullet = rawLine.match(BULLET_PATTERN);
    const numbered = rawLine.match(NUMBERED_PATTERN);
    if (bullet || numbered) {
      const listType = bullet ? "ul" : "ol";
      if (!openList || openList.tagName !== listType.toUpperCase()) {
        openList = document.createElement(listType);
        container.append(openList);
      }

      const item = document.createElement("li");
      appendInline(item, (bullet ?? numbered)[1].trim());
      openList.append(item);
      openParagraph = null;
      continue;
    }

    if (!line) {
      openList = null;
      openParagraph = null;
      continue;
    }

    if (!openParagraph) {
      openParagraph = document.createElement("p");
      container.append(openParagraph);
      openList = null;
    } else {
      openParagraph.append(document.createElement("br"));
    }

    appendInline(openParagraph, line);
  }
}

/**
 * A table starts with a row that has pipes, followed by a separator row such as |---|---|.
 * The separator check runs on the next line only, so a partly streamed table still shows
 * its header as soon as the separator arrives.
 */
function isTableStart(lines, index) {
  return index + 1 < lines.length
    && lines[index].includes("|")
    && lines[index + 1].includes("|")
    && TABLE_SEPARATOR_PATTERN.test(lines[index + 1]);
}

/**
 * Builds a table from the header line at `start`. Body rows are the pipe lines after the
 * separator. Each row keeps the header's column count: extra cells are dropped and missing
 * cells are left empty.
 */
function readTable(lines, start) {
  const headers = splitRow(lines[start]);

  const table = document.createElement("table");
  const headRow = table.createTHead().insertRow();
  for (const header of headers) {
    const cell = document.createElement("th");
    appendInline(cell, header);
    headRow.append(cell);
  }

  const body = table.createTBody();
  let lastLine = start + 1; // the separator row

  for (let index = start + 2; index < lines.length; index += 1) {
    if (!lines[index].includes("|")) {
      break;
    }

    const cells = splitRow(lines[index]);
    const row = body.insertRow();
    for (let column = 0; column < headers.length; column += 1) {
      const cell = row.insertCell();
      appendInline(cell, cells[column] ?? "");
    }
    lastLine = index;
  }

  // A wrapper lets a wide table scroll sideways inside the chat bubble.
  const element = document.createElement("div");
  element.className = "table-wrap";
  element.append(table);
  return { element, lastLine };
}

/** Splits "| a | b |" into ["a", "b"]. Leading and trailing pipes are optional. */
function splitRow(line) {
  let trimmed = line.trim();

  if (trimmed.startsWith("|")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith("|")) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed.split("|").map((cell) => cell.trim());
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
