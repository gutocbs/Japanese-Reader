import { type CSSProperties, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { Document, DocumentTag } from '../../shared/api/client';
import { documentKeys } from './queries';
import { addCatalogTag, loadCatalogTags, mergeCatalogTags, removeCatalogTag, renameCatalogTag, saveCatalogTags } from './tags';

function hasTag(document: Document, tag: DocumentTag) {
  return document.tags.some((item) => item.name.localeCompare(tag.name, undefined, { sensitivity: 'accent' }) === 0);
}

export function TagManagementPage() {
  const client = useDocumentClient();
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const documentsQuery = useQuery({ queryKey: documentKeys.list(), queryFn: () => client.list() });
  const [tags, setTags] = useState<DocumentTag[]>(() => loadCatalogTags());
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<DocumentTag | null>(null);
  const [renameName, setRenameName] = useState('');
  const [removing, setRemoving] = useState<DocumentTag | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (documentsQuery.data !== undefined) {
      setTags((current) => mergeCatalogTags(current, documentsQuery.data.flatMap((document) => document.tags)));
    }
  }, [documentsQuery.data]);

  const updateAffectedDocuments = async (tag: DocumentTag, transform: (tags: DocumentTag[]) => DocumentTag[]) => {
    const affected = (documentsQuery.data ?? []).filter((document) => hasTag(document, tag));
    const updated = await Promise.all(affected.map(async (document) => client.update(document.id, { tags: transform(document.tags) })));
    queryClient.setQueryData<Document[]>(documentKeys.list(), (current = []) => current.map((document) => (
      updated.find((item) => item.id === document.id) ?? document
    )));
    for (const document of updated) queryClient.setQueryData(documentKeys.detail(document.id), document);
  };

  const createTag = () => {
    try {
      setTags((current) => addCatalogTag(current, newName));
      setNewName('');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? 'Essa etiqueta já existe.' : 'Não foi possível criar a etiqueta.');
    }
  };

  const saveRename = async () => {
    if (renaming === null || isSaving) return;
    try {
      const nextTags = renameCatalogTag(tags, renaming.name, renameName);
      setIsSaving(true);
      await updateAffectedDocuments(renaming, (current) => current.map((tag) => (
        tag.name.localeCompare(renaming.name, undefined, { sensitivity: 'accent' }) === 0
          ? { ...tag, name: renameName.trim() }
          : tag
      )));
      setTags(nextTags);
      setRenaming(null);
      setError('');
    } catch (caught) {
      saveCatalogTags(tags);
      setError(caught instanceof Error && caught.message === 'Tag already exists' ? 'Essa etiqueta já existe.' : 'Não foi possível salvar a etiqueta.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (removing === null || isSaving) return;
    try {
      setIsSaving(true);
      await updateAffectedDocuments(removing, (current) => current.filter((tag) => (
        tag.name.localeCompare(removing.name, undefined, { sensitivity: 'accent' }) !== 0
      )));
      setTags((current) => removeCatalogTag(current, removing.name));
      setRemoving(null);
      setError('');
    } catch {
      saveCatalogTags(tags);
      setError('Não foi possível remover a etiqueta.');
    } finally {
      setIsSaving(false);
    }
  };

  if (documentsQuery.isPending) return <p className="page-state" role="status">Carregando etiquetas…</p>;
  if (documentsQuery.isError) return <section className="page-state" role="alert"><h1>Etiquetas indisponíveis</h1><button className="button button--primary" type="button" onClick={() => void documentsQuery.refetch()}>Tentar novamente</button></section>;

  return (
    <section className="editor-page tag-management-page" aria-labelledby="tags-title">
      <header className="page-heading"><p className="eyebrow">Biblioteca</p><h1 id="tags-title">Etiquetas</h1><p>Crie, renomeie e remova etiquetas compartilhadas pelos seus documentos.</p></header>
      <div className="metadata-tag-form">
        <label><span className="sr-only">Nova etiqueta</span><input aria-label="Nova etiqueta" value={newName} disabled={isSaving} onChange={(event) => setNewName(event.target.value)} /></label>
        <button className="button button--secondary" type="button" disabled={newName.trim().length === 0 || isSaving} onClick={createTag}>Criar etiqueta</button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <ul className="tag-management-list" aria-label="Etiquetas cadastradas">
        {tags.map((tag) => <li key={tag.name}>
          <span className="metadata-tag" aria-label={`Etiqueta ${tag.name}`} style={{ '--tag-color': tag.color } as CSSProperties}>{tag.name}</span>
          {renaming?.name === tag.name ? <><label><span className="sr-only">Novo nome para {tag.name}</span><input aria-label={`Novo nome para ${tag.name}`} value={renameName} disabled={isSaving} onChange={(event) => setRenameName(event.target.value)} /></label><button className="button button--secondary" type="button" disabled={isSaving || renameName.trim().length === 0} onClick={() => void saveRename()}>Salvar etiqueta</button><button className="button button--quiet" type="button" disabled={isSaving} onClick={() => setRenaming(null)}>Cancelar</button></> : <><button className="button button--quiet" type="button" disabled={isSaving} aria-label={`Renomear etiqueta ${tag.name}`} onClick={() => { setRenaming(tag); setRenameName(tag.name); }}>Renomear</button><button className="button button--quiet button--destructive-text" type="button" disabled={isSaving} aria-label={`Remover etiqueta ${tag.name}`} onClick={() => setRemoving(tag)}>Remover</button></>}
        </li>)}
      </ul>
      <button className="button button--quiet" type="button" onClick={() => navigate('/')}>Voltar à biblioteca</button>
      {removing && <div className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-tag-title"><div className="delete-dialog__panel"><h2 id="remove-tag-title">Remover etiqueta</h2><p>Remover <strong>{removing.name}</strong> de todos os documentos que a utilizam?</p><div className="delete-dialog__actions"><button className="button button--quiet" type="button" disabled={isSaving} onClick={() => setRemoving(null)}>Cancelar</button><button className="button button--danger" type="button" disabled={isSaving} onClick={() => void confirmRemove()}>Remover etiqueta definitivamente</button></div></div></div>}
    </section>
  );
}
