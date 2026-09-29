import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReaderMenu } from './ReaderMenu';

describe('ReaderMenu', () => {
  it('changes the reader font size with accessible step controls without analyzing again', () => {
    const onPreferencesChange = vi.fn();
    render(
      <ReaderMenu
        preferences={{ fontSizePx: 24, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preferências de leitura' }));
    expect(screen.getByText('24 px')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar tamanho da fonte japonesa' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 25, showFurigana: true });

    fireEvent.click(screen.getByRole('button', { name: 'Diminuir tamanho da fonte japonesa' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 23, showFurigana: true });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Exibir furigana' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 24, showFurigana: false });
  });

  it('disables font size controls at the persisted range boundaries', () => {
    const onPreferencesChange = vi.fn();
    const { rerender } = render(
      <ReaderMenu
        preferences={{ fontSizePx: 18, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preferências de leitura' }));
    expect(screen.getByRole('button', { name: 'Diminuir tamanho da fonte japonesa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar tamanho da fonte japonesa' })).not.toBeDisabled();

    rerender(
      <ReaderMenu
        preferences={{ fontSizePx: 32, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Diminuir tamanho da fonte japonesa' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar tamanho da fonte japonesa' })).toBeDisabled();
  });
});
