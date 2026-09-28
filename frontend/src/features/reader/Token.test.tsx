import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyzedToken } from '../../shared/api/client';
import { Token } from './Token';

const lexicalToken: AnalyzedToken = {
  startOffset: 0,
  endOffset: 2,
  surface: '昨日',
  lemma: '昨日',
  reading: 'きのう',
  dictionaryReading: 'きのう',
  partOfSpeech: ['名詞', '普通名詞', '副詞可能', '*', '*', '*'],
  isOutOfVocabulary: false,
  isLexical: true,
  vocabularyKey: '["昨日","きのう"]',
  furiganaSegments: [{ text: '昨日', reading: 'きのう' }],
};

describe('Token', () => {
  it('keeps ruby bases while hiding only rt according to the resolved preference', () => {
    const { container } = render(<Token token={lexicalToken} furiganaVisible={false} />);

    const ruby = container.querySelector('ruby');
    expect(ruby?.firstChild?.textContent).toBe('昨日');
    expect(ruby?.querySelector('rt')).toHaveAttribute('hidden');
  });

  it('opens the lexical context menu with pointer or keyboard and returns focus on Escape', () => {
    const onSetFuriganaVisibility = vi.fn();
    render(
      <Token
        token={lexicalToken}
        onToggleVocabulary={vi.fn()}
        onSetFuriganaVisibility={onSetFuriganaVisibility}
      />,
    );

    const token = screen.getByRole('button', { name: '昨日（きのう）' });
    fireEvent.contextMenu(token);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sempre mostrar furigana' }));
    expect(onSetFuriganaVisibility).toHaveBeenCalledWith('["昨日","きのう"]', 'show');

    fireEvent.keyDown(token, { key: 'ContextMenu' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(token, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(token).toHaveFocus();
  });

  it('does not replace the browser context menu for non-lexical tokens', () => {
    const punctuation: AnalyzedToken = {
      ...lexicalToken,
      surface: '。',
      isLexical: false,
      vocabularyKey: null,
      furiganaSegments: [{ text: '。', reading: null }],
    };
    render(<Token token={punctuation} />);

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByText('。').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps a lexical token keyboard-accessible for its context menu without selection wiring', () => {
    render(<Token token={lexicalToken} onSetFuriganaVisibility={vi.fn()} />);

    const token = screen.getByText('昨日').closest('.reader-token')!;
    expect(token).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(token, { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes the context menu on an outside click and returns focus to its token', () => {
    render(<Token token={lexicalToken} onSetFuriganaVisibility={vi.fn()} />);

    const token = screen.getByRole('button', { name: '昨日（きのう）' });
    fireEvent.contextMenu(token);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(token).toHaveFocus();
  });
});
