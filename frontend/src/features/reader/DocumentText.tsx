import { Fragment, type ReactNode } from 'react';
import type { Analysis } from '../../shared/api/client';
import { Token } from './Token';
import { resolveFuriganaVisibility, type FuriganaVisibility } from './preferences';

interface DocumentTextProps {
  content: string;
  analysis: Analysis;
  selectedKeys?: ReadonlySet<string>;
  onToggleVocabulary?: (key: string) => void;
  showFurigana?: boolean;
  fontSizePx?: number;
  furiganaVisibilityByKey?: ReadonlyMap<string, FuriganaVisibility>;
  onSetFuriganaVisibility?: (key: string, visibility: FuriganaVisibility) => void;
}

export function DocumentText({
  content,
  analysis,
  selectedKeys = new Set(),
  onToggleVocabulary,
  showFurigana = true,
  fontSizePx,
  furiganaVisibilityByKey = new Map(),
  onSetFuriganaVisibility,
}: DocumentTextProps) {
  const codePoints = [...content];
  const rendered: ReactNode[] = [];
  let cursor = 0;

  const appendGap = (end: number, key: string) => {
    if (end > cursor) {
      rendered.push(
        <Fragment key={key}>{codePoints.slice(cursor, end).join('')}</Fragment>,
      );
    }
    cursor = end;
  };

  analysis.blocks.forEach((block, blockIndex) => {
    appendGap(block.startOffset, `before-block:${blockIndex}`);

    block.tokens.forEach((token, tokenIndex) => {
      appendGap(token.startOffset, `before-token:${blockIndex}:${tokenIndex}`);
      rendered.push(
        <Token
          key={`token:${blockIndex}:${tokenIndex}:${token.startOffset}`}
          token={token}
          selected={token.vocabularyKey !== null && selectedKeys.has(token.vocabularyKey)}
          onToggleVocabulary={onToggleVocabulary}
          furiganaVisible={resolveFuriganaVisibility(
            token.vocabularyKey === null
              ? 'inherit'
              : furiganaVisibilityByKey.get(token.vocabularyKey) ?? 'inherit',
            showFurigana,
          )}
          onSetFuriganaVisibility={onSetFuriganaVisibility}
        />,
      );
      cursor = token.endOffset;
    });

    appendGap(block.endOffset, `after-block:${blockIndex}`);
  });

  appendGap(codePoints.length, 'after-document');

  return (
    <div
      className="document-text"
      data-testid="document-text"
      style={fontSizePx === undefined ? undefined : { fontSize: `${fontSizePx}px` }}
    >
      {rendered}
    </div>
  );
}
