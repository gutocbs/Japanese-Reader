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

it('groups accessible controls and persists their active changes from the application navigation', () => {
  render(<App client={client()} initialPath="/" />);

  fireEvent.click(screen.getByRole('link', { name: 'Configurações' }));

  expect(screen.getByRole('heading', { name: 'Configurações', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Aparência' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Leitura' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Experimentos' })).toBeInTheDocument();

  const darkTheme = screen.getByRole('radio', { name: 'Tema escuro' });
  fireEvent.click(darkTheme);
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar tamanho padrão da fonte japonesa' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Disponibilizar ação para unir quebras de linha' }));

  expect(darkTheme).toBeChecked();
  expect(window.document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByText('Configurações salvas neste navegador.')).toHaveAttribute('role', 'status');
  expect(localStorage.getItem('japanese-reader:app-settings')).toBe(JSON.stringify({
    version: 1,
    theme: 'dark',
    defaultReaderFontSizePx: 25,
    lineBreakNormalizationEnabled: false,
  }));
});

it('keeps changes active and announces a storage error when local persistence is unavailable', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled');
  });
  render(<App client={client()} initialPath="/settings" />);

  fireEvent.click(screen.getByRole('radio', { name: 'Tema escuro' }));

  expect(screen.getByRole('radio', { name: 'Tema escuro' })).toBeChecked();
  expect(window.document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Não foi possível salvar as configurações neste navegador.',
  );

  setItem.mockRestore();
});
