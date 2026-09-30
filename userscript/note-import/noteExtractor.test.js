import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from '../../frontend/node_modules/jsdom/lib/api.js';
import { describe, expect, it } from 'vitest';
import { NoteExtractionFailureCode, extractNoteArticle } from './noteExtractor.js';

const fixtureDirectory = new URL('./fixtures/', import.meta.url);

async function documentFromFixture(name) {
  const html = await readFile(fileURLToPath(new URL(name, fixtureDirectory)), 'utf8');
  return new JSDOM(html).window.document;
}

describe('extractNoteArticle', () => {
  it('rejects every route other than a canonical note.com article route', async () => {
    const document = await documentFromFixture('unsupported-route.html');

    for (const url of [
      'https://note.com/',
      'https://note.com/example_creator',
      'https://note.com/example_creator/m/magazine',
      'https://note.com/example_creator/n/not-an-article',
      'https://www.note.com/example_creator/n/n123456789abc',
    ]) {
      expect(extractNoteArticle({ document, url })).toEqual({
        ok: false,
        error: { code: NoteExtractionFailureCode.UNSUPPORTED_ROUTE },
      });
    }
  });

  it('returns the title, current URL, and readable article blocks without page chrome', async () => {
    const document = await documentFromFixture('representative-article.html');
    const url = 'https://note.com/example_creator/n/n123456789abc?from=discover';

    expect(extractNoteArticle({ document, url })).toEqual({
      ok: true,
      value: {
        title: '春の読書メモ',
        text: '最初の段落です。\n\n意味のある\n改行です。\n\n見出し\n\n引用した文章です。\n\n空行の前です。\n\n空行の後です。\n\n最後の段落です。',
        url,
      },
    });
  });

  it('reports a structured missing-title failure instead of using a page-level heading', async () => {
    const document = await documentFromFixture('missing-title.html');

    expect(extractNoteArticle({ document, url: 'https://note.com/example_creator/n/n123456789abc' })).toEqual({
      ok: false,
      error: { code: NoteExtractionFailureCode.MISSING_TITLE },
    });
  });

  it('fails closed when the expected note.com article text container is absent', async () => {
    const document = await documentFromFixture('missing-article-container.html');

    expect(extractNoteArticle({ document, url: 'https://note.com/example_creator/n/n123456789abc' })).toEqual({
      ok: false,
      error: { code: NoteExtractionFailureCode.MISSING_ARTICLE_CONTAINER },
    });
  });

  it('reports empty text when the recognized article contains only ignored elements', async () => {
    const document = await documentFromFixture('empty-article.html');

    expect(extractNoteArticle({ document, url: 'https://note.com/example_creator/n/n123456789abc' })).toEqual({
      ok: false,
      error: { code: NoteExtractionFailureCode.EMPTY_TEXT },
    });
  });

  it('fails closed instead of returning partial text for an unknown article block', async () => {
    const document = await documentFromFixture('unexpected-article-structure.html');

    expect(extractNoteArticle({ document, url: 'https://note.com/example_creator/n/n123456789abc' })).toEqual({
      ok: false,
      error: { code: NoteExtractionFailureCode.UNRECOGNIZED_ARTICLE_STRUCTURE },
    });
  });
});
