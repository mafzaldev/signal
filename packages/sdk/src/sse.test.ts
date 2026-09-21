import { describe, expect, it } from 'vitest';
import { parseSse, type SseMessage } from './sse.js';

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[]) {
  const messages: SseMessage[] = [];
  for await (const message of parseSse(streamOf(chunks))) messages.push(message);
  return messages;
}

describe('parseSse', () => {
  it('parses events with types, ids and data', async () => {
    expect(await collect(['event: put\nid: 1\ndata: {"a":1}\n\n'])).toEqual([
      { event: 'put', id: '1', data: '{"a":1}' },
    ]);
  });

  it('defaults the event type to "message"', async () => {
    expect(await collect(['data: hi\n\n'])).toEqual([{ event: 'message', data: 'hi' }]);
  });

  it('joins multi-line data with new lines', async () => {
    expect((await collect(['data: a\ndata: b\n\n']))[0]?.data).toBe('a\nb');
  });

  it('handles events split across chunks, including inside "\\r\\n"', async () => {
    const messages = await collect(['event: pa', 'tch\r', '\ndata: {"x"', ':1}\r\n\r', '\n']);
    expect(messages).toEqual([{ event: 'patch', data: '{"x":1}' }]);
  });

  it('ignores comments and events without data', async () => {
    expect(await collect([': keep-alive\n\nevent: empty\n\ndata: ok\n\n'])).toEqual([
      { event: 'message', data: 'ok' },
    ]);
  });

  it('drops an unterminated final event', async () => {
    expect(await collect(['data: complete\n\ndata: partial'])).toHaveLength(1);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('data: ü\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7));
        controller.enqueue(bytes.slice(7));
        controller.close();
      },
    });
    const messages: SseMessage[] = [];
    for await (const message of parseSse(stream)) messages.push(message);
    expect(messages[0]?.data).toBe('ü');
  });
});
