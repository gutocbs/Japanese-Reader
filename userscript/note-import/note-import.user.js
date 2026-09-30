// ==UserScript==
// @name         Japanese Reader: Import note.com article
// @namespace    https://japanese.io/userscripts/note-import
// @version      0.1.0
// @description  Import supported note.com articles into the local Japanese Reader.
// @match        https://note.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const NoteImportConfig = (() => {
    const READER_API_CONFIG = Object.freeze({
      baseUrl: 'http://127.0.0.1:8000',
      endpointPath: '/api/imports',
      source: 'note.com',
      tag: Object.freeze({ name: 'note.com', color: '#7C3AED' }),
      timeoutMs: 10_000,
    });

    return { READER_API_CONFIG };
  })();

  const NoteImportExtractor = (() => {
    const NoteExtractionFailureCode = Object.freeze({
      UNSUPPORTED_ROUTE: 'UNSUPPORTED_ROUTE',
      MISSING_TITLE: 'MISSING_TITLE',
      MISSING_ARTICLE_CONTAINER: 'MISSING_ARTICLE_CONTAINER',
      EMPTY_TEXT: 'EMPTY_TEXT',
      UNRECOGNIZED_ARTICLE_STRUCTURE: 'UNRECOGNIZED_ARTICLE_STRUCTURE',
    });

    const ARTICLE_SELECTOR = 'article.p-article__body';
    const ARTICLE_TEXT_SELECTOR = '.note-common-styles__textnote-body';
    const TEXT_BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI']);
    const IGNORED_TAGS = new Set([
      'ASIDE', 'AUDIO', 'BUTTON', 'CANVAS', 'EMBED', 'FIGURE', 'FORM', 'IFRAME', 'IMG', 'INPUT',
      'MENU', 'NAV', 'NOSCRIPT', 'OBJECT', 'SCRIPT', 'SELECT', 'STYLE', 'SVG', 'TEXTAREA', 'VIDEO',
    ]);

    function extractNoteArticle({ document, url }) {
      if (!isSupportedArticleUrl(url)) {
        return failure(NoteExtractionFailureCode.UNSUPPORTED_ROUTE);
      }

      const article = document.querySelector(ARTICLE_SELECTOR);
      if (!article) {
        return failure(NoteExtractionFailureCode.MISSING_ARTICLE_CONTAINER);
      }

      const title = normalizeInlineText(article.querySelector('h1'));
      if (!title) {
        return failure(NoteExtractionFailureCode.MISSING_TITLE);
      }

      const textContainer = article.querySelector(ARTICLE_TEXT_SELECTOR);
      if (!textContainer) {
        return failure(NoteExtractionFailureCode.MISSING_ARTICLE_CONTAINER);
      }

      const blocks = collectTextBlocks(textContainer);
      if (blocks === null) {
        return failure(NoteExtractionFailureCode.UNRECOGNIZED_ARTICLE_STRUCTURE);
      }
      const text = blocks.join('\n\n').trim();
      if (!text) {
        return failure(NoteExtractionFailureCode.EMPTY_TEXT);
      }

      return {
        ok: true,
        value: { title, text, url },
      };
    }

    function isSupportedArticleUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === 'https:'
          && url.hostname === 'note.com'
          && /^\/[^/]+\/n\/n[a-z0-9]+$/i.test(url.pathname);
      } catch {
        return false;
      }
    }

    function collectTextBlocks(textContainer) {
      const blocks = [];

      for (const child of textContainer.childNodes) {
        if (child.nodeType === 3) {
          if (child.textContent.trim()) {
            return null;
          }
          continue;
        }

        if (child.nodeType !== 1) {
          continue;
        }

        if (shouldIgnore(child)) {
          continue;
        }

        if (TEXT_BLOCK_TAGS.has(child.tagName)) {
          const text = normalizeBlockText(child);
          if (text) {
            blocks.push(text);
          }
          continue;
        }

        if (child.tagName === 'UL' || child.tagName === 'OL') {
          for (const item of child.querySelectorAll(':scope > li')) {
            const text = normalizeBlockText(item);
            if (text) {
              blocks.push(text);
            }
          }
          continue;
        }

        if (child.tagName === 'HR') {
          continue;
        }

        if (normalizeInlineText(child)) {
          return null;
        }
      }

      return blocks;
    }

    function shouldIgnore(element) {
      return IGNORED_TAGS.has(element.tagName);
    }

    function normalizeBlockText(element) {
      return normalizeInlineText(element)
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function normalizeInlineText(node) {
      if (!node) {
        return '';
      }

      if (node.nodeType === 3) {
        return node.textContent.replace(/\s+/g, ' ');
      }

      if (node.nodeType !== 1 || shouldIgnore(node)) {
        return '';
      }

      if (node.tagName === 'BR') {
        return '\n';
      }

      return Array.from(node.childNodes, normalizeInlineText).join('');
    }

    function failure(code) {
      return { ok: false, error: { code } };
    }

    return { extractNoteArticle };
  })();

  const NoteImportApi = (() => {
    const { READER_API_CONFIG } = NoteImportConfig;

    const ReaderApiErrorCode = Object.freeze({
      API_ERROR: 'API_ERROR',
      MALFORMED_SUCCESS_RESPONSE: 'MALFORMED_SUCCESS_RESPONSE',
      MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
      NETWORK_FAILURE: 'NETWORK_FAILURE',
      TIMEOUT: 'TIMEOUT',
      TRANSPORT_EXCEPTION: 'TRANSPORT_EXCEPTION',
      TRANSPORT_UNAVAILABLE: 'TRANSPORT_UNAVAILABLE',
    });

    class ReaderApiClient {
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

    function joinApiUrl(baseUrl, endpointPath) {
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

    return { ReaderApiClient };
  })();

  const NoteImportUi = (() => {
    const { extractNoteArticle } = NoteImportExtractor;
    const { ReaderApiClient } = NoteImportApi;

    const ROOT_ATTRIBUTE = 'data-japanese-reader-note-import';
    const ROOT_ID = 'japanese-reader-note-import-control';
    const ARTICLE_SELECTOR = 'article.p-article__body';
    const NAVIGATION_MARKER = '__japaneseReaderNoteImportNavigation';

    function installNoteImportNavigation({
      window = globalThis.window,
      initialize = initializeNoteImport,
      initializeOptions = {},
    } = {}) {
      if (!window || window[NAVIGATION_MARKER]) {
        return;
      }

      let scheduled = false;
      const reinitialize = () => {
        if (scheduled) {
          return;
        }

        scheduled = true;
        window.queueMicrotask(() => {
          scheduled = false;
          initialize({
            ...initializeOptions,
            document: window.document,
            url: window.location.href,
          });
        });
      };

      window[NAVIGATION_MARKER] = true;
      observeHistory(window, reinitialize);
      window.addEventListener('popstate', reinitialize);

      if (typeof window.MutationObserver === 'function') {
        new window.MutationObserver(reinitialize).observe(window.document.documentElement, {
          childList: true,
          subtree: true,
        });
      }

      reinitialize();
    }

    function initializeNoteImport({
      document = globalThis.document,
      url = globalThis.location?.href,
      extractArticle = extractNoteArticle,
      client = new ReaderApiClient(),
    } = {}) {
      if (!document || !url) {
        return { injected: false };
      }

      const extraction = extractArticle({ document, url });
      const existing = document.querySelector(`[${ROOT_ATTRIBUTE}]`);
      if (!extraction.ok) {
        existing?.remove();
        return { injected: false, error: extraction.error };
      }

      if (existing?.dataset.noteImportUrl === url) {
        return { injected: true, root: existing };
      }

      existing?.remove();

      const article = document.querySelector(ARTICLE_SELECTOR);
      if (!article) {
        return { injected: false };
      }

      const root = createControl(document, url);
      const importButton = root.querySelector('button');
      const feedback = root.querySelector('[role="status"]');
      let importing = false;
      let imported = false;

      importButton.addEventListener('click', () => {
        if (importing || imported) {
          return;
        }

        void importArticle();
      });

      async function importArticle() {
        importing = true;
        renderState(importButton, feedback, 'importing');

        let result;
        try {
          result = await client.importDocument(extraction.value);
        } catch {
          result = { ok: false, error: {} };
        }

        importing = false;
        if (result?.ok) {
          imported = true;
          renderState(importButton, feedback, 'success');
          return;
        }

        renderState(importButton, feedback, 'error', conciseErrorMessage(result?.error));
      }

      article.insertBefore(root, article.firstChild);
      return { injected: true, root };
    }

    function createControl(document, url) {
      const root = document.createElement('section');
      root.id = ROOT_ID;
      root.dataset.japaneseReaderNoteImport = '';
      root.dataset.noteImportUrl = url;
      root.setAttribute('aria-label', 'Japanese Reader import');
      root.style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 16px;font:14px/1.4 sans-serif;';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Import to Japanese Reader';
      button.style.cssText = 'padding:8px 12px;border:1px solid #7C3AED;border-radius:4px;background:#fff;color:#5B21B6;font:inherit;cursor:pointer;';

      const feedback = document.createElement('span');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');

      root.append(button, feedback);
      renderState(button, feedback, 'available');
      return root;
    }

    function renderState(button, feedback, state, detail = '') {
      switch (state) {
        case 'importing':
          button.disabled = true;
          button.textContent = 'Importing…';
          button.style.opacity = '0.5';
          button.style.cursor = 'progress';
          feedback.textContent = 'Importing article…';
          break;
        case 'success':
          button.disabled = true;
          button.textContent = 'Imported';
          button.style.opacity = '0.5';
          button.style.cursor = 'default';
          feedback.textContent = 'Imported to Japanese Reader.';
          break;
        case 'error':
          button.disabled = false;
          button.textContent = 'Retry import';
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          feedback.textContent = `Import failed: ${detail}`;
          break;
        default:
          button.disabled = false;
          button.textContent = 'Import to Japanese Reader';
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          feedback.textContent = 'Ready to import this article.';
      }
    }

    function conciseErrorMessage(error) {
      if (typeof error?.detail === 'string' && error.detail.trim()) {
        return error.detail.trim();
      }

      if (typeof error?.title === 'string' && error.title.trim()) {
        return error.title.trim();
      }

      return 'The local Reader API is unavailable.';
    }

    function observeHistory(window, onNavigate) {
      for (const method of ['pushState', 'replaceState']) {
        const original = window.history[method].bind(window.history);
        window.history[method] = (...args) => {
          const result = original(...args);
          onNavigate();
          return result;
        };
      }
    }

    return { installNoteImportNavigation };
  })();

  NoteImportUi.installNoteImportNavigation();
})();
