import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { ApiError, type Analysis, type Document, type DocumentClient } from '../../shared/api/client';

const document: Document = {
  id: '00000000-0000-0000-0000-000000000001', title: '雪国', content: '国境', description: null,
  tags: [], revision: 1, createdAt: '2026-09-26T00:00:00Z', updatedAt: '2026-09-26T00:00:00Z', lastReadAt: null,
};

function client(createTag: DocumentClient['createTag']): DocumentClient {
  return {
    list: vi.fn().mockResolvedValue([document]), create: vi.fn().mockResolvedValue(document),
    get: vi.fn().mockResolvedValue(document), update: vi.fn().mockResolvedValue(document),
    delete: vi.fn().mockResolvedValue(undefined), analyze: vi.fn().mockResolvedValue({} as Analysis),
    listTags: vi.fn().mockResolvedValue([]), createTag,
    listVocabularySelections: vi.fn().mockResolvedValue([]), replaceVocabularySelections: vi.fn().mockResolvedValue(undefined),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]), setVocabularyDisplayPreference: vi.fn().mockResolvedValue(undefined),
    setReadingOverride: vi.fn(), deleteReadingOverride: vi.fn(),
  };
}

describe('tag creation errors', () => {
  it('reserves the duplicate message for conflicts, not validation errors', async () => {
    const createTag = vi.fn()
      .mockRejectedValueOnce(new ApiError(409, 'Tag already exists'))
      .mockRejectedValueOnce(new ApiError(422, { detail: 'invalid color' }));
    render(<App client={client(createTag)} initialPath="/tags" />);

    await screen.findByRole('heading', { name: 'Etiquetas' });
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Leitura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa etiqueta já existe.');

    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Outra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar etiqueta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível criar a etiqueta.');
  });
});
