import { Fragment, type ReactNode } from 'react';
import type { Analysis } from '../../shared/api/client';
import { Token } from './Token';

interface DocumentTextProps {
  content: string;
  analysis: Analysis;
}

export function DocumentText({ content, analysis }: DocumentTextProps) {
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
        />,
      );
      cursor = token.endOffset;
    });

    appendGap(block.endOffset, `after-block:${blockIndex}`);
  });

  appendGap(codePoints.length, 'after-document');

  return (
    <div className="document-text" data-testid="document-text">
      {rendered}
    </div>
  );
}
