import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type AnalyzedToken } from '../../shared/api/client';
import { ReadingOverrideDialog } from './ReadingOverrideDialog';


const token: AnalyzedToken = {
  startOffset: 3,
  endOffset: 5,
  surface: '昨日',
  lemma: '昨日',
  reading: 'きのう',
  dictionaryReading: 'きのう',
  partOfSpeech: ['名詞', '普通名詞', '副詞可能', '*', '*', '*'],
  isOutOfVocabulary: false,
  isLexical: true,
  vocabularyKey: '["昨日","きのう"]',
  furiganaSegments: [{ text: '昨日', reading: 'きのう' }],
  hasReadingOverride: false,
};


function renderDialog(overrides: Partial<Parameters<typeof ReadingOverrideDialog>[0]> = {}) {
  const returnFocusRef = createRef<HTMLButtonElement>();
  const onClose = vi.fn();
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onRemove = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <>
      <button ref={returnFocusRef} type="button">Abrir correção</button>
      <ReadingOverrideDialog
        token={token}
        documentRevision={1}
        returnFocusRef={returnFocusRef}
        onClose={onClose}
        onSave={onSave}
        onRemove={onRemove}
        {...overrides}
      />
    </>,
  );
  return { onClose, onSave, onRemove, returnFocusRef, ...view };
}


describe('ReadingOverrideDialog', () => {
  it('shows the surface and current effective reading, then saves this occurrence only', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSave });

    expect(screen.getByRole('dialog', { name: 'Corrigir leitura de 昨日' }))
      .toHaveTextContent('Leitura atual: きのう');
    expect(screen.getByRole('checkbox', { name: 'Aplicar a todas as ocorrências desta palavra' }))
      .not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Nova leitura em kana'), {
      target: { value: 'さくじつ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      documentRevision: 1,
      startOffset: 3,
      endOffset: 5,
      scope: 'local',
      reading: 'さくじつ',
    }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves a valid vocabulary-scoped correction immediately with the token vocabulary key', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSave });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Aplicar a todas as ocorrências desta palavra',
    }));
    fireEvent.change(screen.getByLabelText('Nova leitura em kana'), {
      target: { value: 'さくじつ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      documentRevision: 1,
      startOffset: 3,
      endOffset: 5,
      scope: 'vocabulary',
      vocabularyKey: '["昨日","きのう"]',
      reading: 'さくじつ',
    }));
  });

  it('keeps the kana validation message next to the reading field for the known API error', async () => {
    renderDialog({
      onSave: vi.fn().mockRejectedValue(new ApiError(422, {
        type: 'about:blank', title: 'Validation error', status: 422,
        detail: 'Reading must contain kana only',
      })),
    });

    fireEvent.change(screen.getByLabelText('Nova leitura em kana'), {
      target: { value: '昨日' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Não foi possível salvar. Use apenas kana.');
    expect(screen.getByLabelText('Nova leitura em kana')).toHaveAttribute(
      'aria-describedby',
      error.id,
    );
  });

  it('offers removal only for an occurrence that currently has an override', async () => {
    const withoutOverride = renderDialog();
    expect(screen.queryByRole('button', { name: 'Remover correção' })).not.toBeInTheDocument();
    withoutOverride.unmount();

    const onRemove = vi.fn().mockResolvedValue(undefined);
    renderDialog({ token: { ...token, hasReadingOverride: true }, onRemove });
    fireEvent.click(screen.getByRole('button', { name: 'Remover correção' }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith({
      documentRevision: 1,
      startOffset: 3,
      endOffset: 5,
      scope: 'local',
    }));
  });

  it('shows the API error detail instead of attributing a global failure to kana validation', async () => {
    renderDialog({
      onSave: vi.fn().mockRejectedValue(new ApiError(409, {
        type: 'urn:japanese-reader:stale-reading-override-revision',
        title: 'Conflict', status: 409,
        detail: 'Reading override revision is stale',
      })),
    });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Aplicar a todas as ocorrências desta palavra',
    }));
    fireEvent.change(screen.getByLabelText('Nova leitura em kana'), {
      target: { value: 'さくじつ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Reading override revision is stale',
    );
  });

  it('removes all matching vocabulary overrides immediately when global scope is selected', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onRemove = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      token: { ...token, hasReadingOverride: true },
      onRemove,
    });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Aplicar a todas as ocorrências desta palavra',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover correção' }));

    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith({
      documentRevision: 1,
      startOffset: 3,
      endOffset: 5,
      scope: 'vocabulary',
      vocabularyKey: '["昨日","きのう"]',
    }));
  });

  it('closes on Escape and restores focus to the invoking control', () => {
    const { onClose, returnFocusRef } = renderDialog();
    const input = screen.getByLabelText('Nova leitura em kana');
    expect(input).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
    expect(returnFocusRef.current).toHaveFocus();
  });

  it('does not allow Cancel or Escape while a save is in progress', () => {
    const pendingSave = new Promise<void>(() => undefined);
    const { onClose } = renderDialog({
      onSave: vi.fn().mockReturnValue(pendingSave),
    });
    fireEvent.change(screen.getByLabelText('Nova leitura em kana'), {
      target: { value: 'さくじつ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
