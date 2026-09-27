import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Analysis, Document, DocumentClient } from '../shared/api/client';
import { App } from './App';

const document: Document = {
  id: '00000000-0000-0000-0000-000000000001',
  title: '雪国',
  content: '国境の長いトンネルを抜けると雪国であった。',
  revision: 1,
  createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-26T00:00:00Z',
  lastReadAt: null,
};

const analysis: Analysis = {
  documentId: document.id,
  documentRevision: 1,
  contentHash: 'hash',
  metadata: {
    analyzerName: 'SudachiPy', analyzerVersion: '0.6.11',
    dictionaryName: 'SudachiDict-core', dictionaryVersion: '20250825', splitMode: 'B',
  },
  analysisOptions: { splitMode: 'B' },
  blocks: [{
    startOffset: 0,
    endOffset: 2,
    tokens: [{
      startOffset: 0, endOffset: 2, surface: '国境', lemma: '国境', reading: 'こっきょう',
      dictionaryReading: 'こっきょう', partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
      isOutOfVocabulary: false, isLexical: true, vocabularyKey: '国境\u0000こっきょう',
      furiganaSegments: [{ text: '国境', reading: 'こっきょう' }],
    }],
  }],
  diagnostics: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function client(overrides: Partial<DocumentClient> = {}): DocumentClient {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(document),
    get: vi.fn().mockResolvedValue(document),
    update: vi.fn().mockResolvedValue(document),
    delete: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockResolvedValue(analysis),
    ...overrides,
  };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('reader routes', () => {
  it('creates, analyzes, and navigates from the editor to semantic reading', async () => {
    const pendingAnalysis = deferred<Analysis>();
    const api = client({ analyze: vi.fn().mockReturnValue(pendingAnalysis.promise) });
    render(<App client={api} initialPath="/documents/new" />);

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: document.title } });
    fireEvent.change(screen.getByLabelText('Texto japonês'), { target: { value: document.content } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar e ler' }));

    expect(await screen.findByRole('button', { name: 'Analisando…' })).toBeDisabled();
    await act(async () => pendingAnalysis.resolve(analysis));

    expect(await screen.findByRole('heading', { name: document.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('こっきょう').parentElement?.tagName).toBe('RUBY');
    expect(window.location.pathname).toBe(`/documents/${document.id}/read`);
  });

  it('preserves the draft after analysis fails and retries the saved document', async () => {
    let attempts = 0;
    const api = client({
      analyze: vi.fn().mockImplementation(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('analyzer unavailable');
        return analysis;
      }),
    });
    render(<App client={api} initialPath="/documents/new" />);

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: document.title } });
    fireEvent.change(screen.getByLabelText('Texto japonês'), { target: { value: document.content } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar e ler' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível analisar o documento.');
    expect(screen.getByLabelText('Texto japonês')).toHaveValue(document.content);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: document.title, level: 1 })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('loads and updates an existing document from the edit route', async () => {
    const updated = { ...document, title: '雪国 メモ' };
    const api = client({ update: vi.fn().mockResolvedValue(updated) });
    render(<App client={api} initialPath={`/documents/${document.id}/edit`} />);

    expect(screen.getByText('Carregando documento…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Texto japonês')).toHaveValue(document.content);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: updated.title } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e analisar' }));

    expect(await screen.findByRole('heading', { name: updated.title, level: 1 })).toBeInTheDocument();
  });

  it('disables analysis for empty content and explains how to continue', () => {
    render(<App client={client()} initialPath="/documents/new" />);

    expect(screen.getByRole('button', { name: 'Analisar e ler' })).toBeDisabled();
    expect(screen.getByText('Digite algum texto japonês para analisar.')).toBeInTheDocument();
  });
});
