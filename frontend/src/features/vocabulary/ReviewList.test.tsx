import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Analysis } from '../../shared/api/client';
import { DocumentText } from '../reader/DocumentText';
import {
  orderedVocabularyEntries,
  ReviewList,
  serializeVocabularyEntries,
} from './ReviewList';

const CAT_KEY = '["猫","ねこ"]';
const DOG_KEY = '["犬","いぬ"]';

const analysis: Analysis = {
  documentId: '00000000-0000-0000-0000-000000000001',
  documentRevision: 1,
  contentHash: 'hash',
  metadata: {
    analyzerName: 'SudachiPy', analyzerVersion: '0.6.11',
    dictionaryName: 'SudachiDict-core', dictionaryVersion: '20250825', splitMode: 'B',
  },
  analysisOptions: { splitMode: 'B' },
  blocks: [{
    startOffset: 0,
    endOffset: 3,
    tokens: [
      {
        startOffset: 0, endOffset: 1, surface: '犬', lemma: '犬', reading: 'いぬ',
        dictionaryReading: 'いぬ', partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
        isOutOfVocabulary: false, isLexical: true, vocabularyKey: DOG_KEY,
        furiganaSegments: [{ text: '犬', reading: 'いぬ' }],
        hasReadingOverride: false,
      },
      {
        startOffset: 1, endOffset: 2, surface: '猫', lemma: '猫', reading: 'ねこ',
        dictionaryReading: 'ねこ', partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
        isOutOfVocabulary: false, isLexical: true, vocabularyKey: CAT_KEY,
        furiganaSegments: [{ text: '猫', reading: 'ねこ' }],
        hasReadingOverride: false,
      },
      {
        startOffset: 2, endOffset: 3, surface: '犬', lemma: '犬', reading: 'いぬ',
        dictionaryReading: 'いぬ', partOfSpeech: ['名詞', '普通名詞', '一般', '*', '*', '*'],
        isOutOfVocabulary: false, isLexical: true, vocabularyKey: DOG_KEY,
        furiganaSegments: [{ text: '犬', reading: 'いぬ' }],
        hasReadingOverride: false,
      },
    ],
  }],
  diagnostics: [],
};

describe('ReviewList', () => {
  it('uses first-occurrence display order and deterministic TSV copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const entries = orderedVocabularyEntries(analysis, new Set([CAT_KEY, DOG_KEY]));

    render(<ReviewList entries={entries} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar lista' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '犬いぬRemover 犬',
      '猫ねこRemover 猫',
    ]);
    expect(serializeVocabularyEntries(entries)).toBe('犬\tいぬ\n猫\tねこ');
    expect(writeText).toHaveBeenCalledWith('犬\tいぬ\n猫\tねこ');
    expect(await screen.findByRole('status')).toHaveTextContent('Lista copiada.');
  });

  it('removing a review row clears every matching token occurrence', () => {
    function ReviewHarness() {
      const [selectedKeys, setSelectedKeys] = useState(() => new Set([DOG_KEY]));
      const toggle = (key: string) => {
        setSelectedKeys((current) => {
          const next = new Set(current);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      };
      return (
        <>
          <DocumentText
            content="犬猫犬"
            analysis={analysis}
            selectedKeys={selectedKeys}
            onToggleVocabulary={toggle}
          />
          <ReviewList
            entries={orderedVocabularyEntries(analysis, selectedKeys)}
            onRemove={toggle}
          />
        </>
      );
    }

    render(<ReviewHarness />);
    expect(screen.getAllByRole('button', { name: '犬（いぬ）' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remover 犬（いぬ）' }));

    expect(screen.queryByRole('button', { name: 'Remover 犬（いぬ）' })).not.toBeInTheDocument();
    screen.getAllByRole('button', { name: '犬（いぬ）' }).forEach((token) => {
      expect(token).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
