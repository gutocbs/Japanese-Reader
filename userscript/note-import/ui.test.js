import { JSDOM } from '../../frontend/node_modules/jsdom/lib/api.js';
import { describe, expect, it } from 'vitest';
import { initializeNoteImport, installNoteImportNavigation } from './ui.js';

const article = Object.freeze({
  title: '春の読書メモ',
  text: '最初の段落です。',
  url: 'https://note.com/example_creator/n/n123456789abc',
});

function createDocument() {
  return new JSDOM('<main><article class="p-article__body"><h1>春の読書メモ</h1></article></main>').window.document;
}

function createNavigationWindow(url = article.url) {
  return new JSDOM('<main><article class="p-article__body"><h1>春の読書メモ</h1></article></main>', { url }).window;
}

function supportedExtractor({ url }) {
  return { ok: true, value: { ...article, url } };
}

function unsupportedExtractor() {
  return { ok: false, error: { code: 'UNSUPPORTED_ROUTE' } };
}

function routeAwareExtractor({ url }) {
  return url.includes('/n/') ? supportedExtractor({ url }) : unsupportedExtractor();
}

function selectorAwareExtractor({ document, url }) {
  return document.querySelector('article.p-article__body')
    ? routeAwareExtractor({ url })
    : unsupportedExtractor();
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function button(document) {
  return document.querySelector('[data-japanese-reader-note-import] button');
}

function status(document) {
  return document.querySelector('[data-japanese-reader-note-import] [role="status"]');
}

function control(document) {
  return document.querySelector('[data-japanese-reader-note-import]');
}

function stylesheet(document) {
  return document.getElementById('japanese-reader-note-import-styles');
}

async function flushNavigation() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('initializeNoteImport', () => {
  it('injects one modest import button into a supported note article', () => {
    const document = createDocument();

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });

    expect(document.querySelectorAll('[data-japanese-reader-note-import]')).toHaveLength(1);
    expect(button(document)).toMatchObject({ textContent: 'Import to Japanese Reader', disabled: false });
    expect(status(document).textContent).toBe('Ready to import this article.');
  });

  it('places the editorial utility after the article with stable namespaced style and state hooks', () => {
    const document = createDocument();
    const articleElement = document.querySelector('article.p-article__body');

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });

    expect(articleElement.nextElementSibling).toBe(control(document));
    expect(control(document)).toMatchObject({
      className: 'japanese-reader-note-import__control',
      dataset: expect.objectContaining({ japaneseReaderNoteImport: '', state: 'available' }),
    });
    expect(button(document)).toMatchObject({
      className: 'japanese-reader-note-import__button',
      type: 'button',
      disabled: false,
    });
    expect(status(document)).toMatchObject({ className: 'japanese-reader-note-import__status' });
    expect(button(document).getAttribute('aria-describedby')).toBe(status(document).id);
    expect(stylesheet(document)).not.toBeNull();
  });

  it('keeps the native button focusable and exposes a tokenized focus-visible hook', () => {
    const document = createDocument();

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });
    button(document).focus();

    expect(document.activeElement).toBe(button(document));
    expect(stylesheet(document).textContent).toContain('--japanese-reader-note-import-focus-outline-width: 2px;');
    expect(stylesheet(document).textContent).toContain('--japanese-reader-note-import-hover-surface: #F2F0EA;');
    expect(stylesheet(document).textContent).toContain(
      'outline: var(--japanese-reader-note-import-focus-outline-width) solid var(--japanese-reader-note-import-accent);',
    );
    expect(stylesheet(document).textContent).toContain(
      'background: var(--japanese-reader-note-import-hover-surface);',
    );
  });

  it('uses a tokenized full-width button inside the narrow-layout media rule', () => {
    const document = createDocument();

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });

    expect(stylesheet(document).textContent).toContain('@media (max-width: 480px)');
    expect(stylesheet(document).textContent).toContain(
      'width: var(--japanese-reader-note-import-full-width);',
    );
  });

  it('keeps one local stylesheet after repeated and navigation reinitialization', async () => {
    const document = createDocument();

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });
    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });
    expect(document.querySelectorAll('#japanese-reader-note-import-styles')).toHaveLength(1);

    const window = createNavigationWindow();
    installNoteImportNavigation({
      window,
      initializeOptions: { extractArticle: routeAwareExtractor, client: {} },
    });
    await flushNavigation();

    window.history.replaceState({}, '', 'https://note.com/example_creator/n/nabcdef123456');
    await flushNavigation();

    expect(window.document.querySelectorAll('#japanese-reader-note-import-styles')).toHaveLength(1);
  });

  it('does not add a duplicate button or listener when initialized repeatedly for the same article', async () => {
    const document = createDocument();
    const request = deferred();
    let imports = 0;
    const client = {
      importDocument: () => {
        imports += 1;
        return request.promise;
      },
    };

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client });
    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client });

    button(document).click();
    expect(document.querySelectorAll('[data-japanese-reader-note-import]')).toHaveLength(1);
    expect(imports).toBe(1);
    expect(button(document).disabled).toBe(true);

    request.resolve({ ok: true, value: { id: 'document-1' } });
    await Promise.resolve();
  });

  it('does not inject an import button on an unsupported page', () => {
    const document = createDocument();

    initializeNoteImport({ document, url: 'https://note.com/example_creator', extractArticle: unsupportedExtractor, client: {} });

    expect(document.querySelector('[data-japanese-reader-note-import]')).toBeNull();
  });

  it('disables the button and shows importing feedback while a request is active', () => {
    const document = createDocument();
    const request = deferred();

    initializeNoteImport({
      document,
      url: article.url,
      extractArticle: supportedExtractor,
      client: { importDocument: () => request.promise },
    });

    button(document).click();

    expect(button(document)).toMatchObject({ textContent: 'Importing…', disabled: true });
    expect(status(document).textContent).toBe('Importing article…');
    expect(control(document).dataset.state).toBe('importing');
  });

  it('shows success feedback after the local API accepts the import', async () => {
    const document = createDocument();

    initializeNoteImport({
      document,
      url: article.url,
      extractArticle: supportedExtractor,
      client: { importDocument: async () => ({ ok: true, value: { id: 'document-1' } }) },
    });

    button(document).click();
    await Promise.resolve();

    expect(button(document)).toMatchObject({ textContent: 'Imported', disabled: true });
    expect(status(document).textContent).toBe('Imported to Japanese Reader.');
    expect(control(document).dataset.state).toBe('success');
  });

  it('shows a concise error and restores the button for retry after a failed import', async () => {
    const document = createDocument();
    let attempts = 0;
    const client = {
      importDocument: async () => {
        attempts += 1;
        return attempts === 1
          ? { ok: false, error: { detail: 'The local API is not running.' } }
          : { ok: true, value: { id: 'document-1' } };
      },
    };

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client });
    button(document).click();
    await Promise.resolve();

    expect(button(document)).toMatchObject({ textContent: 'Retry import', disabled: false });
    expect(status(document).textContent).toBe('Import failed: The local API is not running.');
    expect(control(document).dataset.state).toBe('error');

    button(document).click();
    await Promise.resolve();

    expect(attempts).toBe(2);
    expect(status(document).textContent).toBe('Imported to Japanese Reader.');
    expect(control(document).dataset.state).toBe('success');
  });

  it('starts only one import when the button is clicked repeatedly while a request is pending', () => {
    const document = createDocument();
    const request = deferred();
    let imports = 0;

    initializeNoteImport({
      document,
      url: article.url,
      extractArticle: supportedExtractor,
      client: {
        importDocument: () => {
          imports += 1;
          return request.promise;
        },
      },
    });

    button(document).click();
    button(document).click();

    expect(imports).toBe(1);
  });

  it('updates the control for a new supported history route and removes it for an unsupported route', async () => {
    const window = createNavigationWindow();
    const nextArticleUrl = 'https://note.com/example_creator/n/nabcdef123456';

    installNoteImportNavigation({
      window,
      initializeOptions: { extractArticle: routeAwareExtractor, client: {} },
    });

    window.document.querySelector('main').innerHTML = '<article class="p-article__body"><h1>次の記事</h1></article>';
    window.history.pushState({}, '', nextArticleUrl);
    await Promise.resolve();
    await Promise.resolve();

    expect(window.document.querySelectorAll('[data-japanese-reader-note-import]')).toHaveLength(1);
    expect(window.document.querySelector('[data-japanese-reader-note-import]').dataset.noteImportUrl).toBe(nextArticleUrl);

    window.document.querySelector('main').innerHTML = '<section>Creator profile</section>';
    window.history.pushState({}, '', 'https://note.com/example_creator');
    await Promise.resolve();
    await Promise.resolve();

    expect(window.document.querySelector('[data-japanese-reader-note-import]')).toBeNull();
  });

  it('updates the control URL after replaceState without replacing article DOM', async () => {
    const window = createNavigationWindow();
    const nextArticleUrl = 'https://note.com/example_creator/n/nabcdef123456';

    installNoteImportNavigation({
      window,
      initializeOptions: { extractArticle: routeAwareExtractor, client: {} },
    });
    await flushNavigation();

    window.history.replaceState({}, '', nextArticleUrl);
    await flushNavigation();

    expect(window.document.querySelector('[data-japanese-reader-note-import]').dataset.noteImportUrl).toBe(nextArticleUrl);
  });

  it('updates the control URL after browser back dispatches popstate', async () => {
    const window = createNavigationWindow();
    const nextArticleUrl = 'https://note.com/example_creator/n/nabcdef123456';

    installNoteImportNavigation({
      window,
      initializeOptions: { extractArticle: routeAwareExtractor, client: {} },
    });
    await flushNavigation();

    window.history.pushState({}, '', nextArticleUrl);
    await flushNavigation();
    const popstate = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    window.history.back();
    await popstate;
    await flushNavigation();

    expect(window.document.querySelector('[data-japanese-reader-note-import]').dataset.noteImportUrl).toBe(article.url);
  });

  it('injects and removes the control when an article gains and loses its selector class', async () => {
    const window = new JSDOM('<main><article id="candidate"><h1>春の読書メモ</h1></article></main>', { url: article.url }).window;
    const candidate = window.document.querySelector('#candidate');

    installNoteImportNavigation({
      window,
      initializeOptions: { extractArticle: selectorAwareExtractor, client: {} },
    });
    await flushNavigation();
    expect(window.document.querySelector('[data-japanese-reader-note-import]')).toBeNull();

    candidate.className = 'p-article__body';
    await flushNavigation();
    expect(window.document.querySelectorAll('[data-japanese-reader-note-import]')).toHaveLength(1);

    candidate.removeAttribute('class');
    await flushNavigation();
    expect(window.document.querySelector('[data-japanese-reader-note-import]')).toBeNull();
  });

  it('installs navigation hooks only once for repeated entry-point installation', async () => {
    const window = createNavigationWindow();
    let initializations = 0;
    const initialize = () => {
      initializations += 1;
    };

    installNoteImportNavigation({ window, initialize });
    installNoteImportNavigation({ window, initialize });
    await flushNavigation();

    window.history.replaceState({}, '', 'https://note.com/example_creator/n/nabcdef123456');
    await flushNavigation();

    expect(initializations).toBe(2);
  });
});
