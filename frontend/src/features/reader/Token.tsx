import { Fragment, useEffect, useRef, useState } from 'react';
import type { AnalyzedToken } from '../../shared/api/client';
import type { FuriganaVisibility } from './preferences';
import { TokenContextMenu } from './TokenContextMenu';

interface TokenProps {
  token: AnalyzedToken;
  selected?: boolean;
  onToggleVocabulary?: (key: string) => void;
  furiganaVisible?: boolean;
  onSetFuriganaVisibility?: (key: string, visibility: FuriganaVisibility) => void;
}

export function Token({
  token,
  selected = false,
  onToggleVocabulary,
  furiganaVisible = true,
  onSetFuriganaVisibility,
}: TokenProps) {
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const tokenRef = useRef<HTMLSpanElement>(null);
  const isInteractive = token.vocabularyKey !== null && onToggleVocabulary !== undefined;
  const supportsContextMenu = token.isLexical
    && token.vocabularyKey !== null
    && onSetFuriganaVisibility !== undefined;
  const isFocusable = isInteractive || supportsContextMenu;
  const accessibleReading = token.dictionaryReading ?? token.reading ?? 'sem leitura';
  const toggle = () => {
    if (token.vocabularyKey !== null) onToggleVocabulary?.(token.vocabularyKey);
  };

  const closeContextMenu = () => {
    setIsContextMenuOpen(false);
    tokenRef.current?.focus();
  };

  useEffect(() => {
    if (!isContextMenuOpen) return undefined;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!tokenRef.current?.contains(event.target as Node)) closeContextMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  });

  return (
    <span
      ref={tokenRef}
      className="reader-token"
      data-lexical={token.isLexical || undefined}
      data-selected={selected || undefined}
      role={isFocusable ? 'button' : undefined}
      tabIndex={isFocusable ? 0 : undefined}
      aria-label={isFocusable ? `${token.surface}（${accessibleReading}）` : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      aria-haspopup={supportsContextMenu ? 'menu' : undefined}
      onClick={isInteractive ? toggle : undefined}
      onKeyDown={isFocusable ? (event) => {
        if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          toggle();
        }
        if (supportsContextMenu && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
          event.preventDefault();
          setIsContextMenuOpen(true);
        }
        if (supportsContextMenu && event.key === 'Escape') {
          event.preventDefault();
          closeContextMenu();
        }
      } : undefined}
      onContextMenu={supportsContextMenu ? (event) => {
        event.preventDefault();
        event.currentTarget.focus();
        setIsContextMenuOpen(true);
      } : undefined}
    >
      {token.furiganaSegments.length === 0
        ? token.surface
        : token.furiganaSegments.map((segment, index) => (
            <Fragment key={`${index}:${segment.text}`}>
              {segment.reading === null ? segment.text : (
                <ruby>
                  {segment.text}
                  <rt hidden={!furiganaVisible}>{segment.reading}</rt>
                </ruby>
              )}
            </Fragment>
      ))}
      {isContextMenuOpen && token.vocabularyKey !== null && onSetFuriganaVisibility && (
        <TokenContextMenu
          onClose={closeContextMenu}
          onSetVisibility={(visibility) => onSetFuriganaVisibility(token.vocabularyKey!, visibility)}
        />
      )}
    </span>
  );
}
