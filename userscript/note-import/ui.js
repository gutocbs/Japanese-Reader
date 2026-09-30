import { extractNoteArticle } from './noteExtractor.js';
import { ReaderApiClient } from './readerApiClient.js';

const ROOT_ATTRIBUTE = 'data-japanese-reader-note-import';
const ROOT_ID = 'japanese-reader-note-import-control';
const STYLE_ID = 'japanese-reader-note-import-styles';
const ARTICLE_SELECTOR = 'article.p-article__body';
const NAVIGATION_MARKER = '__japaneseReaderNoteImportNavigation';
const CONTROL_CLASS = 'japanese-reader-note-import__control';
const BUTTON_CLASS = 'japanese-reader-note-import__button';
const STATUS_CLASS = 'japanese-reader-note-import__status';
const STATUS_ID = 'japanese-reader-note-import-status';
const NARROW_LAYOUT_MAX_WIDTH = '480px';

const CONTROL_STYLES = `
#${ROOT_ID} {
  --japanese-reader-note-import-ink: #2C2A27;
  --japanese-reader-note-import-muted: #6B675F;
  --japanese-reader-note-import-paper: #FBFAF7;
  --japanese-reader-note-import-hover-surface: #F2F0EA;
  --japanese-reader-note-import-rule: #D7D2C8;
  --japanese-reader-note-import-accent: #5C4B8A;
  --japanese-reader-note-import-accent-strong: #43345F;
  --japanese-reader-note-import-space-none: 0;
  --japanese-reader-note-import-space-tight: 8px;
  --japanese-reader-note-import-space-inline: 12px;
  --japanese-reader-note-import-space-block: 16px;
  --japanese-reader-note-import-space-boundary: clamp(18px, 3vw, 32px);
  --japanese-reader-note-import-button-padding-block: 7px;
  --japanese-reader-note-import-button-padding-inline: 11px;
  --japanese-reader-note-import-button-min-height: 36px;
  --japanese-reader-note-import-full-width: 100%;
  --japanese-reader-note-import-font-family: system-ui, sans-serif;
  --japanese-reader-note-import-font-size: 14px;
  --japanese-reader-note-import-font-line-height: 1.45;
  --japanese-reader-note-import-font-weight: 500;
  --japanese-reader-note-import-font-weight-emphasis: 650;
  --japanese-reader-note-import-border-width: 1px;
  --japanese-reader-note-import-button-radius: 3px;
  --japanese-reader-note-import-focus-outline-width: 2px;
  --japanese-reader-note-import-focus-outline-offset: 3px;
  --japanese-reader-note-import-disabled-opacity: 0.58;
  --japanese-reader-note-import-reduced-motion-duration: 0.01ms;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--japanese-reader-note-import-space-tight) var(--japanese-reader-note-import-space-inline);
  margin: var(--japanese-reader-note-import-space-boundary) var(--japanese-reader-note-import-space-none) var(--japanese-reader-note-import-space-none);
  padding: var(--japanese-reader-note-import-space-block) var(--japanese-reader-note-import-space-none) var(--japanese-reader-note-import-space-none);
  border-top: var(--japanese-reader-note-import-border-width) solid var(--japanese-reader-note-import-rule);
  color: var(--japanese-reader-note-import-ink);
  font-family: var(--japanese-reader-note-import-font-family);
  font-size: var(--japanese-reader-note-import-font-size);
  font-weight: var(--japanese-reader-note-import-font-weight);
  line-height: var(--japanese-reader-note-import-font-line-height);
}

#${ROOT_ID} .${BUTTON_CLASS} {
  min-height: var(--japanese-reader-note-import-button-min-height);
  padding: var(--japanese-reader-note-import-button-padding-block) var(--japanese-reader-note-import-button-padding-inline);
  border: var(--japanese-reader-note-import-border-width) solid var(--japanese-reader-note-import-accent);
  border-radius: var(--japanese-reader-note-import-button-radius);
  background: var(--japanese-reader-note-import-paper);
  color: var(--japanese-reader-note-import-accent-strong);
  font: inherit;
  font-weight: var(--japanese-reader-note-import-font-weight-emphasis);
  cursor: pointer;
}

#${ROOT_ID} .${BUTTON_CLASS}:hover:not(:disabled) {
  background: var(--japanese-reader-note-import-hover-surface);
}

#${ROOT_ID} .${BUTTON_CLASS}:focus-visible {
  outline: var(--japanese-reader-note-import-focus-outline-width) solid var(--japanese-reader-note-import-accent);
  outline-offset: var(--japanese-reader-note-import-focus-outline-offset);
}

#${ROOT_ID} .${BUTTON_CLASS}:disabled {
  opacity: var(--japanese-reader-note-import-disabled-opacity);
  cursor: default;
}

#${ROOT_ID}[data-state="importing"] .${BUTTON_CLASS} {
  cursor: progress;
}

#${ROOT_ID} .${STATUS_CLASS} {
  color: var(--japanese-reader-note-import-muted);
}

@media (max-width: ${NARROW_LAYOUT_MAX_WIDTH}) {
  #${ROOT_ID} {
    align-items: stretch;
  }

  #${ROOT_ID} .${BUTTON_CLASS} {
    width: var(--japanese-reader-note-import-full-width);
  }
}

@media (prefers-reduced-motion: reduce) {
  #${ROOT_ID} * {
    scroll-behavior: auto;
    transition-duration: var(--japanese-reader-note-import-reduced-motion-duration);
  }
}
`;

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
      attributes: true,
      attributeFilter: ['class'],
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
    renderState(root, importButton, feedback, 'importing');

    let result;
    try {
      result = await client.importDocument(extraction.value);
    } catch {
      result = { ok: false, error: {} };
    }

    importing = false;
    if (result?.ok) {
      imported = true;
      renderState(root, importButton, feedback, 'success');
      return;
    }

    renderState(root, importButton, feedback, 'error', conciseErrorMessage(result?.error));
  }

  article.insertAdjacentElement('afterend', root);
  return { injected: true, root };
}

function createControl(document, url) {
  ensureControlStyles(document);

  const root = document.createElement('section');
  root.id = ROOT_ID;
  root.className = CONTROL_CLASS;
  root.dataset.japaneseReaderNoteImport = '';
  root.dataset.noteImportUrl = url;
  root.setAttribute('aria-label', 'Japanese Reader import');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.textContent = 'Import to Japanese Reader';

  const feedback = document.createElement('span');
  feedback.id = STATUS_ID;
  feedback.className = STATUS_CLASS;
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  button.setAttribute('aria-describedby', STATUS_ID);

  root.append(button, feedback);
  renderState(root, button, feedback, 'available');
  return root;
}

function renderState(root, button, feedback, state, detail = '') {
  root.dataset.state = state;

  switch (state) {
    case 'importing':
      button.disabled = true;
      button.textContent = 'Importing…';
      feedback.textContent = 'Importing article…';
      break;
    case 'success':
      button.disabled = true;
      button.textContent = 'Imported';
      feedback.textContent = 'Imported to Japanese Reader.';
      break;
    case 'error':
      button.disabled = false;
      button.textContent = 'Retry import';
      feedback.textContent = `Import failed: ${detail}`;
      break;
    default:
      button.disabled = false;
      button.textContent = 'Import to Japanese Reader';
      feedback.textContent = 'Ready to import this article.';
  }
}

function ensureControlStyles(document) {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const styles = document.createElement('style');
  styles.id = STYLE_ID;
  styles.textContent = CONTROL_STYLES;
  (document.head ?? document.documentElement).append(styles);
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
