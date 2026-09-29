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
    listVocabularySelections: vi.fn().mockResolvedValue([]), replaceVocabularySelections: vi.fn().mockResolvedValue(undefined),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]), setVocabularyDisplayPreference: vi.fn().mockResolvedValue(undefined),
    setReadingOverride: vi.fn(), deleteReadingOverride: vi.fn(), ...overrides,
  };
}

describe('tag management route', () => {
  it('creates unique controlled tags, renames assigned tags, and confirms removal', async () => {
    localStorage.clear();
    const update = vi.fn().mockImplementation(async (_id, data) => ({ ...document, ...data }));
    render(<App client={client({ update })} initialPath="/tags" />);

    expect(await screen.findByRole('heading', { name: 'Etiquetas' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Gramática' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(screen.getByText('Gramática')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Renomear etiqueta Clássico' }));
    fireEvent.change(screen.getByLabelText('Novo nome para Clássico'), { target: { value: 'Literatura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar etiqueta' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(document.id, {
      tags: [{ name: 'Literatura', color: '#7C3AED' }],
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta Literatura' }));
    expect(screen.getByRole('dialog', { name: 'Remover etiqueta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta definitivamente' }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(document.id, { tags: [] }));
  });

  it('renders persistent colored tag chips below document titles in the library', async () => {
    localStorage.clear();
    render(<App client={client()} initialPath="/" />);
    const chip = await screen.findByLabelText('Etiqueta Clássico');
    expect(chip).toHaveTextContent('Clássico');
    expect(chip).toHaveStyle({ '--tag-color': '#7C3AED' });
  });
});
