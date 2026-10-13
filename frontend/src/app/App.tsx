import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { DocumentClient } from '../shared/api/client';
import '../styles/global.css';
import { AppProviders, useRouter } from './providers';
import { AppRouter } from './router';

interface AppProps {
  client?: DocumentClient;
  initialPath?: string;
}

type HeaderIconName = 'book-open' | 'settings' | 'tags';

function HeaderIcon({ name }: { name: HeaderIconName }) {
  const paths = {
    'book-open': <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H3Z" /><path d="M21 18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.4 2.4-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V20.5h-3.4v-.1a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.4-2.4.06-.06A1.65 1.65 0 0 0 6.22 15a1.65 1.65 0 0 0-1.51-1H4.6v-3.4h.1a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.4-2.4.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V4.1h3.4v.1a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.4 2.4-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1h.1V14h-.1a1.65 1.65 0 0 0-1.51 1Z" /></>,
    tags: <><path d="M12.59 2.59A2 2 0 0 1 14 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.59 1.41l-9.7 9.7a2 2 0 0 1-2.82 0l-6.3-6.3a2 2 0 0 1 0-2.82l9.7-9.7Z" /><path d="M7 7h.01" /></>,
  } satisfies Record<HeaderIconName, React.ReactNode>;

  return (
    <svg aria-hidden="true" data-lucide={name} fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      {paths[name]}
    </svg>
  );
}

function HeaderNavigation() {
  const { location, navigate } = useRouter();
  return (
    <nav className="app-header__navigation" aria-label="Navegação principal">
      <a
        className="app-header__link"
        href="/tags"
        aria-current={location.path === '/tags' ? 'page' : undefined}
        title="Etiquetas"
        onClick={(event) => {
          event.preventDefault();
          navigate('/tags');
        }}
      >
        <HeaderIcon name="tags" />
        <span>Etiquetas</span>
      </a>
      <a
        className="app-header__link"
        href="/reading-exceptions"
        aria-current={location.path === '/reading-exceptions' ? 'page' : undefined}
        title="Exceções de leitura"
        onClick={(event) => {
          event.preventDefault();
          navigate('/reading-exceptions');
        }}
      >
        <HeaderIcon name="book-open" />
        <span>Exceções de leitura</span>
      </a>
      <a
        className="app-header__link"
        href="/settings"
        aria-current={location.path === '/settings' ? 'page' : undefined}
        title="Configurações"
        onClick={(event) => {
          event.preventDefault();
          navigate('/settings');
        }}
      >
        <HeaderIcon name="settings" />
        <span>Configurações</span>
      </a>
    </nav>
  );
}

export function App({ client, initialPath }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders client={client} initialPath={initialPath}>
        <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
        <header className="app-header">
          <div className="app-header__content">
            <a className="brand" href="/" aria-label="Japanese Reader — biblioteca">
              <span aria-hidden="true" className="brand-mark" />
              Japanese Reader
            </a>
            <HeaderNavigation />
          </div>
        </header>
        <main id="main-content" className="app-main">
          <AppRouter />
        </main>
      </AppProviders>
    </QueryClientProvider>
  );
}
