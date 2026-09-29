export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'japanese-reader:theme-preference';

function systemTheme(): Theme {
  if (typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Fall back to the device setting when browser storage is unavailable.
  }
  return systemTheme();
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The selected theme remains active for this visit when storage is unavailable.
  }
}
