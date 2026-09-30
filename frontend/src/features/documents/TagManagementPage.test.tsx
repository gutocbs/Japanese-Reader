import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { ApiError, type Analysis, type Document, type DocumentClient, type DocumentTag } from '../../shared/api/client';

const stylesheet = readFileSync(resolve(import.meta.dirname, '../../styles/global.css'), 'utf8');

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
    const chip = await screen.findByRole('button', { name: 'Pesquisar por etiqueta Clássico' });
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

  it('announces successful catalogue changes and explains document impact before deletion', async () => {
    localStorage.clear();
    const createTag = vi.fn().mockResolvedValue({ name: 'Leitura', color: '#1D4ED8' });
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Etiqueta criada.');
    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta Clássico' }));
    expect(screen.getByRole('dialog', { name: 'Remover etiqueta' })).toHaveTextContent('será removida dos documentos associados');
  });

  it('uses a custom picker color when creating a catalogue tag', async () => {
    localStorage.clear();
    const createTag = vi.fn().mockResolvedValue({ name: 'Anotações', color: '#123456' });
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Cor personalizada'), { target: { value: '#123456' } });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Anotações' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));

    await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'Anotações', color: '#123456' }));
  });

  it('prevents duplicate tag creation while saving and announces the pending state', async () => {
    localStorage.clear();
    let completeCreation: ((value: DocumentTag) => void) | undefined;
    const createTag = vi.fn(() => new Promise<DocumentTag>((resolveCreation) => { completeCreation = resolveCreation; }));
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));

    expect(screen.getByLabelText('Nova etiqueta')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Criando etiqueta…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Criando etiqueta…' }));
    expect(createTag).toHaveBeenCalledTimes(1);

    completeCreation?.({ name: 'Leitura', color: '#0F766E' });
    expect(await screen.findByRole('status')).toHaveTextContent('Etiqueta criada.');
  });

  it('replaces stale success feedback with an error when a later creation fails', async () => {
    localStorage.clear();
    const createTag = vi.fn()
      .mockResolvedValueOnce({ name: 'Leitura', color: '#0F766E' })
      .mockRejectedValueOnce(new Error('offline'));
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Etiqueta criada.');

    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Outra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível criar a etiqueta.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reports duplicate names separately from validation and other API errors', async () => {
    localStorage.clear();
    const createTag = vi.fn()
      .mockRejectedValueOnce(new ApiError(409, 'Tag already exists'))
      .mockRejectedValueOnce(new ApiError(422, { detail: 'invalid color' }));
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa etiqueta já existe.');

    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Outra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível criar a etiqueta.');
  });

  it('clears an earlier error before opening edit or delete actions', async () => {
    localStorage.clear();
    const createTag = vi.fn().mockRejectedValue(new Error('offline'));
    render(<App client={client({ createTag })} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Renomear etiqueta Clássico' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Outra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta Clássico' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves focus into the delete dialog and returns it to the trigger when dismissed with Escape', async () => {
    localStorage.clear();
    render(<App client={client()} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    const remove = screen.getByRole('button', { name: 'Remover etiqueta Clássico' });
    remove.focus();
    fireEvent.click(remove);

    const dialog = screen.getByRole('dialog', { name: 'Remover etiqueta' });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(dialog).toHaveAttribute('aria-describedby', 'remove-tag-description');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Remover etiqueta' })).not.toBeInTheDocument();
    await waitFor(() => expect(remove).toHaveFocus());
  });

  it('keeps creation controls aligned and uses themed, non-white swatch outlines and focus rings', () => {
    expect(stylesheet).toMatch(/\.tag-management-page \.metadata-tag-form input,[\s\S]*\{[\s\S]*box-sizing: border-box;[\s\S]*height: 2\.75rem;[\s\S]*min-height: 2\.75rem;[\s\S]*border: 1px solid var\(--color-border\);[\s\S]*padding: 0 var\(--space-3\);[\s\S]*line-height: 1\.2;/);
    expect(stylesheet).toMatch(/\.tag-management-page \.metadata-tag-form \.button \{[\s\S]*box-sizing: border-box;[\s\S]*height: 2\.75rem;[\s\S]*min-height: 2\.75rem;[\s\S]*padding: 0 var\(--space-3\);[\s\S]*line-height: 1\.2;/);
    expect(stylesheet).toMatch(/\.tag-color-picker__option span\[aria-hidden='true'\] \{[\s\S]*border: 1px solid color-mix\(in srgb, var\(--tag-color\) 60%, var\(--color-text\)\);/);
    expect(stylesheet).toMatch(/\.tag-color-picker__option input:checked \+ span\[aria-hidden='true'\] \{[\s\S]*outline: 3px solid var\(--color-focus\);/);
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
