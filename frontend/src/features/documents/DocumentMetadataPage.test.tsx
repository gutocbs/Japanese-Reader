import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Analysis, Document, DocumentClient } from '../../shared/api/client';
import { App } from '../../app/App';
import { tagColorForName } from './tags';

const document: Document = {
  id: '00000000-0000-0000-0000-000000000001',
  title: '雪国',
  content: '国境の長いトンネルを抜けると雪国であった。',
  description: 'Notas originais',
  tags: [{ name: 'Clássico', color: '#7C3AED' }],
  revision: 1,
  createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-27T00:00:00Z',
  lastReadAt: null,
};

function client(overrides: Partial<DocumentClient> = {}): DocumentClient {
  return {
    list: vi.fn().mockResolvedValue([document]),
    create: vi.fn().mockResolvedValue(document),
    get: vi.fn().mockResolvedValue(document),
    update: vi.fn().mockResolvedValue(document),
    delete: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockResolvedValue({} as Analysis),
    listVocabularySelections: vi.fn().mockResolvedValue([]),
    replaceVocabularySelections: vi.fn().mockResolvedValue(undefined),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]),
    setVocabularyDisplayPreference: vi.fn().mockResolvedValue(undefined),
    setReadingOverride: vi.fn().mockResolvedValue({
      documentId: document.id, documentRevision: 1, startOffset: 0, endOffset: 2, reading: 'こっきょう',
    }),
    deleteReadingOverride: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('document metadata route', () => {
  it('shows a loading state before rendering read-only dates and editable metadata', async () => {
    let resolve!: (value: Document) => void;
    const pending = new Promise<Document>((done) => { resolve = done; });
    render(<App client={client({ get: vi.fn().mockReturnValue(pending) })} initialPath={`/documents/${document.id}/metadata`} />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando metadados…');
    resolve(document);

    expect(await screen.findByRole('heading', { name: 'Metadados do documento' })).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('Notas originais');
    expect(screen.getByLabelText('Criado em')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Atualizado em')).toHaveAttribute('readonly');
  });

  it('saves an edited description and a new tag through the document update contract', async () => {
    const updated = { ...document, description: 'Notas revistas', tags: [...document.tags, { name: 'N1', color: '#7C3AED' }] };
    const update = vi.fn().mockResolvedValue(updated);
    render(<App client={client({ update })} initialPath={`/documents/${document.id}/metadata`} />);

    const description = await screen.findByLabelText('Descrição');
    fireEvent.change(description, { target: { value: 'Notas revistas' } });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'N1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar etiqueta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(document.id, {
      description: 'Notas revistas',
      tags: [{ name: 'Clássico', color: '#7C3AED' }, { name: 'N1', color: tagColorForName('N1') }],
    }));
    expect(await screen.findByText('Metadados salvos.')).toBeInTheDocument();
  });

  it('discards unsaved edits when cancelling back to the library', async () => {
    const update = vi.fn();
    render(<App client={client({ update })} initialPath={`/documents/${document.id}/metadata`} />);

    fireEvent.change(await screen.findByLabelText('Descrição'), { target: { value: 'Não salvar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('offers a retry when metadata loading fails', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(document);
    render(<App client={client({ get })} initialPath={`/documents/${document.id}/metadata`} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os metadados.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByLabelText('Descrição')).toHaveValue('Notas originais');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('keeps edits available after a save error and offers a retry', async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(document);
    render(<App client={client({ update })} initialPath={`/documents/${document.id}/metadata`} />);

    const description = await screen.findByLabelText('Descrição');
    fireEvent.change(description, { target: { value: 'Não perder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar os metadados.');
    expect(description).toHaveValue('Não perder');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  });

  it('selects an existing catalogue tag with its color preview and offers compact labelled removal', async () => {
    const catalog = [...document.tags, { name: 'Gramática', color: '#0F766E' }];
    render(<App client={client({ listTags: vi.fn().mockResolvedValue(catalog) })} initialPath={`/documents/${document.id}/metadata`} />);

    await screen.findByRole('heading', { name: 'Metadados do documento' });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar etiqueta Gramática' }));

    expect(screen.getByLabelText('Etiqueta Gramática')).toHaveStyle({ '--tag-color': '#0F766E' });
    const remove = screen.getByRole('button', { name: 'Remover etiqueta Gramática' });
    expect(remove).toHaveTextContent('×');
    expect(remove).toHaveAttribute('title', 'Remover etiqueta Gramática');
  });
});
