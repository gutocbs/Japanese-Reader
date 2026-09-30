import { READER_API_CONFIG } from './config.js';

export const ReaderApiErrorCode = Object.freeze({
  API_ERROR: 'API_ERROR',
  MALFORMED_SUCCESS_RESPONSE: 'MALFORMED_SUCCESS_RESPONSE',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  NETWORK_FAILURE: 'NETWORK_FAILURE',
  TIMEOUT: 'TIMEOUT',
  TRANSPORT_EXCEPTION: 'TRANSPORT_EXCEPTION',
  TRANSPORT_UNAVAILABLE: 'TRANSPORT_UNAVAILABLE',
});

export class ReaderApiClient {
  constructor({
    baseUrl = READER_API_CONFIG.baseUrl,
    transport = globalThis.GM_xmlhttpRequest,
  } = {}) {
    this.baseUrl = baseUrl;
    this.transport = transport;
  }

  importDocument(input) {
    return new Promise((resolve) => {
      if (typeof this.transport !== 'function') {
        resolve(failure(ReaderApiErrorCode.TRANSPORT_UNAVAILABLE));
        return;
      }

      try {
        const request = {
          method: 'POST',
          url: joinApiUrl(this.baseUrl, READER_API_CONFIG.endpointPath),
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          data: JSON.stringify({
            title: input.title,
            text: input.text,
            description: input.url,
            source: READER_API_CONFIG.source,
            tags: [READER_API_CONFIG.tag],
          }),
          timeout: READER_API_CONFIG.timeoutMs,
          onload: (response) => resolve(toResult(response)),
          onerror: () => resolve(failure(ReaderApiErrorCode.NETWORK_FAILURE)),
          ontimeout: () => resolve(failure(ReaderApiErrorCode.TIMEOUT)),
        };
        this.transport(request);
      } catch {
        resolve(failure(ReaderApiErrorCode.TRANSPORT_EXCEPTION));
      }
    });
  }
}

export function joinApiUrl(baseUrl, endpointPath) {
  return `${baseUrl.replace(/\/+$/, '')}/${endpointPath.replace(/^\/+/, '')}`;
}

function toResult(response) {
  try {
    if (!isResponseEnvelope(response)) {
      return failure(ReaderApiErrorCode.MALFORMED_RESPONSE);
    }

    if (response.status === 201) {
      const value = parseJsonObject(response.responseText);
      return value === null
        ? failure(ReaderApiErrorCode.MALFORMED_SUCCESS_RESPONSE)
        : { ok: true, value };
    }

    const problem = parseJsonObject(response.responseText);
    return {
      ok: false,
      error: {
        code: ReaderApiErrorCode.API_ERROR,
        status: response.status,
        title: typeof problem?.title === 'string' ? problem.title : 'Import failed',
        detail: typeof problem?.detail === 'string' ? problem.detail : 'The import request failed.',
      },
    };
  } catch {
    return failure(ReaderApiErrorCode.MALFORMED_RESPONSE);
  }
}

function isResponseEnvelope(response) {
  return response !== null && typeof response === 'object' && typeof response.status === 'number';
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function failure(code) {
  return { ok: false, error: { code } };
}
