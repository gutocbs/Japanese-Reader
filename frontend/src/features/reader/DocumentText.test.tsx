import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '../../shared/api/client';
import { DocumentText } from './DocumentText';

const analysis: Analysis = {
  documentId: '00000000-0000-0000-0000-000000000001',
  documentRevision: 1,
  contentHash: 'hash',
  metadata: {
    analyzerName: 'SudachiPy',
    analyzerVersion: '0.6.11',
    dictionaryName: 'SudachiDict-core',
    dictionaryVersion: '20250825',
    splitMode: 'B',
  },
  analysisOptions: { splitMode: 'B' },
  blocks: [
    {
      startOffset: 2,
      endOffset: 8,
      tokens: [
        {
          startOffset: 2,
          endOffset: 5,
          surface: '食べた',
          lemma: '食べる',
          reading: 'たべた',
          dictionaryReading: 'たべる',
          partOfSpeech: ['動詞', '一般', '*', '*', '下一段-バ行', '連用形-一般'],
          isOutOfVocabulary: false,
          isLexical: true,
          vocabularyKey: '食べる\u0000たべる',
          furiganaSegments: [
            { text: '食', reading: 'た' },
            { text: 'べた', reading: null },
          ],
        },
        {
          startOffset: 5,
          endOffset: 6,
          surface: '。',
          lemma: '。',
          reading: null,
          dictionaryReading: null,
          partOfSpeech: ['補助記号', '句点', '*', '*', '*', '*'],
          isOutOfVocabulary: false,
          isLexical: false,
          vocabularyKey: null,
          furiganaSegments: [{ text: '。', reading: null }],
        },
      ],
    },
    {
      startOffset: 8,
      endOffset: 10,
      tokens: [
        {
          startOffset: 8,
          endOffset: 10,
          surface: '昨日',
          lemma: '昨日',
          reading: 'きのう',
          dictionaryReading: 'きのう',
          partOfSpeech: ['名詞', '普通名詞', '副詞可能', '*', '*', '*'],
          isOutOfVocabulary: false,
          isLexical: true,
          vocabularyKey: '昨日\u0000きのう',
          furiganaSegments: [{ text: '昨日', reading: 'きのう' }],
        },
      ],
    },
  ],
  diagnostics: [{ code: 'furigana_fallback', startOffset: 8, endOffset: 10 }],
};

describe('DocumentText', () => {
  it('keeps canonical text selectable in semantic HTML and preserves every gap', () => {
    const content = '𠮷 食べた。 \n昨日!';
    const { container } = render(<DocumentText content={content} analysis={analysis} />);

    const reader = screen.getByTestId('document-text');
    expect(reader.querySelector('canvas, svg, img')).toBeNull();
    expect(reader.tagName).toBe('DIV');
    expect(reader).not.toHaveAttribute('aria-hidden');

    const base = reader.cloneNode(true) as HTMLElement;
    base.querySelectorAll('rt').forEach((reading) => reading.remove());
    expect(base.textContent).toBe(content);
    expect(container.querySelectorAll('ruby > rt')).toHaveLength(2);
    expect(screen.getByText('。').tagName).toBe('SPAN');
  });

  it('renders a whole-token fallback as one ruby base', () => {
    render(<DocumentText content={'𠮷 食べた。 \n昨日!'} analysis={analysis} />);

    const reading = screen.getByText('きのう');
    const ruby = reading.parentElement;
    expect(ruby?.tagName).toBe('RUBY');
    expect(ruby?.childNodes[0]?.textContent).toBe('昨日');
    expect(ruby?.querySelectorAll('rt')).toHaveLength(1);
  });
});
