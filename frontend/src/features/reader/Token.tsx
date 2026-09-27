import { Fragment } from 'react';
import type { AnalyzedToken } from '../../shared/api/client';

interface TokenProps {
  token: AnalyzedToken;
}

export function Token({ token }: TokenProps) {
  return (
    <span className="reader-token" data-lexical={token.isLexical || undefined}>
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
