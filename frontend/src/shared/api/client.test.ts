import { describe, expect, it, vi } from 'vitest';
import { ApiError, createDocumentClient } from './client';
import type { Document, DocumentTag } from './client';

const document = {
  id: '00000000-0000-0000-0000-000000000001', title: '原文', content: '𠮷野家\n日本語  text',
  description: null, tags: [], revision: 1, createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-26T00:00:00Z', lastReadAt: null,
} satisfies Document;

describe('document client', () => {
  it('transports the typed CRUD contract and exact content', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([document])))
      .mockResolvedValueOnce(new Response(JSON.stringify(document), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(document)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...document, title: 'new' })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createDocumentClient(fetcher);
    expect(await client.list()).toEqual([document]);
    expect(await client.create({ title: '原文', content: document.content })).toEqual(document);
    expect(await client.get(document.id)).toEqual(document);
    expect(await client.update(document.id, { title: 'new' })).toEqual({ ...document, title: 'new' });
    expect(await client.delete(document.id)).toBeUndefined();
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['/api/documents', 'GET'], ['/api/documents', 'POST'],
      [`/api/documents/${document.id}`, 'GET'], [`/api/documents/${document.id}`, 'PUT'],
      [`/api/documents/${document.id}`, 'DELETE'],
    ]);
    const createInit = fetcher.mock.calls[1][1]!;
    expect(JSON.parse(createInit.body as string)).toEqual({ title: '原文', content: document.content });
    expect(new Headers(createInit.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(fetcher.mock.calls[3][1]!.body as string)).toEqual({ title: 'new' });
  });

  it('transports persisted metadata without accepting server-owned timestamps', async () => {
    const tags: DocumentTag[] = [{ name: 'Grammar', color: '#7C3AED' }];
    const metadata = {
      description: 'JLPT reading notes',
      tags,
    };
    const updated = { ...document, ...metadata };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(updated)),
    );

    const result = await createDocumentClient(fetcher).update(document.id, metadata);

    expect(result).toEqual(updated);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual(metadata);
  });

  it('imports exact text and metadata through the public contract', async () => {
    const imported = {
      ...document,
      content: '  𠮷野家\r\n日本語  \n😀  ',
      description: 'Browser import',
      source: 'Yomitan',
      tags: [{ name: 'Grammar', color: '#7C3AED' }],
    };
    const payload = {
      title: imported.title,
      text: imported.content,
      description: imported.description,
      source: imported.source,
      tags: imported.tags,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(imported), { status: 201 }),
    );

    const result = await createDocumentClient(fetcher).importDocument(payload);

    expect(result).toEqual(imported);
    expect(fetcher).toHaveBeenCalledWith('/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  it('requests analysis for the encoded document resource', async () => {
    const analysis = {
      documentId: document.id,
      documentRevision: 1,
      contentHash: 'hash',
      metadata: {
        analyzerName: 'SudachiPy', analyzerVersion: '0.6.11',
        dictionaryName: 'SudachiDict-core', dictionaryVersion: '20250825', splitMode: 'B',
      },
      analysisOptions: { splitMode: 'B' },
      blocks: [],
      diagnostics: [],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(analysis)),
    );

    const result = await createDocumentClient(fetcher).analyze('doc/with slash');

    expect(result).toEqual(analysis);
    expect(fetcher).toHaveBeenCalledWith('/api/documents/doc%2Fwith%20slash/analysis', {
      method: 'POST',
      headers: undefined,
      body: undefined,
    });
  });

  it('lists and replaces document vocabulary selections', async () => {
    const selections = [{ lemma: '猫', reading: 'ねこ' }];
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ selections })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createDocumentClient(fetcher);

    expect(await client.listVocabularySelections('doc/one')).toEqual(selections);
    expect(await client.replaceVocabularySelections('doc/one', selections)).toBeUndefined();
    expect(fetcher.mock.calls).toEqual([
      ['/api/documents/doc%2Fone/vocabulary-selections', {
        method: 'GET', headers: undefined, body: undefined,
      }],
      ['/api/documents/doc%2Fone/vocabulary-selections', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      }],
    ]);
  });

  it('lists and upserts document-scoped furigana display preferences', async () => {
    const preference = { key: { lemma: '猫', reading: 'ねこ' }, visibility: 'hide' as const };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ preferences: [preference] })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createDocumentClient(fetcher);

    expect(await client.listVocabularyDisplayPreferences('doc/one')).toEqual([preference]);
    expect(await client.setVocabularyDisplayPreference('doc/one', preference)).toBeUndefined();
    expect(fetcher.mock.calls).toEqual([
      ['/api/documents/doc%2Fone/vocabulary-display-preferences', {
        method: 'GET', headers: undefined, body: undefined,
      }],
      ['/api/documents/doc%2Fone/vocabulary-display-preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preference),
      }],
    ]);
  });

  it('transports local and vocabulary-scoped reading override operations with their counts', async () => {
    const override = {
      documentRevision: 2, startOffset: 4, endOffset: 6, scope: 'vocabulary' as const,
      vocabularyKey: '["昨日","きのう"]', reading: 'さくじつ',
    };
    const saved = {
      affectedOccurrenceCount: 2,
      overrides: [{ documentId: document.id, ...override }],
    };
    const key = {
      documentRevision: override.documentRevision,
      startOffset: override.startOffset,
      endOffset: override.endOffset,
      scope: 'local' as const,
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(saved)))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        affectedOccurrenceCount: 1,
        overrides: [],
      })));
    const client = createDocumentClient(fetcher);

    expect(await client.setReadingOverride('doc/one', override)).toEqual(saved);
    expect(await client.deleteReadingOverride('doc/one', key)).toEqual({
      affectedOccurrenceCount: 1,
      overrides: [],
    });
    expect(fetcher.mock.calls).toEqual([
      ['/api/documents/doc%2Fone/reading-overrides', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(override),
      }],
      ['/api/documents/doc%2Fone/reading-overrides', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(key),
      }],
    ]);
  });

  it('preserves Problem Details and HTTP status for callers', async () => {
    const problem = { type: 'about:blank', title: 'Not Found', status: 404, detail: 'Document missing' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(problem), {
      status: 404, headers: { 'Content-Type': 'application/problem+json' },
    }));
    try {
      await createDocumentClient(fetcher).get(document.id);
      expect.fail('request should reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 404, problem, body: problem, message: 'Document missing' });
    }
  });

  it('preserves non-JSON errors and transport failures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('upstream unavailable', { status: 502 }));
    await expect(createDocumentClient(fetcher).list()).rejects.toMatchObject({ status: 502, body: 'upstream unavailable', problem: undefined });
    const failure = new TypeError('network offline');
    fetcher.mockRejectedValueOnce(failure);
    await expect(createDocumentClient(fetcher).list()).rejects.toBe(failure);
  });
});
