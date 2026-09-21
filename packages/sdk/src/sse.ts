export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

/**
 * Parses a Server-Sent Events stream (https://html.spec.whatwg.org/#event-stream-interpretation).
 * Used instead of `EventSource`, which can't send an Authorization header and
 * isn't available in every Node version.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let data: string[] = [];
  let id: string | undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const end = buffer.search(/\r\n|\r|\n/);
        // A trailing "\r" may be the first half of "\r\n"; wait for the next chunk.
        if (end === -1 || (buffer[end] === '\r' && end === buffer.length - 1)) break;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + (buffer.startsWith('\r\n', end) ? 2 : 1));

        if (line === '') {
          if (data.length > 0) yield { event: event || 'message', data: data.join('\n'), id };
          event = '';
          data = [];
          continue;
        }
        if (line.startsWith(':')) continue;

        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let fieldValue = colon === -1 ? '' : line.slice(colon + 1);
        if (fieldValue.startsWith(' ')) fieldValue = fieldValue.slice(1);

        if (field === 'event') event = fieldValue;
        else if (field === 'data') data.push(fieldValue);
        else if (field === 'id') id = fieldValue;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
