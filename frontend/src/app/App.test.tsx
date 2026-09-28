import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      isOutOfVocabulary: false, isLexical: true, vocabularyKey: '["国境","こっきょう"]',
      furiganaSegments: [{ text: '国境', reading: 'こっきょう' }],
    }],
  }],
  diagnostics: [],
};

const revisedDocument: Document = {
  ...document,
  title: '雪国 改訂版',
  content: '雪国へ戻った。',
  revision: 2,
  updatedAt: '2026-09-27T00:00:00Z',
};

const revisedAnalysis: Analysis = {
  ...analysis,
  documentRevision: 2,
  contentHash: 'revised-hash',
  blocks: [{
    startOffset: 0,
    endOffset: 2,
    tokens: [{
      startOffset: 0, endOffset: 2, surface: '雪国', lemma: '雪国', reading: 'ゆきぐに',
      dictionaryReading: 'ゆきぐに', partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
      isOutOfVocabulary: false, isLexical: true, vocabularyKey: '["雪国","ゆきぐに"]',
      furiganaSegments: [{ text: '雪国', reading: 'ゆきぐに' }],
    }],
  }],
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
    listVocabularySelections: vi.fn().mockResolvedValue([]),
    replaceVocabularySelections: vi.fn().mockResolvedValue(undefined),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]),
    setVocabularyDisplayPreference: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
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
    const api = client({
      get: vi.fn().mockResolvedValue(updated),
      update: vi.fn().mockResolvedValue(updated),
    });
    render(<App client={api} initialPath={`/documents/${document.id}/edit`} />);

    expect(screen.getByText('Carregando documento…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Texto japonês')).toHaveValue(document.content);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: updated.title } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e analisar' }));

    expect(await screen.findByRole('heading', { name: updated.title, level: 1 })).toBeInTheDocument();
  });

  it('revalidates an older reader history entry before keeping its snapshot', async () => {
    let currentDocument = document;
    const api = client({
      get: vi.fn().mockImplementation(async () => currentDocument),
      update: vi.fn().mockImplementation(async () => {
        currentDocument = revisedDocument;
        return revisedDocument;
      }),
      analyze: vi.fn().mockImplementation(async () => (
        currentDocument.revision === 1 ? analysis : revisedAnalysis
      )),
    });
    render(<App client={api} initialPath="/documents/new" />);

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: document.title } });
    fireEvent.change(screen.getByLabelText('Texto japonês'), { target: { value: document.content } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar e ler' }));
    expect(await screen.findByRole('heading', { name: document.title, level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Editar documento' }));
    expect(await screen.findByLabelText('Texto japonês')).toHaveValue(document.content);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: revisedDocument.title } });
    fireEvent.change(screen.getByLabelText('Texto japonês'), {
      target: { value: revisedDocument.content },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e analisar' }));
    expect(await screen.findByRole('heading', {
      name: revisedDocument.title,
      level: 1,
    })).toBeInTheDocument();

    act(() => window.history.back());
    expect(await screen.findByLabelText('Texto japonês')).toHaveValue(revisedDocument.content);

    act(() => window.history.back());

    expect(await screen.findByRole('heading', {
      name: revisedDocument.title,
      level: 1,
    })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/documents/${document.id}/read`);
    expect(screen.getByText('ゆきぐに').parentElement?.tagName).toBe('RUBY');
  });

  it('ignores an older StrictMode success after a newer reader request wins', async () => {
    const staleDocument = deferred<Document>();
    const api = client({
      get: vi.fn()
        .mockReturnValueOnce(staleDocument.promise)
        .mockResolvedValue(revisedDocument),
      analyze: vi.fn()
        .mockResolvedValueOnce(revisedAnalysis)
        .mockResolvedValue(analysis),
    });
    render(
      <StrictMode>
        <App client={api} initialPath={`/documents/${document.id}/read`} />
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', {
      name: revisedDocument.title,
      level: 1,
    })).toBeInTheDocument();

    await act(async () => {
      staleDocument.resolve(document);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', {
      name: revisedDocument.title,
      level: 1,
    })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: document.title, level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText('ゆきぐに').parentElement?.tagName).toBe('RUBY');
  });

  it('ignores an older StrictMode failure after a newer reader request wins', async () => {
    const staleDocument = deferred<Document>();
    const api = client({
      get: vi.fn()
        .mockReturnValueOnce(staleDocument.promise)
        .mockResolvedValue(revisedDocument),
      analyze: vi.fn().mockResolvedValue(revisedAnalysis),
    });
    render(
      <StrictMode>
        <App client={api} initialPath={`/documents/${document.id}/read`} />
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', {
      name: revisedDocument.title,
      level: 1,
    })).toBeInTheDocument();

    await act(async () => {
      staleDocument.reject(new Error('stale request failed'));
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', {
      name: revisedDocument.title,
      level: 1,
    })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('serializes replacement writes so rapid toggles cannot persist stale state', async () => {
    const firstWrite = deferred<void>();
    const replaceVocabularySelections = vi.fn()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const api = client({ replaceVocabularySelections });
    render(<App client={api} initialPath={`/documents/${document.id}/read`} />);
    const token = await screen.findByRole('button', { name: '国境（こっきょう）' });

    fireEvent.click(token);
    fireEvent.click(token);

    await waitFor(() => expect(replaceVocabularySelections).toHaveBeenCalledTimes(1));
    expect(replaceVocabularySelections).toHaveBeenNthCalledWith(1, document.id, [
      { lemma: '国境', reading: 'こっきょう' },
    ]);

    await act(async () => firstWrite.resolve());
    await waitFor(() => expect(replaceVocabularySelections).toHaveBeenCalledTimes(2));
    expect(replaceVocabularySelections).toHaveBeenNthCalledWith(2, document.id, []);
  });

  it('does not expose a routed snapshot for vocabulary changes before selections hydrate', async () => {
    const pendingSelections = deferred<{ lemma: string; reading: string | null }[]>();
    const replaceVocabularySelections = vi.fn().mockResolvedValue(undefined);
    const api = client({
      listVocabularySelections: vi.fn().mockReturnValue(pendingSelections.promise),
      replaceVocabularySelections,
    });
    window.history.replaceState({ document, analysis }, '', `/documents/${document.id}/read`);

    render(<App client={api} />);

    const tokenText = await screen.findByText('国境');
    fireEvent.click(tokenText);
    expect(screen.queryByRole('button', { name: '国境（こっきょう）' })).not.toBeInTheDocument();
    expect(replaceVocabularySelections).not.toHaveBeenCalled();

    await act(async () => pendingSelections.resolve([{ lemma: '国境', reading: 'こっきょう' }]));

    expect(await screen.findByRole('button', { name: '国境（こっきょう）' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('reconciles with the server when the first queued selection write fails', async () => {
    const firstWrite = deferred<void>();
    const listVocabularySelections = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const replaceVocabularySelections = vi.fn()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const api = client({ listVocabularySelections, replaceVocabularySelections });
    render(<App client={api} initialPath={`/documents/${document.id}/read`} />);
    const token = await screen.findByRole('button', { name: '国境（こっきょう）' });

    fireEvent.click(token);
    fireEvent.click(token);
    await waitFor(() => expect(replaceVocabularySelections).toHaveBeenCalledTimes(1));
    await act(async () => firstWrite.reject(new Error('network unavailable')));

    await waitFor(() => expect(replaceVocabularySelections).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(listVocabularySelections).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: '国境（こっきょう）' }))
      .toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Não foi possível salvar as marcações.')).toHaveAttribute('role', 'status');
  });

  it('restores the confirmed server selections when the last queued write fails', async () => {
    const secondWrite = deferred<void>();
    const listVocabularySelections = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ lemma: '国境', reading: 'こっきょう' }]);
    const replaceVocabularySelections = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(secondWrite.promise);
    const api = client({ listVocabularySelections, replaceVocabularySelections });
    render(<App client={api} initialPath={`/documents/${document.id}/read`} />);
    const token = await screen.findByRole('button', { name: '国境（こっきょう）' });

    fireEvent.click(token);
    fireEvent.click(token);
    await waitFor(() => expect(replaceVocabularySelections).toHaveBeenCalledTimes(2));
    await act(async () => secondWrite.reject(new Error('network unavailable')));

    await waitFor(() => expect(listVocabularySelections).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: '国境（こっきょう）' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Não foi possível salvar as marcações.')).toHaveAttribute('role', 'status');
  });

  it('applies a key display preference over the global setting without reanalyzing', async () => {
    const listVocabularyDisplayPreferences = vi.fn().mockResolvedValue([
      { key: { lemma: '国境', reading: 'こっきょう' }, visibility: 'hide' as const },
    ]);
    const setVocabularyDisplayPreference = vi.fn().mockResolvedValue(undefined);
    const api = client({ listVocabularyDisplayPreferences, setVocabularyDisplayPreference });
    render(<App client={api} initialPath={`/documents/${document.id}/read`} />);

    const token = await screen.findByRole('button', { name: '国境（こっきょう）' });
    expect(screen.getByText('こっきょう')).toHaveAttribute('hidden');
    expect(api.analyze).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('document-text')).toHaveStyle({ fontSize: '24px' });

    fireEvent.click(screen.getByRole('button', { name: 'Preferências de leitura' }));
    fireEvent.change(screen.getByLabelText('Tamanho da fonte japonesa'), { target: { value: '28' } });
    expect(screen.getByTestId('document-text')).toHaveStyle({ fontSize: '28px' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exibir furigana' }));
    expect(api.analyze).toHaveBeenCalledTimes(1);

    fireEvent.contextMenu(token);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sempre mostrar furigana' }));
    await waitFor(() => expect(setVocabularyDisplayPreference).toHaveBeenCalledWith(document.id, {
      key: { lemma: '国境', reading: 'こっきょう' },
      visibility: 'show',
    }));
    await waitFor(() => expect(screen.getAllByText('こっきょう').find(
      (element) => element.tagName === 'RT',
    )).not.toHaveAttribute('hidden'));
  });

  it('disables analysis for empty content and explains how to continue', () => {
    render(<App client={client()} initialPath="/documents/new" />);

    expect(screen.getByRole('button', { name: 'Analisar e ler' })).toBeDisabled();
    expect(screen.getByText('Digite algum texto japonês para analisar.')).toBeInTheDocument();
  });
});
