import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReaderMenu } from './ReaderMenu';

describe('ReaderMenu', () => {
  it('updates the desktop font range and global furigana without analyzing again', () => {
    const onPreferencesChange = vi.fn();
    render(
      <ReaderMenu
        preferences={{ fontSizePx: 24, showFurigana: true }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preferências de leitura' }));
    const fontSize = screen.getByLabelText('Tamanho da fonte japonesa');
    expect(fontSize).toHaveAttribute('min', '18');
    expect(fontSize).toHaveAttribute('max', '32');

    fireEvent.change(fontSize, { target: { value: '28' } });
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 28, showFurigana: true });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Exibir furigana' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith({ fontSizePx: 24, showFurigana: false });
  });
});
