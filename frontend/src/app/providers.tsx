import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { documentClient, type DocumentClient } from '../shared/api/client';

interface RouterLocation {
  path: string;
  state: unknown;
}

interface RouterContextValue {
  location: RouterLocation;
  navigate: (path: string, state?: unknown) => void;
}

interface AppProvidersProps {
  children: ReactNode;
  client?: DocumentClient;
  initialPath?: string;
}

const ApiContext = createContext<DocumentClient | null>(null);
const RouterContext = createContext<RouterContextValue | null>(null);

export function AppProviders({ children, client = documentClient, initialPath }: AppProvidersProps) {
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

  const navigate = useCallback((path: string, state?: unknown) => {
    window.history.pushState(state ?? null, '', path);
    setLocation({ path, state: state ?? null });
  }, []);

  const router = useMemo(() => ({ location, navigate }), [location, navigate]);

  return (
    <ApiContext.Provider value={client}>
      <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
    </ApiContext.Provider>
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
