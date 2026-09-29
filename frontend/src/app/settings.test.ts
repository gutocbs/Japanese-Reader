import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function settingsModule() {
  return import('./settings');
}

describe('app settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the safe defaults when no persisted settings exist', async () => {
    const { DEFAULT_APP_SETTINGS, loadAppSettings } = await settingsModule();

    expect(DEFAULT_APP_SETTINGS).toEqual({
      theme: 'light',
      defaultReaderFontSizePx: 24,
      lineBreakNormalizationEnabled: true,
    });
    expect(loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('round-trips settings through a versioned localStorage payload', async () => {
    const { loadAppSettings, saveAppSettings } = await settingsModule();
    const settings = {
      theme: 'dark' as const,
      defaultReaderFontSizePx: 28,
      lineBreakNormalizationEnabled: false,
    };

    saveAppSettings(settings);

    expect(localStorage.getItem('japanese-reader:app-settings')).toBe(JSON.stringify({
      version: 1,
      ...settings,
    }));
    expect(loadAppSettings()).toEqual(settings);
  });

  it('falls back to defaults for invalid persisted payloads', async () => {
    const { DEFAULT_APP_SETTINGS, loadAppSettings } = await settingsModule();
    localStorage.setItem('japanese-reader:app-settings', JSON.stringify({
      version: 1,
      theme: 'dark',
      defaultReaderFontSizePx: 33,
      lineBreakNormalizationEnabled: false,
    }));

    expect(loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('uses defaults and makes saving a no-op when browser storage is unavailable', async () => {
    const { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } = await settingsModule();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(() => saveAppSettings({
      theme: 'dark',
      defaultReaderFontSizePx: 28,
      lineBreakNormalizationEnabled: false,
    })).not.toThrow();
  });

  it('honors an explicit line-break normalization environment opt-out', async () => {
    vi.stubEnv('VITE_ENABLE_LINE_BREAK_NORMALIZATION', 'false');
    vi.resetModules();
    const { DEFAULT_APP_SETTINGS, loadAppSettings } = await settingsModule();

    expect(DEFAULT_APP_SETTINGS.lineBreakNormalizationEnabled).toBe(false);
    expect(loadAppSettings().lineBreakNormalizationEnabled).toBe(false);
  });

  it('lets an explicit environment opt-out override persisted normalization settings', async () => {
    vi.stubEnv('VITE_ENABLE_LINE_BREAK_NORMALIZATION', 'false');
    vi.resetModules();
    localStorage.setItem('japanese-reader:app-settings', JSON.stringify({
      version: 1,
      theme: 'dark',
      defaultReaderFontSizePx: 28,
      lineBreakNormalizationEnabled: true,
    }));
    const { loadAppSettings } = await settingsModule();

    expect(loadAppSettings()).toEqual({
      theme: 'dark',
      defaultReaderFontSizePx: 28,
      lineBreakNormalizationEnabled: false,
    });
  });
});
