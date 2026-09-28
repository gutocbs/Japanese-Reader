import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Analysis, AnalyzedToken } from '../../shared/api/client';
import { DocumentText } from './DocumentText';

const CORPUS_SIZES = [10_000, 50_000, 100_000, 250_000] as const;
const SEED = '昨日、日本語の長い文章を読みました。語彙と文脈を確認します。𠮷野家でお茶🍵を飲み、次の段落へ進みます。\n';
const VOCABULARY_KEY = '["昨日","きのう"]';

interface Fixture {
  content: string;
  analysis: Analysis;
}

function makeFixture(codePoints: number): Fixture {
  const content = Array.from(SEED.repeat(Math.ceil(codePoints / Array.from(SEED).length)))
    .slice(0, codePoints)
    .join('');
  const codePointContent = Array.from(content);
  const blocks: Analysis['blocks'] = [];
  let blockStart = 0;
  for (let index = 0; index < codePointContent.length; index += 1) {
    if (codePointContent[index] !== '\n' && index !== codePointContent.length - 1) continue;
    const blockEnd = index + 1;
    const tokens: AnalyzedToken[] = [];
    const contentEnd = codePointContent[index] === '\n' ? index : blockEnd;
    for (let tokenStart = blockStart; tokenStart < contentEnd; tokenStart += 2) {
      const tokenEnd = Math.min(tokenStart + 2, contentEnd);
      const surface = codePointContent.slice(tokenStart, tokenEnd).join('');
      const selectable = tokenStart === blockStart && surface === '昨日';
      tokens.push({
        startOffset: tokenStart,
        endOffset: tokenEnd,
        surface,
        lemma: selectable ? '昨日' : surface,
        reading: selectable ? 'きのう' : null,
        dictionaryReading: selectable ? 'きのう' : null,
        partOfSpeech: selectable
          ? ['名詞', '普通名詞', '副詞可能', '*', '*', '*']
          : ['補助記号', '一般', '*', '*', '*', '*'],
        isOutOfVocabulary: false,
        isLexical: selectable,
        vocabularyKey: selectable ? VOCABULARY_KEY : null,
        furiganaSegments: selectable
          ? [{ text: '昨日', reading: 'きのう' }]
          : [{ text: surface, reading: null }],
        hasReadingOverride: false,
      });
    }
    blocks.push({ startOffset: blockStart, endOffset: blockEnd, tokens });
    blockStart = blockEnd;
  }

  return {
    content,
    analysis: {
      documentId: '00000000-0000-0000-0000-000000000014',
      documentRevision: 1,
      contentHash: `performance-${codePoints}`,
      metadata: {
        analyzerName: 'performance-fixture',
        analyzerVersion: '1',
        dictionaryName: 'performance-fixture',
        dictionaryVersion: '1',
        splitMode: 'B',
      },
      analysisOptions: { splitMode: 'B' },
      blocks,
      diagnostics: [],
    },
  };
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function SelectionHarness({ fixture }: { fixture: Fixture }) {
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <DocumentText
      content={fixture.content}
      analysis={fixture.analysis}
      selectedKeys={selectedKeys}
      onToggleVocabulary={toggle}
    />
  );
}

describe('large-document reader performance', () => {
  it('measures semantic render and set-key toggle across progressive corpora', () => {
    const measurements: Array<Record<string, number>> = [];

    for (const codePoints of CORPUS_SIZES) {
      const fixture = makeFixture(codePoints);
      const renderSamples: number[] = [];
      const toggleSamples: number[] = [];
      let lastTokenCount = 0;
      let lastBlockCount = 0;

      for (let run = 0; run < 1; run += 1) {
        const renderStarted = performance.now();
        const view = render(<SelectionHarness fixture={fixture} />);
        renderSamples.push(performance.now() - renderStarted);

        const reader = view.getByTestId('document-text');
        const tokens = reader.querySelectorAll<HTMLElement>('.reader-token');
        const selectableTokens = reader.querySelectorAll<HTMLElement>(
          '.reader-token[data-lexical="true"]',
        );
        lastTokenCount = tokens.length;
        lastBlockCount = fixture.analysis.blocks.length;
        expect(tokens.length).toBeGreaterThan(0);
        expect(selectableTokens.length).toBeGreaterThan(0);
        expect(reader.querySelector('canvas, svg, img')).toBeNull();
        expect(reader.querySelectorAll('ruby > rt')).toHaveLength(selectableTokens.length);

        const toggleStarted = performance.now();
        fireEvent.click(selectableTokens[0]);
        toggleSamples.push(performance.now() - toggleStarted);
        expect(selectableTokens[0]).toHaveAttribute('aria-pressed', 'true');
        expect(selectableTokens[selectableTokens.length - 1]).toHaveAttribute(
          'aria-pressed',
          'true',
        );

        if (run === 0) {
          const baseText = reader.cloneNode(true) as HTMLElement;
          baseText.querySelectorAll('rt').forEach((reading) => reading.remove());
          expect(baseText.textContent).toBe(fixture.content);
        }
        view.unmount();
      }

      measurements.push({
        codePoints,
        blocks: lastBlockCount,
        tokens: lastTokenCount,
        renderMedianMs: Number(median(renderSamples).toFixed(3)),
        toggleMedianMs: Number(median(toggleSamples).toFixed(3)),
      });
    }

    process.stdout.write(`READER_PERFORMANCE ${JSON.stringify(measurements)}\n`);
  }, 240_000);
});
