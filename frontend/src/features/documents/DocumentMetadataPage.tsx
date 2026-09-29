import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { Document, DocumentTag } from '../../shared/api/client';
import { documentKeys } from './queries';
import { canonicalTag } from './tags';

interface DocumentMetadataPageProps {
  documentId: string;
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function DocumentMetadataPage({ documentId }: DocumentMetadataPageProps) {
  const client = useDocumentClient();
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const [document, setDocument] = useState<Document | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<DocumentTag[]>([]);
  const [catalog, setCatalog] = useState<DocumentTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const [loaded, loadedCatalog] = await Promise.all([client.get(documentId), client.listTags?.() ?? Promise.resolve([])]);
      setDocument(loaded);
      setDescription(loaded.description ?? '');
      setTags(loaded.tags);
      setCatalog(loadedCatalog);
      queryClient.setQueryData(documentKeys.detail(documentId), loaded);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [client, documentId, queryClient]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const saveMetadata = async () => {
    if (document === null || isSaving) return;
    setIsSaving(true);
    setSaveError(false);
    setSaved(false);
    try {
      const updated = await client.update(document.id, {
        description: description.trim().length === 0 ? null : description,
        tags,
      });
      setDocument(updated);
      setDescription(updated.description ?? '');
      setTags(updated.tags);
      queryClient.setQueryData(documentKeys.detail(updated.id), updated);
      queryClient.setQueryData<Document[]>(documentKeys.list(), (current) => (
        current?.map((item) => item.id === updated.id ? updated : item)
      ));
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    const name = newTagName.trim();
    if (name.length === 0 || tags.some((tag) => tag.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) {
      return;
    }
    setTags((current) => {
      const tag = canonicalTag(catalog, name);
      return [...current, tag];
    });
    setNewTagName('');
    setSaved(false);
  };

  if (isLoading) {
    return <p className="page-state" role="status">Carregando metadados…</p>;
  }

  if (loadError || document === null) {
    return (
      <section className="page-state" role="alert" aria-labelledby="metadata-load-error-title">
        <p className="eyebrow">Metadados indisponíveis</p>
        <h1 id="metadata-load-error-title">Não foi possível carregar os metadados.</h1>
        <button className="button button--primary" type="button" onClick={() => void loadDocument()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="editor-page" aria-labelledby="metadata-title">
      <header className="page-heading">
        <p className="eyebrow">Leitura local</p>
        <h1 id="metadata-title">Metadados do documento</h1>
        <p>Organize as notas e etiquetas sem alterar o texto preparado para leitura.</p>
      </header>

      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); void saveMetadata(); }}>
        <label className="field">
          <span>Criado em</span>
          <input aria-label="Criado em" readOnly value={formattedDate(document.createdAt)} />
        </label>
        <label className="field">
          <span>Atualizado em</span>
          <input aria-label="Atualizado em" readOnly value={formattedDate(document.updatedAt)} />
        </label>
        <label className="field">
          <span>Descrição</span>
          <textarea
            value={description}
            onChange={(event) => { setDescription(event.target.value); setSaved(false); }}
            disabled={isSaving}
            rows={5}
          />
        </label>

        <div className="field">
          <span>Etiquetas</span>
          <p className="field-hint">Selecione uma etiqueta existente ou crie uma nova para este documento.</p>
          <ul className="metadata-tags" aria-label="Etiquetas atuais">
            {tags.map((tag) => (
              <li key={`${tag.name}-${tag.color}`}>
                <span className="metadata-tag" aria-label={`Etiqueta ${tag.name}`} style={{ '--tag-color': tag.color } as CSSProperties}>{tag.name}</span>
                <button
                  className="tag-remove-button"
                  type="button"
                  disabled={isSaving}
                  aria-label={`Remover etiqueta ${tag.name}`}
                  title={`Remover etiqueta ${tag.name}`}
                  onClick={() => { setTags((current) => current.filter((item) => item !== tag)); setSaved(false); }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
          {catalog.filter((tag) => !tags.some((selected) => selected.name.localeCompare(tag.name, undefined, { sensitivity: 'accent' }) === 0)).length > 0 && (
            <div className="tag-selection" aria-label="Etiquetas disponíveis">
              <span className="tag-selection__label">Etiquetas disponíveis</span>
              <div className="tag-selection__options">
                {catalog.filter((tag) => !tags.some((selected) => selected.name.localeCompare(tag.name, undefined, { sensitivity: 'accent' }) === 0)).map((tag) => (
                  <button key={tag.name} className="tag-selection__option" type="button" disabled={isSaving} aria-label={`Selecionar etiqueta ${tag.name}`} onClick={() => { setTags((current) => [...current, tag]); setSaved(false); }}>
                    <span className="metadata-tag" style={{ '--tag-color': tag.color } as CSSProperties}>{tag.name}</span>
                    <span aria-hidden="true">+</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="metadata-tag-form">
            <label>
              <span className="sr-only">Nova etiqueta</span>
              <input
                aria-label="Nova etiqueta"
                value={newTagName}
                disabled={isSaving}
                onChange={(event) => setNewTagName(event.target.value)}
              />
            </label>
            <button className="button button--secondary" type="button" disabled={isSaving || newTagName.trim().length === 0} onClick={addTag}>
              Adicionar etiqueta
            </button>
          </div>
          <button className="button button--quiet" type="button" disabled={isSaving} onClick={() => navigate('/tags')}>Gerenciar etiquetas</button>
        </div>

        {saveError && (
          <div className="error-message" role="alert">
            <p>Não foi possível salvar os metadados. Suas alterações continuam aqui.</p>
            <button className="button button--secondary" type="button" onClick={() => void saveMetadata()}>
              Tentar novamente
            </button>
          </div>
        )}
        {saved && <p className="field-hint" role="status">Metadados salvos.</p>}

        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar metadados'}
          </button>
          <button className="button button--quiet" type="button" disabled={isSaving} onClick={() => navigate('/')}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
