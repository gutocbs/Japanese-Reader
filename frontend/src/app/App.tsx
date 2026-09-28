import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { DocumentClient } from '../shared/api/client';
import '../styles/global.css';
import { AppProviders } from './providers';
import { AppRouter } from './router';

interface AppProps {
  client?: DocumentClient;
  initialPath?: string;
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
          <a className="brand" href="/" aria-label="Japanese Reader — biblioteca">
            <span aria-hidden="true" className="brand-mark" />
            Japanese Reader
          </a>
        </header>
        <main id="main-content" className="app-main">
          <AppRouter />
        </main>
      </AppProviders>
    </QueryClientProvider>
  );
}
