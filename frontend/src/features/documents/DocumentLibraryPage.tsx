import { type FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { Document } from '../../shared/api/client';
import { DeleteDocumentDialog } from './DeleteDocumentDialog';
import { documentKeys } from './queries';

function orderByLastRead(documents: Document[]) {
  return [...documents].sort((left, right) => {
    const leftTimestamp = left.lastReadAt === null ? Number.NEGATIVE_INFINITY : Date.parse(left.lastReadAt);
    const rightTimestamp = right.lastReadAt === null ? Number.NEGATIVE_INFINITY : Date.parse(right.lastReadAt);
    if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function readLabel(lastReadAt: string | null) {
  if (lastReadAt === null) return 'Ainda não aberto';
  return `Última leitura em ${new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(lastReadAt))}`;
}

export function DocumentLibraryPage() {
  const client = useDocumentClient();
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState<Document | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameError, setRenameError] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  const documentsQuery = useQuery({
    queryKey: documentKeys.list(),
    queryFn: () => client.list(),
  });
  const documents = useMemo(
    () => orderByLastRead(documentsQuery.data ?? []),
    [documentsQuery.data],
  );

  const renameMutation = useMutation({
    mutationFn: ({ documentId, title }: { documentId: string; title: string }) => (
      client.update(documentId, { title })
    ),
    onSuccess: (updated) => {
      queryClient.setQueryData<Document[]>(documentKeys.list(), (current = []) => (
        current.map((document) => document.id === updated.id ? updated : document)
      ));
      queryClient.setQueryData(documentKeys.detail(updated.id), updated);
      setRenaming(null);
      setRenameError(false);
    },
    onError: () => setRenameError(true),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => client.delete(documentId),
    onSuccess: (_, documentId) => {
      queryClient.setQueryData<Document[]>(documentKeys.list(), (current = []) => (
        current.filter((document) => document.id !== documentId)
      ));
      queryClient.removeQueries({ queryKey: documentKeys.detail(documentId) });
      setDeleting(null);
      setDeleteError(false);
    },
    onError: () => setDeleteError(true),
  });

  const beginRename = (document: Document) => {
    setRenaming(document);
    setRenameTitle(document.title);
    setRenameError(false);
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (renaming === null || renameTitle.trim().length === 0) return;
    setRenameError(false);
    renameMutation.mutate({ documentId: renaming.id, title: renameTitle });
  };

  if (documentsQuery.isPending) {
    return <p className="page-state" role="status">Carregando biblioteca…</p>;
  }

  if (documentsQuery.isError) {
    return (
      <section className="page-state" role="alert" aria-labelledby="library-error-title">
        <p className="eyebrow">Biblioteca indisponível</p>
        <h1 id="library-error-title">Não foi possível carregar a biblioteca.</h1>
        <p>Verifique se o servidor local está em execução e tente novamente.</p>
        <button className="button button--primary" type="button" onClick={() => void documentsQuery.refetch()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="library-page" aria-labelledby="library-title">
      <header className="library-heading">
        <div>
          <p className="eyebrow">Leitura local</p>
          <h1 id="library-title">Biblioteca</h1>
          <p>Continue de onde parou ou prepare um novo texto japonês.</p>
        </div>
        <a
          className="button button--primary button-link"
          href="/documents/new"
          onClick={(event) => {
            event.preventDefault();
            navigate('/documents/new');
          }}
        >
          Novo documento
        </a>
      </header>

      <p className="memory-notice" role="note">
        Persistência temporária: os documentos serão perdidos ao reiniciar o servidor.
      </p>

      {documents.length === 0 ? (
        <div className="library-empty">
          <h2>Nenhum documento na biblioteca.</h2>
          <p>Crie o primeiro documento para começar a leitura.</p>
        </div>
      ) : (
        <ul className="document-list" aria-label="Documentos">
          {documents.map((document) => (
            <li key={document.id} className="document-row" aria-label={document.title || 'Sem título'}>
              <div className="document-row__summary">
                <h2>{document.title || 'Sem título'}</h2>
                <p>{readLabel(document.lastReadAt)}</p>
              </div>

              {renaming?.id === document.id ? (
                <form className="rename-form" onSubmit={submitRename}>
                  <label>
                    <span className="sr-only">Novo título de {document.title || 'Sem título'}</span>
                    <input
                      aria-label={`Novo título de ${document.title || 'Sem título'}`}
                      value={renameTitle}
                      disabled={renameMutation.isPending}
                      onChange={(event) => setRenameTitle(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={renameMutation.isPending || renameTitle.trim().length === 0}
                  >
                    {renameMutation.isPending ? 'Salvando…' : 'Salvar nome'}
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={renameMutation.isPending}
                    onClick={() => setRenaming(null)}
                  >
                    Cancelar
                  </button>
                  {renameError && <p className="field-error" role="alert">Não foi possível renomear o documento.</p>}
                </form>
              ) : (
                <div className="document-row__actions">
                  <a
                    className="text-link"
                    href={`/documents/${encodeURIComponent(document.id)}/read`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/documents/${encodeURIComponent(document.id)}/read`);
                    }}
                  >
                    Abrir
                  </a>
                  <a
                    className="text-link"
                    href={`/documents/${encodeURIComponent(document.id)}/edit`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/documents/${encodeURIComponent(document.id)}/edit`);
                    }}
                  >
                    Editar
                  </a>
                  <button className="button button--quiet" type="button" onClick={() => beginRename(document)}>
                    Renomear
                  </button>
                  <button
                    className="button button--quiet button--destructive-text"
                    type="button"
                    onClick={() => {
                      setDeleting(document);
                      setDeleteError(false);
                    }}
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleting !== null && (
        <DeleteDocumentDialog
          document={deleting}
          error={deleteError}
          isPending={deleteMutation.isPending}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(false);
          }}
          onConfirm={() => {
            setDeleteError(false);
            deleteMutation.mutate(deleting.id);
          }}
        />
      )}
    </section>
  );
}
