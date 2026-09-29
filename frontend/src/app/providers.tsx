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
import { loadTheme, saveTheme, type Theme } from './theme';

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

interface AppProvidersProps {
  children: ReactNode;
  client?: DocumentClient;
  initialPath?: string;
}

const ApiContext = createContext<DocumentClient | null>(null);
const RouterContext = createContext<RouterContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppProviders({ children, client = documentClient, initialPath }: AppProvidersProps) {
  const [theme, setThemeState] = useState<Theme>(loadTheme);
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
    saveTheme(nextTheme);
    setThemeState(nextTheme);
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
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ApiContext.Provider value={client}>
        <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
      </ApiContext.Provider>
    </ThemeContext.Provider>
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
