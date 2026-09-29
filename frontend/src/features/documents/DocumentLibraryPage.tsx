import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { Document } from '../../shared/api/client';
import { DeleteDocumentDialog } from './DeleteDocumentDialog';
import { documentKeys } from './queries';

type DocumentActionIconName = 'file-symlink' | 'file-pen' | 'trash';
type DocumentOrderField = 'title' | 'createdAt' | 'updatedAt' | 'lastReadAt';
type DocumentOrderDirection = 'asc' | 'desc';

function DocumentActionIcon({ name }: { name: DocumentActionIconName }) {
  const paths = {
    'file-symlink': (
      <>
        <path d="m10 18 3-3-3-3" />
        <path d="M14 2v6h6" />
        <path d="M4 11V4a2 2 0 0 1 2-2h8l6 6v4" />
        <path d="M4 22v-5a2 2 0 0 1 2-2h9" />
      </>
    ),
    'file-pen': (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
    ),
  } satisfies Record<DocumentActionIconName, ReactNode>;

  return (
    <svg
      aria-hidden="true"
      data-lucide={name}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      {paths[name]}
    </svg>
  );
}

function orderDocuments(
  documents: Document[],
  field: DocumentOrderField,
  direction: DocumentOrderDirection,
) {
  return [...documents].sort((left, right) => {
    if (field === 'lastReadAt' && (left.lastReadAt === null || right.lastReadAt === null)) {
      if (left.lastReadAt === null && right.lastReadAt !== null) return 1;
      if (left.lastReadAt !== null && right.lastReadAt === null) return -1;
      return left.id.localeCompare(right.id);
    }

    const leftValue = field === 'title' ? left.title : Date.parse(left[field] ?? '');
    const rightValue = field === 'title' ? right.title : Date.parse(right[field] ?? '');
    const comparison = typeof leftValue === 'string'
      ? leftValue.localeCompare(rightValue as string)
      : leftValue - (rightValue as number);
    if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
    if (field === 'lastReadAt' && direction === 'desc') {
      const updatedComparison = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      if (updatedComparison !== 0) return updatedComparison;
    }
    return left.id.localeCompare(right.id);
  });
}

function createdLabel(createdAt: string) {
  return `Adicionado em ${new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt))}`;
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
  const [search, setSearch] = useState('');
  const [orderField, setOrderField] = useState<DocumentOrderField>('lastReadAt');
  const [orderDirection, setOrderDirection] = useState<DocumentOrderDirection>('desc');
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const documentsQuery = useQuery({
    queryKey: documentKeys.list(),
    queryFn: () => client.list(),
  });
  const documents = useMemo(
    () => orderDocuments(documentsQuery.data ?? [], orderField, orderDirection),
    [documentsQuery.data, orderField, orderDirection],
  );
  const matchingDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (normalizedSearch.length === 0) return documents;
    return documents.filter((document) => document.title.toLocaleLowerCase().includes(normalizedSearch));
  }, [documents, search]);

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

      {documents.length === 0 ? (
        <div className="library-empty">
          <h2>Nenhum documento na biblioteca.</h2>
          <p>Crie o primeiro documento para começar a leitura.</p>
        </div>
      ) : matchingDocuments.length === 0 ? (
        <>
          <LibrarySearch
            search={search}
            onSearchChange={setSearch}
            orderField={orderField}
            orderDirection={orderDirection}
            onOrderFieldChange={setOrderField}
            onOrderDirectionChange={setOrderDirection}
          />
          <div className="library-empty">
            <h2>Nenhum documento encontrado.</h2>
            <p>Tente outro título ou limpe a pesquisa.</p>
          </div>
        </>
      ) : (
        <>
          <LibrarySearch
            search={search}
            onSearchChange={setSearch}
            orderField={orderField}
            orderDirection={orderDirection}
            onOrderFieldChange={setOrderField}
            onOrderDirectionChange={setOrderDirection}
          />
          <ul className="document-list" aria-label="Documentos">
            {matchingDocuments.map((document) => (
              <li key={document.id} className="document-row" aria-label={document.title || 'Sem título'}>
              <div className="document-row__summary">
                <h2>
                  <a
                    className="document-row__title"
                    href={`/documents/${encodeURIComponent(document.id)}/read`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/documents/${encodeURIComponent(document.id)}/read`);
                    }}
                  >
                    {document.title || 'Sem título'}
                  </a>
                </h2>
                <p>{createdLabel(document.createdAt)}</p>
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
                    className="document-row__action"
                    href={`/documents/${encodeURIComponent(document.id)}/read`}
                    aria-label="Abrir documento"
                    title="Abrir documento"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/documents/${encodeURIComponent(document.id)}/read`);
                    }}
                  >
                    <DocumentActionIcon name="file-symlink" />
                  </a>
                  <a
                    className="document-row__action"
                    href={`/documents/${encodeURIComponent(document.id)}/edit`}
                    aria-label="Editar documento"
                    title="Editar documento"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/documents/${encodeURIComponent(document.id)}/edit`);
                    }}
                  >
                    <DocumentActionIcon name="file-pen" />
                  </a>
                  <button
                    className="document-row__action"
                    type="button"
                    aria-label="Renomear documento"
                    title="Renomear documento"
                    onClick={() => beginRename(document)}
                  >
                    <span aria-hidden="true">Aa</span>
                  </button>
                  <button
                    className="document-row__action document-row__action--destructive"
                    type="button"
                    aria-label="Excluir documento"
                    title="Excluir documento"
                    onClick={(event) => {
                      deleteTriggerRef.current = event.currentTarget;
                      setDeleting(document);
                      setDeleteError(false);
                    }}
                  >
                    <DocumentActionIcon name="trash" />
                  </button>
                </div>
              )}
              </li>
            ))}
          </ul>
        </>
      )}

      {deleting !== null && (
        <DeleteDocumentDialog
          document={deleting}
          error={deleteError}
          isPending={deleteMutation.isPending}
          returnFocusRef={deleteTriggerRef}
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

function LibrarySearch({
  search,
  onSearchChange,
  orderField,
  orderDirection,
  onOrderFieldChange,
  onOrderDirectionChange,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  orderField: DocumentOrderField;
  orderDirection: DocumentOrderDirection;
  onOrderFieldChange: (field: DocumentOrderField) => void;
  onOrderDirectionChange: (direction: DocumentOrderDirection) => void;
}) {
  return (
    <div className="library-controls">
      <div className="library-search">
        <label className="library-search__label" htmlFor="document-search">Pesquisar documentos</label>
        <div className="library-search__controls">
          <input
            id="document-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <button
            className="button button--quiet"
            type="button"
            disabled={search.length === 0}
            onClick={() => onSearchChange('')}
          >
            Limpar pesquisa
          </button>
        </div>
      </div>
      <div className="library-ordering">
        <label htmlFor="document-order-field">Ordenar por</label>
        <select
          id="document-order-field"
          value={orderField}
          onChange={(event) => onOrderFieldChange(event.target.value as DocumentOrderField)}
        >
          <option value="lastReadAt">Última leitura</option>
          <option value="title">Título</option>
          <option value="createdAt">Data de criação</option>
          <option value="updatedAt">Data de atualização</option>
        </select>
        <label htmlFor="document-order-direction">Direção da ordenação</label>
        <select
          id="document-order-direction"
          value={orderDirection}
          onChange={(event) => onOrderDirectionChange(event.target.value as DocumentOrderDirection)}
        >
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </select>
      </div>
    </div>
  );
}
