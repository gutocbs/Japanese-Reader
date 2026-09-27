import { DocumentEditorPage } from '../features/documents/DocumentEditorPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { useRouter } from './providers';

export function AppRouter() {
  const { location } = useRouter();

  if (location.path === '/' || location.path === '/documents/new') {
    return <DocumentEditorPage />;
  }

  const match = /^\/documents\/([^/]+)\/(edit|read)$/.exec(location.path);
  if (match !== null) {
    const documentId = decodeURIComponent(match[1]);
    return match[2] === 'edit'
      ? <DocumentEditorPage documentId={documentId} />
      : <ReaderPage documentId={documentId} />;
  }

  return (
    <section className="page-state" aria-labelledby="not-found-title">
      <p className="eyebrow">Caminho desconhecido</p>
      <h1 id="not-found-title">Página não encontrada</h1>
      <a className="text-link" href="/documents/new">Criar um documento</a>
    </section>
  );
}
