/*
 * Conversation state for the chat widget, kept in sessionStorage.
 *
 * sessionStorage survives page navigation within the same tab, so the
 * conversation continues across the static pages. It is cleared when the tab
 * closes. Every storage call is wrapped, because some browsers block storage.
 */

const CONVERSATION_KEY = "brewly-chat:conversation-id";
const TRANSCRIPT_KEY = "brewly-chat:transcript";
const MAX_STORED_MESSAGES = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readItem(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage is unavailable. The chat still works for this page view.
  }
}

function removeItem(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

function newUuid() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for browsers without randomUUID (for example, older Safari).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Returns the current conversation id, creating one if needed. */
export function getConversationId() {
  const stored = readItem(CONVERSATION_KEY);

  if (stored && UUID_PATTERN.test(stored)) {
    return stored;
  }

  const id = newUuid();
  writeItem(CONVERSATION_KEY, id);
  return id;
}

/** Returns the saved messages as [{role: "user" | "assistant", text: string}]. */
export function loadTranscript() {
  const raw = readItem(TRANSCRIPT_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredMessage) : [];
  } catch {
    return [];
  }
}

export function saveTranscript(messages) {
  writeItem(TRANSCRIPT_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
}

/** Clears the saved messages and starts a new conversation id. */
export function resetConversation() {
  removeItem(TRANSCRIPT_KEY);
  const id = newUuid();
  writeItem(CONVERSATION_KEY, id);
  return id;
}

function isStoredMessage(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.text === "string"
  );
}
