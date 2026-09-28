import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { Analysis, Document, DocumentClient } from '../../shared/api/client';

const firstDocument: Document = {
  id: '00000000-0000-0000-0000-000000000001',
  title: '雪国',
  content: '国境の長いトンネルを抜けると雪国であった。',
  revision: 1,
  createdAt: '2026-09-24T12:00:00Z',
  updatedAt: '2026-09-24T12:00:00Z',
  lastReadAt: '2026-09-26T12:00:00Z',
};

const secondDocument: Document = {
  ...firstDocument,
  id: '00000000-0000-0000-0000-000000000002',
  title: 'こころ',
  content: '私はその人を常に先生と呼んでいた。',
  createdAt: '2026-09-25T12:00:00Z',
  updatedAt: '2026-09-25T12:00:00Z',
  lastReadAt: '2026-09-27T12:00:00Z',
};

const unreadDocument: Document = {
  ...firstDocument,
  id: '00000000-0000-0000-0000-000000000003',
  title: '未読',
  content: 'まだ読んでいない。',
  lastReadAt: null,
};

const analysis: Analysis = {
  documentId: firstDocument.id,
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
    create: vi.fn().mockResolvedValue(firstDocument),
    get: vi.fn().mockResolvedValue(firstDocument),
    update: vi.fn().mockResolvedValue(firstDocument),
    delete: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockResolvedValue(analysis),
    listVocabularySelections: vi.fn().mockResolvedValue([]),
    replaceVocabularySelections: vi.fn().mockResolvedValue(undefined),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]),
    setVocabularyDisplayPreference: vi.fn().mockResolvedValue(undefined),
    setReadingOverride: vi.fn().mockResolvedValue({
      documentId: firstDocument.id,
      documentRevision: 1,
      startOffset: 0,
      endOffset: 1,
      reading: 'ゆき',
    }),
    deleteReadingOverride: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('document library flows', () => {
  it('shows the volatile empty library and a path to create the first document', async () => {
    render(<App client={client()} initialPath="/" />);

    expect(await screen.findByRole('heading', { name: 'Biblioteca', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Nenhum documento na biblioteca.')).toBeInTheDocument();
    expect(screen.getByText(/documentos serão perdidos ao reiniciar o servidor/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo documento' })).toHaveAttribute(
      'href', '/documents/new',
    );
  });

  it('orders documents by last reading time and leaves unread documents last', async () => {
    const api = client({
      list: vi.fn().mockResolvedValue([unreadDocument, firstDocument, secondDocument]),
    });
    render(<App client={api} initialPath="/" />);

    const list = await screen.findByRole('list', { name: 'Documentos' });
    const titles = within(list).getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(['こころ', '雪国', '未読']);
  });

  it('navigates to creation and preserves the draft when returning through history', async () => {
    render(<App client={client()} initialPath="/" />);
    fireEvent.click(await screen.findByRole('link', { name: 'Novo documento' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho' } });
    fireEvent.change(screen.getByLabelText('Texto japonês'), { target: { value: '下書きの本文' } });
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à biblioteca' }));

    expect(await screen.findByRole('heading', { name: 'Biblioteca', level: 1 })).toBeInTheDocument();
    act(() => window.history.back());

    expect(await screen.findByLabelText('Título')).toHaveValue('Rascunho');
    expect(screen.getByLabelText('Texto japonês')).toHaveValue('下書きの本文');
  });

  it('opens a document in the reader and exposes the edit route from the library', async () => {
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument]) });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });

    expect(within(row).getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href', `/documents/${firstDocument.id}/edit`,
    );
    fireEvent.click(within(row).getByRole('link', { name: 'Abrir' }));

    expect(await screen.findByRole('heading', { name: '雪国', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/documents/${firstDocument.id}/read`);
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à biblioteca' }));
    expect(await screen.findByRole('heading', { name: 'Biblioteca', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('renames a document and keeps the editor available for content changes', async () => {
    const renamed = { ...firstDocument, title: '雪国 改題' };
    const update = vi.fn().mockResolvedValue(renamed);
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument]), update });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });
    fireEvent.click(within(row).getByRole('button', { name: 'Renomear' }));
    fireEvent.change(screen.getByLabelText('Novo título de 雪国'), {
      target: { value: renamed.title },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));

    expect(await screen.findByRole('listitem', { name: renamed.title })).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith(firstDocument.id, { title: renamed.title });
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href', `/documents/${firstDocument.id}/edit`,
    );
  });

  it('requires confirmation and keeps the row until deletion succeeds', async () => {
    const pendingDelete = deferred<void>();
    const deleteDocument = vi.fn().mockReturnValue(pendingDelete.promise);
    const api = client({
      list: vi.fn().mockResolvedValue([firstDocument]),
      delete: deleteDocument,
    });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });
    const deleteButton = within(row).getByRole('button', { name: 'Excluir' });
    fireEvent.click(deleteButton);
    const dialog = screen.getByRole('dialog', { name: 'Excluir documento' });
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancelar' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Excluir definitivamente' });

    expect(within(dialog).getByText(/雪国/)).toBeInTheDocument();
    expect(cancelButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancelButton).toHaveFocus();
    fireEvent.click(cancelButton);
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(deleteButton).toHaveFocus();

    fireEvent.click(deleteButton);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Excluir documento' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Excluir documento' })).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith(firstDocument.id));
    expect(screen.getByRole('listitem', { name: '雪国' })).toBeInTheDocument();

    await act(async () => pendingDelete.resolve());
    await waitFor(() => {
      expect(screen.queryByRole('listitem', { name: '雪国' })).not.toBeInTheDocument();
    });
  });

  it('keeps the document and offers another delete attempt after an error', async () => {
    const deleteDocument = vi.fn().mockRejectedValueOnce(new Error('network unavailable'));
    const api = client({
      list: vi.fn().mockResolvedValue([firstDocument]),
      delete: deleteDocument,
    });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });
    fireEvent.click(within(row).getByRole('button', { name: 'Excluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível excluir o documento.',
    );
    expect(screen.getByRole('listitem', { name: '雪国' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar excluir novamente' })).toBeInTheDocument();
  });

  it('recovers from a list error without losing the library route', async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([firstDocument]);
    render(<App client={client({ list })} initialPath="/" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a biblioteca.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('listitem', { name: '雪国' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
