import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { Analysis, Document, DocumentClient } from '../../shared/api/client';

const DOCUMENT_COUNT = 500;
const RUNS = 3;

const analysis: Analysis = {
  documentId: '00000000-0000-0000-0000-000000000000',
  documentRevision: 1,
  contentHash: 'unused',
  metadata: {
    analyzerName: 'unused', analyzerVersion: '1', dictionaryName: 'unused',
    dictionaryVersion: '1', splitMode: 'B',
  },
  analysisOptions: { splitMode: 'B' },
  blocks: [],
  diagnostics: [],
};

function documents(): Document[] {
  return Array.from({ length: DOCUMENT_COUNT }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    title: `${index % 10 === 0 ? 'Target' : 'Document'} ${String(index).padStart(4, '0')}`,
    content: `本文 ${index}\r\n  exact`,
    description: `Description ${index}`,
    source: 'Task 17 benchmark',
    tags: [
      { name: `Group ${index % 20}`, color: '#0F766E' },
      { name: 'Shared', color: '#7C3AED' },
    ],
    revision: 1,
    createdAt: `2026-09-${String((index % 28) + 1).padStart(2, '0')}T12:00:00Z`,
    updatedAt: `2026-09-${String(((index + 3) % 28) + 1).padStart(2, '0')}T12:00:00Z`,
    lastReadAt: index % 5 === 0
      ? null
      : `2026-09-${String(((index + 7) % 28) + 1).padStart(2, '0')}T12:00:00Z`,
  }));
}

function client(library: Document[]): DocumentClient {
  return {
    list: vi.fn().mockResolvedValue(library),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    analyze: vi.fn().mockResolvedValue(analysis),
    listVocabularySelections: vi.fn().mockResolvedValue([]),
    replaceVocabularySelections: vi.fn(),
    listVocabularyDisplayPreferences: vi.fn().mockResolvedValue([]),
    setVocabularyDisplayPreference: vi.fn(),
    setReadingOverride: vi.fn(),
    deleteReadingOverride: vi.fn(),
  };
}

function roundedMedian(samples: number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return Number(ordered[Math.floor(ordered.length / 2)].toFixed(3));
}

describe('large-library frontend performance', () => {
  it('measures load, title/tag search, ordering, and date filtering', async () => {
    const library = documents();
    const loadSamples: number[] = [];
    const searchSamples: number[] = [];
    const orderSamples: number[] = [];
    const filterSamples: number[] = [];

    for (let run = 0; run < RUNS; run += 1) {
      localStorage.clear();
      window.history.replaceState(null, '', '/');
      const loadStarted = performance.now();
      const view = render(<App client={client(library)} initialPath="/" />);
      await waitFor(() => {
        expect(document.querySelectorAll('.document-row')).toHaveLength(DOCUMENT_COUNT);
      });
      loadSamples.push(performance.now() - loadStarted);

      const searchStarted = performance.now();
      fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar documentos' }), {
        target: { value: 'target' },
      });
      expect(document.querySelectorAll('.document-row')).toHaveLength(DOCUMENT_COUNT / 10);
      searchSamples.push(performance.now() - searchStarted);

      fireEvent.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));
      const orderStarted = performance.now();
      fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'title' } });
      fireEvent.change(screen.getByLabelText('Direção da ordenação'), { target: { value: 'asc' } });
      expect(document.querySelector('.document-row__title')).toHaveTextContent('Document 0001');
      orderSamples.push(performance.now() - orderStarted);

      fireEvent.click(screen.getByRole('button', { name: 'Abrir filtros' }));
      const filterStarted = performance.now();
      fireEvent.change(screen.getByLabelText('Data de criação a partir de'), {
        target: { value: '28/09/2026' },
      });
      expect(document.querySelectorAll('.document-row')).toHaveLength(17);
      filterSamples.push(performance.now() - filterStarted);
      view.unmount();
    }

    process.stdout.write(`LIBRARY_PERFORMANCE ${JSON.stringify({
      documents: DOCUMENT_COUNT,
      runs: RUNS,
      loadMedianMs: roundedMedian(loadSamples),
      loadSamplesMs: loadSamples.map((sample) => Number(sample.toFixed(3))),
      searchMedianMs: roundedMedian(searchSamples),
      searchSamplesMs: searchSamples.map((sample) => Number(sample.toFixed(3))),
      orderMedianMs: roundedMedian(orderSamples),
      orderSamplesMs: orderSamples.map((sample) => Number(sample.toFixed(3))),
      dateFilterMedianMs: roundedMedian(filterSamples),
      dateFilterSamplesMs: filterSamples.map((sample) => Number(sample.toFixed(3))),
    })}\n`);
  }, 120_000);
});
