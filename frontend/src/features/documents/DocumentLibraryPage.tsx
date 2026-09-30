import { type CSSProperties, type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { Document } from '../../shared/api/client';
import { DeleteDocumentDialog } from './DeleteDocumentDialog';
import {
  loadFavoriteDocumentIds,
  saveFavoriteDocumentIds,
  toggleFavoriteDocumentId,
} from './favorites';
import { documentKeys } from './queries';

type DocumentActionIconName = 'file-symlink' | 'file-pen' | 'trash';
type DocumentOrderField = 'title' | 'createdAt' | 'updatedAt' | 'lastReadAt';
type DocumentOrderDirection = 'asc' | 'desc';

function FilterIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" data-lucide="search" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" data-lucide="x" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

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
      if (direction === 'desc') {
        const updatedComparison = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        if (updatedComparison !== 0) return updatedComparison;
      }
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
  const [favoriteDocumentIds, setFavoriteDocumentIds] = useState(() => loadFavoriteDocumentIds());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    return documents.filter((document) => {
      const creationDate = document.createdAt.slice(0, 10);
      const matchesSearch = normalizedSearch.length === 0
        || document.title.toLocaleLowerCase().includes(normalizedSearch)
        || document.tags.some((tag) => tag.name.toLocaleLowerCase().includes(normalizedSearch));
      return matchesSearch
        && (!favoritesOnly || favoriteDocumentIds.has(document.id))
        && (createdAfter.length === 0 || creationDate >= createdAfter)
        && (createdBefore.length === 0 || creationDate <= createdBefore);
    });
  }, [createdAfter, createdBefore, documents, favoriteDocumentIds, favoritesOnly, search]);
  const hasActiveFilters = search.length > 0 || favoritesOnly || createdAfter.length > 0 || createdBefore.length > 0;

  const clearFilters = () => {
    setSearch('');
    setFavoritesOnly(false);
    setCreatedAfter('');
    setCreatedBefore('');
  };

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

  const toggleFavorite = (documentId: string) => {
    setFavoriteDocumentIds((current) => {
      const next = toggleFavoriteDocumentId(current, documentId);
      saveFavoriteDocumentIds(next);
      return next;
    });
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
        <div className="library-heading__copy">
          <p className="eyebrow">Leitura local</p>
          <h1 id="library-title">Biblioteca</h1>
          <p className="library-heading__summary">
            <span>{documents.length === 1 ? '1 documento' : `${documents.length} documentos`}</span>
            <span aria-hidden="true">·</span>
            Continue de onde parou ou prepare um novo texto japonês.
          </p>
        </div>
        <div className="library-heading__actions">
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
        </div>
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
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            createdAfter={createdAfter}
            onCreatedAfterChange={setCreatedAfter}
            createdBefore={createdBefore}
            onCreatedBeforeChange={setCreatedBefore}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
          />
          <div className="library-empty">
            <h2>Nenhum documento encontrado.</h2>
            <p>Ajuste ou limpe os filtros para ver outros documentos.</p>
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
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            createdAfter={createdAfter}
            onCreatedAfterChange={setCreatedAfter}
            createdBefore={createdBefore}
            onCreatedBeforeChange={setCreatedBefore}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
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
                {document.tags.length > 0 && <ul className="document-tag-chips" aria-label={`Etiquetas de ${document.title || 'Sem título'}`}>
                  {document.tags.map((tag) => <li key={tag.name}><span className="metadata-tag" aria-label={`Etiqueta ${tag.name}`} style={{ '--tag-color': tag.color } as CSSProperties}>{tag.name}</span></li>)}
                </ul>}
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
                  <button
                    className={`document-row__action${favoriteDocumentIds.has(document.id) ? ' document-row__action--favorite-active' : ''}`}
                    type="button"
                    aria-label={favoriteDocumentIds.has(document.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    aria-pressed={favoriteDocumentIds.has(document.id)}
                    title={favoriteDocumentIds.has(document.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    onClick={() => toggleFavorite(document.id)}
                  >
                    <span aria-hidden="true">{favoriteDocumentIds.has(document.id) ? '★' : '☆'}</span>
                  </button>
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
                  <a
                    className="document-row__action"
                    href={`/documents/${encodeURIComponent(document.id)}/metadata`}
                    aria-label="Editar metadados"
                    title="Editar metadados"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/documents/${encodeURIComponent(document.id)}/metadata`);
                    }}
                  >
                    <span aria-hidden="true">#</span>
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
  favoritesOnly,
  onFavoritesOnlyChange,
  createdAfter,
  onCreatedAfterChange,
  createdBefore,
  onCreatedBeforeChange,
  hasActiveFilters,
  onClearFilters,
  filtersOpen,
  onFiltersOpenChange,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  orderField: DocumentOrderField;
  orderDirection: DocumentOrderDirection;
  onOrderFieldChange: (field: DocumentOrderField) => void;
  onOrderDirectionChange: (direction: DocumentOrderDirection) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (favoritesOnly: boolean) => void;
  createdAfter: string;
  onCreatedAfterChange: (createdAfter: string) => void;
  createdBefore: string;
  onCreatedBeforeChange: (createdBefore: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (isOpen: boolean) => void;
}) {
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasActivePopupFilters = favoritesOnly || createdAfter.length > 0 || createdBefore.length > 0;
  const closeFilters = () => {
    onFiltersOpenChange(false);
    filterButtonRef.current?.focus();
  };

  return (
    <div className="library-controls">
      <div className="library-controls__main">
        <div className="library-search">
          <label className="library-search__label" htmlFor="document-search">Pesquisar documentos</label>
          <div className="library-search__field">
            <SearchIcon />
            <input
              id="document-search"
              type="search"
              placeholder="Título ou etiqueta"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <button
              className="library-search__clear"
              type="button"
              disabled={search.length === 0}
              aria-label="Limpar pesquisa"
              title="Limpar pesquisa"
              onClick={() => onSearchChange('')}
            >
              <CloseIcon />
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
          <label className="sr-only" htmlFor="document-order-direction">Direção da ordenação</label>
          <select
            id="document-order-direction"
            value={orderDirection}
            onChange={(event) => onOrderDirectionChange(event.target.value as DocumentOrderDirection)}
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </div>
        <div className="library-filter-menu">
          <button
            ref={filterButtonRef}
            className={`library-filter-trigger${hasActivePopupFilters ? ' library-filter-trigger--active' : ''}`}
            type="button"
            aria-controls="library-filter-panel"
            aria-expanded={filtersOpen}
            aria-label={hasActivePopupFilters ? 'Abrir filtros; filtros ativos' : 'Abrir filtros'}
            aria-pressed={hasActivePopupFilters}
            title={hasActivePopupFilters ? 'Abrir filtros; filtros ativos' : 'Abrir filtros'}
            onClick={() => onFiltersOpenChange(!filtersOpen)}
            onKeyDown={(event) => {
              if (filtersOpen && event.key === 'Escape') {
                event.preventDefault();
                closeFilters();
              }
            }}
          >
            <FilterIcon />
            <span aria-hidden="true">Filtros</span>
          </button>
          {filtersOpen && (
            <fieldset
              id="library-filter-panel"
              className="library-filters"
              aria-label="Filtros da biblioteca"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeFilters();
                }
              }}
            >
              <legend>Filtros da biblioteca</legend>
              <label>
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(event) => onFavoritesOnlyChange(event.target.checked)}
                />
                Somente favoritos
              </label>
              <label htmlFor="document-created-after">Data de criação a partir de</label>
              <input
                id="document-created-after"
                type="date"
                value={createdAfter}
                onChange={(event) => onCreatedAfterChange(event.target.value)}
              />
              <label htmlFor="document-created-before">Data de criação até</label>
              <input
                id="document-created-before"
                type="date"
                value={createdBefore}
                onChange={(event) => onCreatedBeforeChange(event.target.value)}
              />
              <button
                className="button button--quiet"
                type="button"
                disabled={!hasActiveFilters}
                onClick={onClearFilters}
              >
                Limpar filtros
              </button>
            </fieldset>
          )}
        </div>
      </div>
    </div>
  );
}
