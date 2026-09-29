import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { Analysis, Document, DocumentClient } from '../../shared/api/client';

const document: Document = {
  id: '00000000-0000-0000-0000-000000000001', title: '雪国', content: '国境', description: null,
  tags: [{ name: 'Clássico', color: '#7C3AED' }], revision: 1,
  createdAt: '2026-09-26T00:00:00Z', updatedAt: '2026-09-26T00:00:00Z', lastReadAt: null,
};

function client(overrides: Partial<DocumentClient> = {}): DocumentClient {
  return {
    list: vi.fn().mockResolvedValue([document]), create: vi.fn().mockResolvedValue(document),
    get: vi.fn().mockResolvedValue(document), update: vi.fn().mockResolvedValue(document),
    delete: vi.fn().mockResolvedValue(undefined), analyze: vi.fn().mockResolvedValue({} as Analysis),
    listTags: vi.fn().mockResolvedValue(document.tags), createTag: vi.fn().mockResolvedValue({ name: 'Gramática', color: '#0F766E' }),
    renameTag: vi.fn().mockResolvedValue(undefined), deleteTag: vi.fn().mockResolvedValue(undefined),
    listVocabularySelections: vi.fn().mockResolvedValue([]), replaceVocabularySelections: vi.fn().mockResolvedValue(undefined),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]), setVocabularyDisplayPreference: vi.fn().mockResolvedValue(undefined),
    setReadingOverride: vi.fn(), deleteReadingOverride: vi.fn(), ...overrides,
  };
}

describe('tag management route', () => {
  it('creates unique controlled tags, renames assigned tags, and confirms removal', async () => {
    localStorage.clear();
    const createTag = vi.fn().mockResolvedValue({ name: 'Gramática', color: '#0F766E' });
    const renameTag = vi.fn().mockResolvedValue(undefined);
    const deleteTag = vi.fn().mockResolvedValue(undefined);
    render(<App client={client({ createTag, renameTag, deleteTag })} initialPath="/tags" />);

    expect(await screen.findByRole('heading', { name: 'Etiquetas' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Gramática' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'Gramática', color: expect.any(String) }));

    fireEvent.click(screen.getByRole('button', { name: 'Renomear etiqueta Clássico' }));
    fireEvent.change(screen.getByLabelText('Novo nome para Clássico'), { target: { value: 'Literatura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar etiqueta' }));
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith('Clássico', 'Literatura'));

    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta Clássico' }));
    expect(screen.getByRole('dialog', { name: 'Remover etiqueta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta definitivamente' }));
    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith('Clássico'));
  });

  it('renders persistent colored tag chips below document titles in the library', async () => {
    localStorage.clear();
    render(<App client={client()} initialPath="/" />);
    const chip = await screen.findByLabelText('Etiqueta Clássico');
    expect(chip).toHaveTextContent('Clássico');
    expect(chip).toHaveStyle({ '--tag-color': '#7C3AED' });
  });

  it('previews the selected controlled color before creating a tag and exposes a compact labelled removal control', async () => {
    localStorage.clear();
    const createTag = vi.fn().mockResolvedValue({ name: 'Leitura', color: '#1D4ED8' });
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.click(screen.getByRole('radio', { name: 'Azul' }));
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });

    expect(screen.getByLabelText('Prévia da nova etiqueta')).toHaveStyle({ '--tag-color': '#1D4ED8' });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'Leitura', color: '#1D4ED8' }));
    const remove = screen.getByRole('button', { name: 'Remover etiqueta Clássico' });
    expect(remove).toHaveTextContent('×');
    expect(remove).toHaveAttribute('title', 'Remover etiqueta Clássico');
  });

  it('announces an empty catalogue with a direct creation action', async () => {
    localStorage.clear();
    render(<App client={client({ listTags: vi.fn().mockResolvedValue([]) })} initialPath="/tags" />);

    expect(await screen.findByText('Nenhuma etiqueta criada. Crie a primeira para organizar sua biblioteca.')).toHaveAttribute('role', 'status');
    expect(screen.getByLabelText('Nova etiqueta')).toBeInTheDocument();
  });

  it('retries the document query when document loading fails', async () => {
    localStorage.clear();
    const list = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([document]);
    render(<App client={client({ list })} initialPath="/tags" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Etiquetas indisponíveis');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'Etiquetas' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
