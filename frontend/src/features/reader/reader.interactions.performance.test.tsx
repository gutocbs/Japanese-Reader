import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Analysis, AnalyzedToken, DocumentTag } from '../../shared/api/client';
import { DocumentText } from './DocumentText';
import { ReaderTagsPopup } from './ReaderTagsPopup';

const RUNS = 3;
const TOKEN_COUNT = 2_000;

function fixture(): { content: string; analysis: Analysis } {
  const surface = '日本語。';
  const content = surface.repeat(TOKEN_COUNT);
  const tokens: AnalyzedToken[] = Array.from({ length: TOKEN_COUNT }, (_, index) => {
    const startOffset = index * surface.length;
    return {
      startOffset,
      endOffset: startOffset + surface.length,
      surface,
      lemma: '日本語',
      reading: 'にほんご',
      dictionaryReading: 'にほんご',
      partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
      isOutOfVocabulary: false,
      isLexical: true,
      vocabularyKey: '["日本語","にほんご"]',
      furiganaSegments: [
        { text: '日本語', reading: 'にほんご' },
        { text: '。', reading: null },
      ],
      hasReadingOverride: false,
    };
  });
  return {
    content,
    analysis: {
      documentId: '00000000-0000-0000-0000-000000000017',
      documentRevision: 1,
      contentHash: 'interaction-fixture',
      metadata: {
        analyzerName: 'fixture', analyzerVersion: '1', dictionaryName: 'fixture',
        dictionaryVersion: '1', splitMode: 'B',
      },
      analysisOptions: { splitMode: 'B' },
      blocks: [{ startOffset: 0, endOffset: content.length, tokens }],
      diagnostics: [],
    },
  };
}

function FuriganaHarness() {
  const measured = fixture();
  const [showFurigana, setShowFurigana] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShowFurigana((current) => !current)}>
        Toggle furigana
      </button>
      <DocumentText
        content={measured.content}
        analysis={measured.analysis}
        showFurigana={showFurigana}
      />
    </>
  );
}

function median(samples: number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return Number(ordered[Math.floor(ordered.length / 2)].toFixed(3));
}

describe('reader interaction performance', () => {
  it('measures furigana visibility updates and reader tag popup work', async () => {
    const furiganaSamples: number[] = [];
    const tagOpenSamples: number[] = [];
    const tagAssignSamples: number[] = [];
    const catalog: DocumentTag[] = Array.from({ length: 250 }, (_, index) => ({
      name: `Tag ${String(index).padStart(3, '0')}`,
      color: '#0F766E',
    }));

    for (let run = 0; run < RUNS; run += 1) {
      const reader = render(<FuriganaHarness />);
      expect(document.querySelectorAll('rt:not([hidden])')).toHaveLength(TOKEN_COUNT);
      const furiganaStarted = performance.now();
      fireEvent.click(screen.getByRole('button', { name: 'Toggle furigana' }));
      expect(document.querySelectorAll('rt[hidden]')).toHaveLength(TOKEN_COUNT);
      furiganaSamples.push(performance.now() - furiganaStarted);
      reader.unmount();

      const save = vi.fn().mockResolvedValue(undefined);
      const popup = render(
        <ReaderTagsPopup
          tags={[{ name: 'Current', color: '#7C3AED' }]}
          loadCatalog={vi.fn().mockResolvedValue(catalog)}
          onSaveTags={save}
          onCreateTag={vi.fn()}
        />,
      );
      const openStarted = performance.now();
      fireEvent.click(screen.getByRole('button', { name: 'Etiquetas do documento' }));
      await screen.findByRole('button', { name: 'Selecionar etiqueta Tag 249' });
      tagOpenSamples.push(performance.now() - openStarted);

      const assignStarted = performance.now();
      fireEvent.click(screen.getByRole('button', { name: 'Selecionar etiqueta Tag 249' }));
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      tagAssignSamples.push(performance.now() - assignStarted);
      popup.unmount();
    }

    process.stdout.write(`READER_INTERACTIONS_PERFORMANCE ${JSON.stringify({
      tokens: TOKEN_COUNT,
      catalogTags: catalog.length,
      runs: RUNS,
      furiganaMedianMs: median(furiganaSamples),
      furiganaSamplesMs: furiganaSamples.map((sample) => Number(sample.toFixed(3))),
      tagOpenMedianMs: median(tagOpenSamples),
      tagOpenSamplesMs: tagOpenSamples.map((sample) => Number(sample.toFixed(3))),
      tagAssignMedianMs: median(tagAssignSamples),
      tagAssignSamplesMs: tagAssignSamples.map((sample) => Number(sample.toFixed(3))),
    })}\n`);
  }, 120_000);
});
