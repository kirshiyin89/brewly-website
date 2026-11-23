/*
 * HTTP client for the public Brewly chat endpoint.
 *
 * The request is anonymous: no cookies, no credentials and no CSRF token.
 * Only the backend origin configured for the widget can call it (CORS).
 */

const REQUEST_TIMEOUT_MS = 30000;
// A streamed answer can take longer in total than a single JSON reply, so it gets more time.
const STREAM_TIMEOUT_MS = 60000;

export class ChatError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChatError";
  }
}

/**
 * Thrown when the streaming route cannot be used at all (network error, server error,
 * no stream support). The widget reacts by asking again on the plain JSON route.
 */
export class StreamUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "StreamUnavailableError";
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

/**
 * Sends one question to the streaming route. `onToken` is called with each piece of text
 * as it arrives. Resolves when the server sends its `done` event.
 *
 * The server answers with Server-Sent Events. Each event is a block of "event:" and "data:"
 * lines, separated by a blank line:
 *   event:token  data:{"text":"..."}   one piece of the answer
 *   event:done   data:{"text":""}      the answer is complete
 *   event:error  data:{"text":"..."}   the answer failed; the text is safe to show
 *
 * @param {{apiBase: string, conversationId: string, question: string,
 *          onToken: (text: string) => void}} options
 * @returns {Promise<void>}
 * @throws {ChatError} for a message to show, or {@link StreamUnavailableError} when the
 *         caller should try the JSON route instead
 */
export async function streamMessage({ apiBase, conversationId, question, onToken }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  let reader = null;

  try {
    let response;

    try {
      response = await fetch(`${apiBase}/api/public/brewly/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ conversationId, question }),
        credentials: "omit",
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new ChatError("The assistant is taking too long to reply. Please try again.");
      }
      throw new StreamUnavailableError(error.message);
    }

    if (response.status === 429) {
      throw new ChatError("You are asking questions very quickly. Please wait a minute and try again.");
    }

    if (response.status === 400) {
      throw new ChatError("Please enter a question of up to 500 characters.");
    }

    if (!response.ok || !response.body) {
      throw new StreamUnavailableError(`stream status ${response.status}`);
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const event = parseEventBlock(block);

        if (!event) {
          continue;
        }

        if (event.name === "token") {
          onToken(event.data.text);
        } else if (event.name === "done") {
          return;
        } else if (event.name === "error") {
          throw new ChatError(event.data.text);
        }
      }
    }

    // The server closed the stream without sending "done", so the answer is incomplete.
    throw new ChatError("The answer was cut off. Please try again.");
  } catch (error) {
    if (error instanceof ChatError || error instanceof StreamUnavailableError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new ChatError("The assistant is taking too long to reply. Please try again.");
    }

    throw new ChatError("The connection was interrupted. Please try again.");
  } finally {
    clearTimeout(timer);
    // Closes the connection if we stopped early (for example after an error event).
    reader?.cancel().catch(() => {});
  }
}

/**
 * Parses one SSE block into {name, data}. Returns null for comments and blocks with no data.
 * The data is JSON, so a newline inside the answer text stays inside the JSON string.
 */
function parseEventBlock(block) {
  let name = "message";
  const dataLines = [];

  for (const line of block.split("\n")) {
    if (line.startsWith(":")) {
      continue;
    }

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");

    if (field === "event") {
      name = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return { name, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    throw new ChatError("Sorry, I could not read the reply. Please try again.");
  }
}
