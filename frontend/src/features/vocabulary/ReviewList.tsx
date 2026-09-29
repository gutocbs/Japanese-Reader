import { useState } from 'react';
import type { Analysis } from '../../shared/api/client';

export interface VocabularyEntry {
  key: string;
  lemma: string;
  reading: string | null;
}

export function decodeVocabularyKey(key: string): Omit<VocabularyEntry, 'key'> | null {
  try {
    const value: unknown = JSON.parse(key);
    if (
      Array.isArray(value)
      && value.length === 2
      && typeof value[0] === 'string'
      && (typeof value[1] === 'string' || value[1] === null)
    ) {
      return { lemma: value[0], reading: value[1] };
    }
  } catch {
    // Invalid identities are ignored instead of inventing display data.
  }
  return null;
}

export function encodeVocabularyKey(entry: Omit<VocabularyEntry, 'key'>): string {
  return JSON.stringify([entry.lemma, entry.reading]);
}

export function orderedVocabularyEntries(
  analysis: Analysis,
  selectedKeys: ReadonlySet<string>,
): VocabularyEntry[] {
  const seen = new Set<string>();
  const entries: VocabularyEntry[] = [];
  for (const block of analysis.blocks) {
    for (const token of block.tokens) {
      const key = token.vocabularyKey;
      if (key === null || seen.has(key) || !selectedKeys.has(key)) continue;
      seen.add(key);
      const decoded = decodeVocabularyKey(key);
      if (decoded !== null) entries.push({ key, ...decoded });
    }
  }
  return entries;
}

export function serializeVocabularyEntries(entries: readonly VocabularyEntry[]): string {
  return entries.map(({ lemma, reading }) => `${lemma}\t${reading ?? ''}`).join('\n');
}

interface ReviewListProps {
  entries: readonly VocabularyEntry[];
  onRemove: (key: string) => void;
}

export function ReviewList({ entries, onRemove }: ReviewListProps) {
  const [copyStatus, setCopyStatus] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serializeVocabularyEntries(entries));
      setCopyStatus('Lista copiada.');
    } catch {
      setCopyStatus('Não foi possível copiar a lista.');
    }
  };

  return (
    <section className="review-list" aria-labelledby="review-list-title">
      <div className="review-list__heading">
        <div>
          <p className="eyebrow">Estudo</p>
          <h2 id="review-list-title">Fila de revisão</h2>
        </div>
        <button
          className="button button--secondary"
          type="button"
          disabled={entries.length === 0}
          onClick={() => void copy()}
        >
          Copiar lista
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="review-list__empty">Clique em uma palavra no texto para marcá-la.</p>
      ) : (
        <ul className="review-list__items">
          {entries.map((entry) => (
            <li key={entry.key}>
              <span className="review-list__term">
                <strong lang="ja">{entry.lemma}</strong>
                <span lang="ja">{entry.reading ?? '—'}</span>
              </span>
              <button
                className="review-list__remove"
                type="button"
                aria-label={`Remover ${entry.lemma}（${entry.reading ?? 'sem leitura'}）`}
                onClick={() => onRemove(entry.key)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="review-list__status" role="status" aria-live="polite">{copyStatus}</p>
    </section>
  );
}
