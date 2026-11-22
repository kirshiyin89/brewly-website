/*
 * HTTP client for the public Brewly chat endpoint.
 *
 * The request is anonymous: no cookies, no credentials and no CSRF token.
 * Only the backend origin configured for the widget can call it (CORS).
 */

const REQUEST_TIMEOUT_MS = 30000;

export class ChatError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChatError";
  }
}

/**
 * Sends one question and resolves with the assistant's answer text.
 *
 * @param {{apiBase: string, conversationId: string, question: string}} options
 * @returns {Promise<string>}
 * @throws {ChatError} with a message that is safe to show to the visitor
 */
export async function sendMessage({ apiBase, conversationId, question }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBase}/api/public/brewly/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, question }),
      credentials: "omit",
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new ChatError("You are asking questions very quickly. Please wait a minute and try again.");
    }

    if (response.status === 400) {
      throw new ChatError("Please enter a question of up to 500 characters.");
    }

    if (!response.ok) {
      throw new ChatError("Sorry, something went wrong. Please try again.");
    }

    const data = await response.json();

    if (typeof data.answer !== "string") {
      throw new ChatError("Sorry, I could not read the reply. Please try again.");
    }

    return data.answer;
  } catch (error) {
    if (error instanceof ChatError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new ChatError("The assistant is taking too long to reply. Please try again.");
    }

    throw new ChatError("I can't reach the assistant right now. Please try again later.");
  } finally {
    clearTimeout(timer);
  }
}
