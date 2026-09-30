import { describe, expect, it } from 'vitest';
import { ReaderApiClient, ReaderApiErrorCode, joinApiUrl } from './readerApiClient.js';

const article = Object.freeze({
  title: '春の読書メモ',
  text: '最初の段落です。\n\n最後の段落です。',
  url: 'https://note.com/example_creator/n/n123456789abc',
});

function createFakeTransport() {
  let request;

  return {
    send(options) {
      request = options;
    },
    respond(response) {
      request.onload(response);
    },
    timeout() {
      request.ontimeout();
    },
    fail() {
      request.onerror();
    },
    request() {
      return request;
    },
  };
}

function createClient(transport, baseUrl = 'http://127.0.0.1:8000') {
  return new ReaderApiClient({ baseUrl, transport: transport.send.bind(transport) });
}

describe('ReaderApiClient', () => {
  it('maps an extracted note article to the strict import payload', async () => {
    const transport = createFakeTransport();
    const resultPromise = createClient(transport).importDocument(article);

    expect(transport.request()).toMatchObject({
      method: 'POST',
      url: 'http://127.0.0.1:8000/api/imports',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 10_000,
    });
    expect(JSON.parse(transport.request().data)).toEqual({
      title: '春の読書メモ',
      text: '最初の段落です。\n\n最後の段落です。',
      description: 'https://note.com/example_creator/n/n123456789abc',
      source: 'note.com',
      tags: [{ name: 'note.com', color: '#7C3AED' }],
    });

    transport.respond({ status: 201, responseText: '{"id":"document-1"}' });
    await expect(resultPromise).resolves.toEqual({ ok: true, value: { id: 'document-1' } });
  });

  it.each([
    [422, 'The request body is invalid.'],
    [503, 'The local database is unavailable.'],
  ])('returns the problem detail for an HTTP %i API error', async (status, detail) => {
    const transport = createFakeTransport();
    const resultPromise = createClient(transport).importDocument(article);

    transport.respond({
      status,
      responseText: JSON.stringify({
        type: 'https://example.test/problems/import',
        title: 'Import failed',
        status,
        detail,
      }),
    });

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: {
        code: ReaderApiErrorCode.API_ERROR,
        status,
        title: 'Import failed',
        detail,
      },
    });
  });

  it('returns a stable failure when a 201 response is not a JSON object', async () => {
    const transport = createFakeTransport();
    const resultPromise = createClient(transport).importDocument(article);

    transport.respond({ status: 201, responseText: 'not json' });

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: { code: ReaderApiErrorCode.MALFORMED_SUCCESS_RESPONSE },
    });
  });

  it('returns stable timeout and network failures', async () => {
    const timeoutTransport = createFakeTransport();
    const timeoutResult = createClient(timeoutTransport).importDocument(article);
    timeoutTransport.timeout();

    await expect(timeoutResult).resolves.toEqual({
      ok: false,
      error: { code: ReaderApiErrorCode.TIMEOUT },
    });

    const networkTransport = createFakeTransport();
    const networkResult = createClient(networkTransport).importDocument(article);
    networkTransport.fail();

    await expect(networkResult).resolves.toEqual({
      ok: false,
      error: { code: ReaderApiErrorCode.NETWORK_FAILURE },
    });
  });
});

describe('joinApiUrl', () => {
  it.each([
    ['http://127.0.0.1:8000', '/api/imports', 'http://127.0.0.1:8000/api/imports'],
    ['http://127.0.0.1:8000/', '/api/imports', 'http://127.0.0.1:8000/api/imports'],
    ['http://127.0.0.1:8000/', 'api/imports', 'http://127.0.0.1:8000/api/imports'],
  ])('joins %s and %s without duplicate or missing slashes', (baseUrl, path, expected) => {
    expect(joinApiUrl(baseUrl, path)).toBe(expected);
  });
});
