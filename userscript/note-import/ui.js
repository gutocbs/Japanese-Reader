import { extractNoteArticle } from './noteExtractor.js';
import { ReaderApiClient } from './readerApiClient.js';

const ROOT_ATTRIBUTE = 'data-japanese-reader-note-import';
const ROOT_ID = 'japanese-reader-note-import-control';
const ARTICLE_SELECTOR = 'article.p-article__body';
const NAVIGATION_MARKER = '__japaneseReaderNoteImportNavigation';

export function installNoteImportNavigation({
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

export function initializeNoteImport({
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
