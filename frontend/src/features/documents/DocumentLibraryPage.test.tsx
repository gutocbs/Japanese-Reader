import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { Analysis, Document, DocumentClient } from '../../shared/api/client';

const firstDocument: Document = {
  id: '00000000-0000-0000-0000-000000000001',
  title: '雪国',
  content: '国境の長いトンネルを抜けると雪国であった。',
  description: null,
  tags: [],
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

const titledDocument: Document = {
  ...firstDocument,
  id: '00000000-0000-0000-0000-000000000004',
  title: 'O SOL também nasce',
  lastReadAt: '2026-09-28T12:00:00Z',
};

const orderingDocuments: Document[] = [
  {
    ...firstDocument,
    id: '00000000-0000-0000-0000-000000000010',
    title: 'Beta',
    createdAt: '2026-09-26T12:00:00Z',
    updatedAt: '2026-09-29T12:00:00Z',
    lastReadAt: '2026-09-28T12:00:00Z',
  },
  {
    ...firstDocument,
    id: '00000000-0000-0000-0000-000000000020',
    title: 'Alfa',
    createdAt: '2026-09-24T12:00:00Z',
    updatedAt: '2026-09-27T12:00:00Z',
    lastReadAt: '2026-09-26T12:00:00Z',
  },
  {
    ...firstDocument,
    id: '00000000-0000-0000-0000-000000000030',
    title: 'Gama',
    createdAt: '2026-09-25T12:00:00Z',
    updatedAt: '2026-09-28T12:00:00Z',
    lastReadAt: null,
  },
];

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

function libraryTitles() {
  const list = screen.getByRole('list', { name: 'Documentos' });
  return within(list).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('document library flows', () => {
  it('shows the durable empty library and a path to create the first document', async () => {
    render(<App client={client()} initialPath="/" />);

    expect(await screen.findByRole('heading', { name: 'Biblioteca', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Nenhum documento na biblioteca.')).toBeInTheDocument();
    expect(screen.queryByText(/documentos serão perdidos ao reiniciar o servidor/i)).not.toBeInTheDocument();
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

  it('orders documents by title in ascending and descending directions', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue(orderingDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'asc' } });
    expect(libraryTitles()).toEqual(['Alfa', 'Beta', 'Gama']);

    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'desc' } });
    expect(libraryTitles()).toEqual(['Gama', 'Beta', 'Alfa']);
  });

  it('orders documents by creation date in ascending and descending directions', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue(orderingDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'createdAt' } });
    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'asc' } });
    expect(libraryTitles()).toEqual(['Alfa', 'Gama', 'Beta']);

    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'desc' } });
    expect(libraryTitles()).toEqual(['Beta', 'Gama', 'Alfa']);
  });

  it('orders documents by update date in ascending and descending directions', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue(orderingDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'updatedAt' } });
    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'asc' } });
    expect(libraryTitles()).toEqual(['Alfa', 'Gama', 'Beta']);

    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'desc' } });
    expect(libraryTitles()).toEqual(['Beta', 'Gama', 'Alfa']);
  });

  it('orders documents by last-read date in both directions and keeps unread documents last', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue(orderingDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'asc' } });
    expect(libraryTitles()).toEqual(['Alfa', 'Beta', 'Gama']);

    fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'desc' } });
    expect(libraryTitles()).toEqual(['Beta', 'Alfa', 'Gama']);
  });

  it('preserves updated-date descending as the default last-read tie-breaker', async () => {
    const equallyReadDocuments = [
      {
        ...orderingDocuments[0],
        id: '00000000-0000-0000-0000-000000000005',
        title: 'Atualizado antes',
        updatedAt: '2026-09-28T12:00:00Z',
      },
      {
        ...orderingDocuments[0],
        id: '00000000-0000-0000-0000-000000000040',
        title: 'Atualizado depois',
        updatedAt: '2026-09-29T12:00:00Z',
      },
    ];
    render(<App client={client({ list: vi.fn().mockResolvedValue(equallyReadDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    expect(libraryTitles()).toEqual(['Atualizado depois', 'Atualizado antes']);
  });

  it('preserves updated-date descending for unread documents in the default ordering', async () => {
    const unreadDocuments = [
      {
        ...orderingDocuments[2],
        id: '00000000-0000-0000-0000-000000000005',
        title: 'Não lido atualizado antes',
        updatedAt: '2026-09-28T12:00:00Z',
      },
      {
        ...orderingDocuments[2],
        id: '00000000-0000-0000-0000-000000000040',
        title: 'Não lido atualizado depois',
        updatedAt: '2026-09-29T12:00:00Z',
      },
    ];
    render(<App client={client({ list: vi.fn().mockResolvedValue(unreadDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    expect(libraryTitles()).toEqual(['Não lido atualizado depois', 'Não lido atualizado antes']);
  });

  it('uses document id as a deterministic tie-breaker for equal ordering values', async () => {
    const tiedDocuments = [
      { ...orderingDocuments[0], id: '00000000-0000-0000-0000-000000000040', title: 'Segundo' },
      { ...orderingDocuments[0], id: '00000000-0000-0000-0000-000000000005', title: 'Primeiro' },
    ];
    render(<App client={client({ list: vi.fn().mockResolvedValue(tiedDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    expect(libraryTitles()).toEqual(['Primeiro', 'Segundo']);
  });

  it('filters documents immediately by title without considering case', async () => {
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument, titledDocument, secondDocument]) });
    render(<App client={api} initialPath="/" />);

    const search = await screen.findByRole('searchbox', { name: 'Pesquisar documentos' });
    fireEvent.change(search, { target: { value: 'sol' } });

    expect(screen.getByRole('listitem', { name: titledDocument.title })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: firstDocument.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: secondDocument.title })).not.toBeInTheDocument();
  });

  it('clears the document search and restores the ordered library', async () => {
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument, titledDocument, secondDocument]) });
    render(<App client={api} initialPath="/" />);

    const search = await screen.findByRole('searchbox', { name: 'Pesquisar documentos' });
    fireEvent.change(search, { target: { value: 'sol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));

    expect(search).toHaveValue('');
    const list = screen.getByRole('list', { name: 'Documentos' });
    expect(within(list).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual([titledDocument.title, secondDocument.title, firstDocument.title]);
  });

  it('filters the library to favorite documents only', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue([firstDocument, secondDocument]) })} initialPath="/" />);

    const firstRow = await screen.findByRole('listitem', { name: firstDocument.title });
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Adicionar aos favoritos' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente favoritos' }));

    expect(screen.getByRole('listitem', { name: firstDocument.title })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: secondDocument.title })).not.toBeInTheDocument();
  });

  it('filters documents within an inclusive creation-date range', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue(orderingDocuments) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    fireEvent.change(screen.getByLabelText('Data de criação a partir de'), { target: { value: '2026-09-25' } });
    fireEvent.change(screen.getByLabelText('Data de criação até'), { target: { value: '2026-09-25' } });

    expect(libraryTitles()).toEqual(['Gama']);
  });

  it('composes title, favorite, and creation-date filters while preserving the selected ordering', async () => {
    const documents = [
      { ...firstDocument, title: 'Diário antigo', createdAt: '2026-09-24T12:00:00Z' },
      { ...secondDocument, title: 'Diário recente', createdAt: '2026-09-25T12:00:00Z' },
      { ...titledDocument, title: 'Outro texto', createdAt: '2026-09-25T12:00:00Z' },
    ];
    render(<App client={client({ list: vi.fn().mockResolvedValue(documents) })} initialPath="/" />);

    const recentRow = await screen.findByRole('listitem', { name: 'Diário recente' });
    fireEvent.click(within(recentRow).getByRole('button', { name: 'Adicionar aos favoritos' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar documentos' }), { target: { value: 'diário' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente favoritos' }));
    fireEvent.change(screen.getByLabelText('Data de criação a partir de'), { target: { value: '2026-09-25' } });

    expect(libraryTitles()).toEqual(['Diário recente']);
  });

  it('clears all library filters and restores the ordered library', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue([firstDocument, titledDocument, secondDocument]) })} initialPath="/" />);

    const firstRow = await screen.findByRole('listitem', { name: firstDocument.title });
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Adicionar aos favoritos' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar documentos' }), { target: { value: '雪' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente favoritos' }));
    fireEvent.change(screen.getByLabelText('Data de criação a partir de'), { target: { value: '2026-09-24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(screen.getByRole('searchbox', { name: 'Pesquisar documentos' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Somente favoritos' })).not.toBeChecked();
    expect(screen.getByLabelText('Data de criação a partir de')).toHaveValue('');
    expect(libraryTitles()).toEqual([titledDocument.title, secondDocument.title, firstDocument.title]);
  });

  it('shows a no-match state instead of the empty-library state', async () => {
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument]) });
    render(<App client={api} initialPath="/" />);

    fireEvent.change(await screen.findByRole('searchbox', { name: 'Pesquisar documentos' }), {
      target: { value: 'inexistente' },
    });

    expect(screen.getByText('Nenhum documento encontrado.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum documento na biblioteca.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Documentos' })).not.toBeInTheDocument();
  });

  it('explains that filters can be cleared when they produce no matches', async () => {
    render(<App client={client({ list: vi.fn().mockResolvedValue([firstDocument]) })} initialPath="/" />);

    await screen.findByRole('list', { name: 'Documentos' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente favoritos' }));

    expect(screen.getByText('Nenhum documento encontrado.')).toBeInTheDocument();
    expect(screen.getByText('Ajuste ou limpe os filtros para ver outros documentos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
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

  it('keeps the title link and exposes compact named actions with creation metadata', async () => {
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument]) });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });

    const titleLink = within(row).getByRole('link', { name: '雪国' });
    expect(titleLink).toHaveAttribute('href', `/documents/${firstDocument.id}/read`);
    expect(within(row).getByText(`Adicionado em ${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(firstDocument.createdAt))}`)).toBeInTheDocument();
    expect(within(row).queryByText(/Última leitura em/)).not.toBeInTheDocument();

    const openAction = within(row).getByRole('link', { name: 'Abrir documento' });
    const editAction = within(row).getByRole('link', { name: 'Editar documento' });
    const renameAction = within(row).getByRole('button', { name: 'Renomear documento' });
    const deleteAction = within(row).getByRole('button', { name: 'Excluir documento' });
    expect(openAction).toHaveAttribute(
      'href', `/documents/${firstDocument.id}/read`,
    );
    expect(editAction).toHaveAttribute(
      'href', `/documents/${firstDocument.id}/edit`,
    );
    expect(openAction).toHaveAttribute('title', 'Abrir documento');
    expect(editAction).toHaveAttribute('title', 'Editar documento');
    expect(renameAction).toHaveAttribute('title', 'Renomear documento');
    expect(deleteAction).toHaveAttribute('title', 'Excluir documento');
    expect(openAction.querySelector('svg[data-lucide="file-symlink"]')).toBeInTheDocument();
    expect(editAction.querySelector('svg[data-lucide="file-pen"]')).toBeInTheDocument();
    expect(deleteAction.querySelector('svg[data-lucide="trash"]')).toBeInTheDocument();
    expect(renameAction).toHaveTextContent('Aa');
    fireEvent.click(titleLink);

    expect(await screen.findByRole('heading', { name: '雪国', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/documents/${firstDocument.id}/read`);
    fireEvent.click(screen.getByRole('link', { name: 'Voltar à biblioteca' }));
    expect(await screen.findByRole('heading', { name: 'Biblioteca', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('toggles the favorite action with active and inactive accessible labels', async () => {
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument]) });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });

    const addFavorite = within(row).getByRole('button', { name: 'Adicionar aos favoritos' });
    expect(addFavorite).toHaveAttribute('title', 'Adicionar aos favoritos');
    expect(addFavorite).toHaveAttribute('aria-pressed', 'false');
    expect(addFavorite).not.toHaveClass('document-row__action--favorite-active');
    expect(addFavorite).toHaveTextContent('☆');

    fireEvent.click(addFavorite);

    const removeFavorite = within(row).getByRole('button', { name: 'Remover dos favoritos' });
    expect(removeFavorite).toHaveAttribute('title', 'Remover dos favoritos');
    expect(removeFavorite).toHaveAttribute('aria-pressed', 'true');
    expect(removeFavorite).toHaveClass('document-row__action--favorite-active');
    expect(removeFavorite).toHaveTextContent('★');
    expect(localStorage.getItem('japanese-reader:document-favorites')).toBe(JSON.stringify({
      version: 1,
      documentIds: [firstDocument.id],
    }));
  });

  it('renames a document and keeps the editor available for content changes', async () => {
    const renamed = { ...firstDocument, title: '雪国 改題' };
    const update = vi.fn().mockResolvedValue(renamed);
    const api = client({ list: vi.fn().mockResolvedValue([firstDocument]), update });
    render(<App client={api} initialPath="/" />);
    const row = await screen.findByRole('listitem', { name: '雪国' });
    fireEvent.click(within(row).getByRole('button', { name: 'Renomear documento' }));
    fireEvent.change(screen.getByLabelText('Novo título de 雪国'), {
      target: { value: renamed.title },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));

    expect(await screen.findByRole('listitem', { name: renamed.title })).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith(firstDocument.id, { title: renamed.title });
    expect(screen.getByRole('link', { name: 'Editar documento' })).toHaveAttribute(
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
    const deleteButton = within(row).getByRole('button', { name: 'Excluir documento' });
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
    fireEvent.click(within(row).getByRole('button', { name: 'Excluir documento' }));
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
