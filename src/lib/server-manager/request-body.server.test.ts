import { describe, expect, it } from 'vitest';
import { readRequestText, RequestBodyTooLargeError } from './request-body.server';

describe('readRequestText', () => {
  it('reads UTF-8 request bodies within the byte limit', async () => {
    const request = new Request('https://example.test', { method: 'POST', body: 'server' });
    await expect(readRequestText(request, 6)).resolves.toBe('server');
  });

  it('rejects a body that exceeds the byte limit', async () => {
    const request = new Request('https://example.test', { method: 'POST', body: 'server' });
    await expect(readRequestText(request, 5)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it('counts UTF-8 bytes rather than JavaScript characters', async () => {
    const request = new Request('https://example.test', { method: 'POST', body: 'é' });
    await expect(readRequestText(request, 1)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
