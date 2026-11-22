/*
 * Brewly chat widget: a floating launcher and a chat panel.
 *
 * The widget is a custom element with a Shadow DOM, so its styles and markup
 * cannot clash with the site's own classes. It is appended to <body>, outside
 * <main>, so the nightly crawler never indexes it.
 */
import { ChatError, sendMessage } from "./api.js";
import { getConversationId, loadTranscript, resetConversation, saveTranscript } from "./session.js";
import { renderText } from "./render.js";

const TAG_NAME = "brewly-chat";
const MAX_QUESTION_LENGTH = 500;

const WELCOME_TEXT =
  "Hi, I'm the Brewly assistant. Ask me about our coffees, brewing methods, delivery or returns.";

const SUGGESTIONS = [
  "What coffees do you sell?",
  "How long does delivery take?",
  "What is your return policy?",
];

// Static markup only. Visitor and model text is never written into this string.
const MARKUP = `
  <button class="launcher" type="button" aria-expanded="false" aria-controls="panel">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>
    <span>Ask Brewly</span>
  </button>
  <section class="panel" id="panel" role="dialog" aria-labelledby="title" hidden>
    <header class="panel-header">
      <h2 id="title">Brewly assistant</h2>
      <div class="header-actions">
        <button type="button" class="text-button" data-action="reset">New chat</button>
        <button type="button" class="icon-button" data-action="close" aria-label="Close chat">&times;</button>
      </div>
    </header>
    <div class="log" role="log" aria-live="polite"></div>
    <div class="suggestions"></div>
    <form class="composer">
      <label class="visually-hidden" for="question">Your question</label>
      <textarea id="question" rows="1" maxlength="${MAX_QUESTION_LENGTH}"
        placeholder="Ask about coffee, delivery or returns"></textarea>
      <button type="submit" class="send">Send</button>
    </form>
  </section>
`;

const STYLESHEET_PATH = "brewly-chat/widget.css";

class BrewlyChat extends HTMLElement {
  #apiBase = "";
  #cssUrl = "";
  #root = null;
  #messages = [];
  #conversationId = null;
  #busy = false;

  // Elements inside the shadow root.
  #launcher = null;
  #panel = null;
  #log = null;
  #suggestions = null;
  #form = null;
  #input = null;
  #sendButton = null;

  /** Sets the backend base URL and stylesheet URL. Call before adding to the page. */
  configure({ apiBase, cssUrl }) {
    this.#apiBase = apiBase.replace(/\/+$/, "");
    this.#cssUrl = cssUrl;
  }

  connectedCallback() {
    if (this.#root) {
      return;
    }

    this.#root = this.attachShadow({ mode: "open" });

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = this.#cssUrl;

    const template = document.createElement("template");
    template.innerHTML = MARKUP;

    this.#root.append(stylesheet, template.content.cloneNode(true));
    this.#queryElements();
    this.#bindEvents();

    this.#conversationId = getConversationId();
    this.#messages = loadTranscript();
    this.#renderLog();
  }

  #queryElements() {
    const root = this.#root;
    this.#launcher = root.querySelector(".launcher");
    this.#panel = root.querySelector(".panel");
    this.#log = root.querySelector(".log");
    this.#suggestions = root.querySelector(".suggestions");
    this.#form = root.querySelector(".composer");
    this.#input = root.querySelector("#question");
    this.#sendButton = root.querySelector(".send");
  }

  #bindEvents() {
    this.#launcher.addEventListener("click", () => this.#open());

    this.#panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.#close();
      }
    });

    this.#panel.querySelector('[data-action="close"]')
      .addEventListener("click", () => this.#close());

    this.#panel.querySelector('[data-action="reset"]')
      .addEventListener("click", () => this.#resetConversation());

    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#send(this.#input.value);
    });

    this.#input.addEventListener("keydown", (event) => {
      // Enter sends the question. Shift+Enter inserts a new line.
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.#form.requestSubmit();
      }
    });
  }

  #open() {
    this.#panel.hidden = false;
    this.#launcher.hidden = true;
    this.#launcher.setAttribute("aria-expanded", "true");
    this.#scrollLogToEnd();
    this.#input.focus();
  }

  #close() {
    this.#panel.hidden = true;
    this.#launcher.hidden = false;
    this.#launcher.setAttribute("aria-expanded", "false");
    this.#launcher.focus();
  }

  #resetConversation() {
    if (this.#busy) {
      return;
    }

    this.#conversationId = resetConversation();
    this.#messages = [];
    this.#renderLog();
    this.#input.focus();
  }

  async #send(rawText) {
    const question = rawText.trim();

    if (!question || this.#busy) {
      return;
    }

    this.#setBusy(true);
    this.#input.value = "";
    this.#addMessage("user", question);

    const pending = this.#appendBubble("assistant", "Thinking…", ["pending"]);

    try {
      const answer = await sendMessage({
        apiBase: this.#apiBase,
        conversationId: this.#conversationId,
        question,
      });

      pending.remove();
      this.#addMessage("assistant", answer);
    } catch (error) {
      pending.remove();
      // Errors are shown but not saved, so they do not reappear after navigation.
      this.#appendBubble("error", error instanceof ChatError ? error.message : String(error));
    } finally {
      this.#setBusy(false);
      this.#input.focus();
    }
  }

  #setBusy(busy) {
    this.#busy = busy;
    this.#sendButton.disabled = busy;
  }

  #addMessage(role, text) {
    this.#messages.push({ role, text });
    saveTranscript(this.#messages);
    this.#suggestions.replaceChildren();
    return this.#appendBubble(role, text);
  }

  #renderLog() {
    this.#log.replaceChildren();

    if (this.#messages.length === 0) {
      this.#appendBubble("assistant", WELCOME_TEXT);
      this.#renderSuggestions();
    } else {
      this.#suggestions.replaceChildren();
      for (const message of this.#messages) {
        this.#appendBubble(message.role, message.text);
      }
    }

    this.#scrollLogToEnd();
  }

  #renderSuggestions() {
    this.#suggestions.replaceChildren();

    for (const suggestion of SUGGESTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = suggestion;
      button.addEventListener("click", () => this.#send(suggestion));
      this.#suggestions.append(button);
    }
  }

  #appendBubble(role, text, extraClasses = []) {
    const bubble = document.createElement("div");
    bubble.className = ["msg", role, ...extraClasses].join(" ");

    const body = document.createElement("div");
    body.className = "body";

    if (role === "assistant") {
      renderText(body, text);
    } else {
      body.textContent = text;
    }

    bubble.append(body);
    this.#log.append(bubble);
    this.#scrollLogToEnd();
    return bubble;
  }

  #scrollLogToEnd() {
    this.#log.scrollTop = this.#log.scrollHeight;
  }
}

/**
 * Creates the widget and adds it to the page. Does nothing if it already exists.
 *
 * @param {{apiBase: string, cssUrl?: string}} options
 */
export function mountBrewlyChat({ apiBase, cssUrl }) {
  if (document.querySelector(TAG_NAME)) {
    return;
  }

  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, BrewlyChat);
  }

  const widget = document.createElement(TAG_NAME);
  widget.configure({
    apiBase,
    cssUrl: cssUrl || new URL(STYLESHEET_PATH, import.meta.url).href,
  });
  document.body.append(widget);
}
