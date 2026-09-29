import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { DocumentClient } from '../../shared/api/client';

function client(): DocumentClient {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn(), analyze: vi.fn(),
    listVocabularySelections: vi.fn(), replaceVocabularySelections: vi.fn(),
    listVocabularyDisplayPreferences: vi.fn(), setVocabularyDisplayPreference: vi.fn(),
    setReadingOverride: vi.fn(), deleteReadingOverride: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

it('offers persisted settings controls from the application navigation', () => {
  render(<App client={client()} initialPath="/" />);

  fireEvent.click(screen.getByRole('link', { name: 'Configurações' }));

  expect(screen.getByRole('heading', { name: 'Configurações', level: 1 })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Tema escuro' }));
  fireEvent.change(screen.getByLabelText('Tamanho padrão da fonte japonesa'), {
    target: { value: '28' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Disponibilizar ação para unir quebras de linha' }));

  expect(window.document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('japanese-reader:app-settings')).toBe(JSON.stringify({
    version: 1,
    theme: 'dark',
    defaultReaderFontSizePx: 28,
    lineBreakNormalizationEnabled: false,
  }));
});
