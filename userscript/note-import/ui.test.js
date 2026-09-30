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

describe('initializeNoteImport', () => {
  it('injects one modest import button into a supported note article', () => {
    const document = createDocument();

    initializeNoteImport({ document, url: article.url, extractArticle: supportedExtractor, client: {} });

    expect(document.querySelectorAll('[data-japanese-reader-note-import]')).toHaveLength(1);
    expect(button(document)).toMatchObject({ textContent: 'Import to Japanese Reader', disabled: false });
    expect(status(document).textContent).toBe('Ready to import this article.');
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

    button(document).click();
    await Promise.resolve();

    expect(attempts).toBe(2);
    expect(status(document).textContent).toBe('Imported to Japanese Reader.');
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
});
