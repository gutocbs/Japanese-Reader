import { READER_FONT_SIZE_RANGE } from '../features/reader/preferences';
import type { Theme } from './theme';

export interface AppSettings {
  theme: Theme;
  defaultReaderFontSizePx: number;
  lineBreakNormalizationEnabled: boolean;
}

const STORAGE_KEY = 'japanese-reader:app-settings';
const STORAGE_VERSION = 1;

function isFontSize(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= READER_FONT_SIZE_RANGE.min
    && value <= READER_FONT_SIZE_RANGE.max;
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  defaultReaderFontSizePx: 24,
  lineBreakNormalizationEnabled: import.meta.env.VITE_ENABLE_LINE_BREAK_NORMALIZATION !== 'false',
};

function isLineBreakNormalizationAvailable(): boolean {
  return import.meta.env.VITE_ENABLE_LINE_BREAK_NORMALIZATION !== 'false';
}

export function loadAppSettings(): AppSettings {
  const defaults = {
    ...DEFAULT_APP_SETTINGS,
    lineBreakNormalizationEnabled: isLineBreakNormalizationAvailable(),
  };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return defaults;

    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null) return defaults;

    const record = value as Record<string, unknown>;
    if (record.version !== STORAGE_VERSION
      || !isTheme(record.theme)
      || !isFontSize(record.defaultReaderFontSizePx)
      || typeof record.lineBreakNormalizationEnabled !== 'boolean') {
      return defaults;
    }

    return {
      theme: record.theme,
      defaultReaderFontSizePx: record.defaultReaderFontSizePx,
      lineBreakNormalizationEnabled: defaults.lineBreakNormalizationEnabled
        && record.lineBreakNormalizationEnabled,
    };
  } catch {
    return defaults;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...settings }));
  } catch {
    // The selected settings remain active for the current visit when storage is unavailable.
  }
}
