import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { documentClient, type DocumentClient } from '../shared/api/client';
import { loadTheme, type Theme } from './theme';
import { loadAppSettings, saveAppSettings, type AppSettings } from './settings';

interface RouterLocation {
  path: string;
  state: unknown;
}

interface RouterContextValue {
  location: RouterLocation;
  navigate: (path: string, state?: unknown) => void;
  replaceState: (state: unknown) => void;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

interface AppSettingsContextValue {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => boolean;
}

interface AppProvidersProps {
  children: ReactNode;
  client?: DocumentClient;
  initialPath?: string;
}

const ApiContext = createContext<DocumentClient | null>(null);
const RouterContext = createContext<RouterContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);
const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function hasPersistedAppSettings(): boolean {
  try {
    return localStorage.getItem('japanese-reader:app-settings') !== null;
  } catch {
    return false;
  }
}

export function AppProviders({ children, client = documentClient, initialPath }: AppProvidersProps) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadAppSettings();
    return hasPersistedAppSettings() ? loaded : { ...loaded, theme: loadTheme() };
  });
  const [theme, setThemeState] = useState<Theme>(() => (
    hasPersistedAppSettings() ? loadAppSettings().theme : loadTheme()
  ));
  const [location, setLocation] = useState<RouterLocation>(() => {
    if (initialPath !== undefined) {
      window.history.replaceState(null, '', initialPath);
    }
    return { path: initialPath ?? window.location.pathname, state: window.history.state };
  });

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      setLocation({ path: window.location.pathname, state: event.state });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    setSettings((current) => {
      const next = { ...current, theme: nextTheme };
      saveAppSettings(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((nextSettings: AppSettings) => {
    const wasSaved = saveAppSettings(nextSettings);
    setSettings(nextSettings);
    setThemeState(nextSettings.theme);
    return wasSaved;
  }, []);

  const navigate = useCallback((path: string, state?: unknown) => {
    window.history.pushState(state ?? null, '', path);
    setLocation({ path, state: state ?? null });
  }, []);

  const replaceState = useCallback((state: unknown) => {
    window.history.replaceState(state ?? null, '', window.location.href);
    setLocation((current) => ({ ...current, state: state ?? null }));
  }, []);

  const router = useMemo(
    () => ({ location, navigate, replaceState }),
    [location, navigate, replaceState],
  );

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <ApiContext.Provider value={client}>
          <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
        </ApiContext.Provider>
      </ThemeContext.Provider>
    </AppSettingsContext.Provider>
  );
}

export function useDocumentClient() {
  const client = useContext(ApiContext);
  if (client === null) throw new Error('Document client provider is missing');
  return client;
}

export function useRouter() {
  const router = useContext(RouterContext);
  if (router === null) throw new Error('Router provider is missing');
  return router;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (theme === null) throw new Error('Theme provider is missing');
  return theme;
}

export function useAppSettings() {
  const appSettings = useContext(AppSettingsContext);
  if (appSettings === null) throw new Error('App settings provider is missing');
  return appSettings;
}
