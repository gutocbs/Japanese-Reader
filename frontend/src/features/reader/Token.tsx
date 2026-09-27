import { Fragment } from 'react';
import type { AnalyzedToken } from '../../shared/api/client';

interface TokenProps {
  token: AnalyzedToken;
  selected?: boolean;
  onToggleVocabulary?: (key: string) => void;
}

export function Token({ token, selected = false, onToggleVocabulary }: TokenProps) {
  const isInteractive = token.vocabularyKey !== null && onToggleVocabulary !== undefined;
  const accessibleReading = token.dictionaryReading ?? token.reading ?? 'sem leitura';
  const toggle = () => {
    if (token.vocabularyKey !== null) onToggleVocabulary?.(token.vocabularyKey);
  };
  return (
    <span
      className="reader-token"
      data-lexical={token.isLexical || undefined}
      data-selected={selected || undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `${token.surface}（${accessibleReading}）` : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      onClick={isInteractive ? toggle : undefined}
      onKeyDown={isInteractive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      } : undefined}
    >
      {token.furiganaSegments.length === 0
        ? token.surface
        : token.furiganaSegments.map((segment, index) => (
            <Fragment key={`${index}:${segment.text}`}>
              {segment.reading === null ? segment.text : (
                <ruby>
                  {segment.text}
                  <rt>{segment.reading}</rt>
                </ruby>
              )}
            </Fragment>
          ))}
    </span>
  );
}
