import { DocumentEditorPage } from '../features/documents/DocumentEditorPage';
import { DocumentLibraryPage } from '../features/documents/DocumentLibraryPage';
import { DocumentMetadataPage } from '../features/documents/DocumentMetadataPage';
import { TagManagementPage } from '../features/documents/TagManagementPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useRouter } from './providers';

export function AppRouter() {
  const { location } = useRouter();

  if (location.path === '/') {
    return <DocumentLibraryPage />;
  }

  if (location.path === '/documents/new') {
    return <DocumentEditorPage key="new-document" />;
  }

  if (location.path === '/settings') {
    return <SettingsPage />;
  }

  if (location.path === '/tags') {
    return <TagManagementPage />;
  }

  const match = /^\/documents\/([^/]+)\/(edit|metadata|read)$/.exec(location.path);
  if (match !== null) {
    const documentId = decodeURIComponent(match[1]);
    if (match[2] === 'edit') return <DocumentEditorPage key={`edit-${documentId}`} documentId={documentId} />;
    if (match[2] === 'metadata') return <DocumentMetadataPage key={`metadata-${documentId}`} documentId={documentId} />;
    return <ReaderPage documentId={documentId} />;
  }

  return (
    <section className="page-state" aria-labelledby="not-found-title">
      <p className="eyebrow">Caminho desconhecido</p>
      <h1 id="not-found-title">Página não encontrada</h1>
      <a className="text-link" href="/">Voltar à biblioteca</a>
    </section>
  );
}
