import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReaderMenu } from './ReaderMenu';

describe('ReaderMenu', () => {
  it('exposes the reading controls directly in the left rail without a preferences dialog', () => {
    const onPreferencesChange = vi.fn();
    render(
      <ReaderMenu
        preferences={{ fontSizePx: 24, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    expect(screen.getByText('24 px')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Preferências de leitura' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar tamanho da fonte japonesa' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 25, showFurigana: true });

    fireEvent.click(screen.getByRole('button', { name: 'Diminuir tamanho da fonte japonesa' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 23, showFurigana: true });

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar furigana' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 24, showFurigana: false });
  });

  it('uses a soft accent only while furigana is enabled', () => {
    const onPreferencesChange = vi.fn();
    const { rerender } = render(
      <ReaderMenu
        preferences={{ fontSizePx: 24, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    const visibleControl = screen.getByRole('button', { name: 'Ocultar furigana' });
    expect(visibleControl).toHaveAttribute('aria-pressed', 'true');
    expect(visibleControl).toHaveClass('reader-rail__furigana--active');
    expect(visibleControl).toHaveTextContent('あ');

    rerender(
      <ReaderMenu
        preferences={{ fontSizePx: 24, showFurigana: false }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    const hiddenControl = screen.getByRole('button', { name: 'Mostrar furigana' });
    expect(hiddenControl).toHaveAttribute('aria-pressed', 'false');
    expect(hiddenControl).not.toHaveClass('reader-rail__furigana--active');
    expect(hiddenControl).toHaveTextContent('あ');
  });

  it('disables font size controls at the persisted range boundaries', () => {
    const onPreferencesChange = vi.fn();
    const { rerender } = render(
      <ReaderMenu
        preferences={{ fontSizePx: 18, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

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
