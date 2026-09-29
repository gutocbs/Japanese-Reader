import { type CSSProperties, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { DocumentTag } from '../../shared/api/client';
import { documentKeys } from './queries';
import { TAG_COLOR_OPTIONS, tagColorForName } from './tags';

export function TagManagementPage() {
  const client = useDocumentClient();
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const documentsQuery = useQuery({ queryKey: documentKeys.list(), queryFn: () => client.list() });
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => client.listTags?.() ?? Promise.resolve([]) });
  const tags = tagsQuery.data ?? [];
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(tagColorForName(''));
  const [renaming, setRenaming] = useState<DocumentTag | null>(null);
  const [renameName, setRenameName] = useState('');
  const [removing, setRemoving] = useState<DocumentTag | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['tags'] }), queryClient.invalidateQueries({ queryKey: documentKeys.list() })]); };
  const createTag = async () => {
    try {
      if (client.createTag === undefined) throw new Error('Tag API unavailable');
      await client.createTag({ name: newName.trim(), color: newColor });
      setNewName('');
      setError('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? 'Essa etiqueta já existe.' : 'Não foi possível criar a etiqueta.');
    }
  };

  const saveRename = async () => {
    if (renaming === null || isSaving) return;
    try {
      setIsSaving(true);
      if (client.renameTag === undefined) throw new Error('Tag API unavailable');
      await client.renameTag(renaming.name, renameName.trim());
      await refresh();
      setRenaming(null);
      setError('');
    } catch (caught) {
      setError('Não foi possível salvar a etiqueta.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (removing === null || isSaving) return;
    try {
      setIsSaving(true);
      if (client.deleteTag === undefined) throw new Error('Tag API unavailable');
      await client.deleteTag(removing.name);
      await refresh();
      setRemoving(null);
      setError('');
    } catch {
      setError('Não foi possível remover a etiqueta.');
    } finally {
      setIsSaving(false);
    }
  };

  if (documentsQuery.isPending || tagsQuery.isPending) return <p className="page-state" role="status">Carregando etiquetas…</p>;
  if (documentsQuery.isError || tagsQuery.isError) return <section className="page-state" role="alert"><h1>Etiquetas indisponíveis</h1><button className="button button--primary" type="button" onClick={() => void tagsQuery.refetch()}>Tentar novamente</button></section>;

  return (
    <section className="editor-page tag-management-page" aria-labelledby="tags-title">
      <header className="page-heading"><p className="eyebrow">Biblioteca</p><h1 id="tags-title">Etiquetas</h1><p>Crie, renomeie e remova etiquetas compartilhadas pelos seus documentos.</p></header>
      <section className="tag-creation-panel" aria-labelledby="tag-creation-title">
        <div className="tag-creation-panel__heading">
          <div><p className="eyebrow">Nova organização</p><h2 id="tag-creation-title">Criar etiqueta</h2></div>
          <span className="metadata-tag" aria-label="Prévia da nova etiqueta" style={{ '--tag-color': newColor } as CSSProperties}>{newName.trim() || 'Prévia'}</span>
        </div>
        <div className="metadata-tag-form">
          <label><span className="sr-only">Nova etiqueta</span><input aria-label="Nova etiqueta" value={newName} disabled={isSaving} onChange={(event) => setNewName(event.target.value)} /></label>
          <button className="button button--secondary" type="button" disabled={newName.trim().length === 0 || isSaving} onClick={() => void createTag()}>Criar etiqueta</button>
        </div>
        <fieldset className="tag-color-picker" disabled={isSaving}>
          <legend>Cor da etiqueta</legend>
          <div className="tag-color-picker__options">
            {TAG_COLOR_OPTIONS.map(({ color, label }) => <label key={color} title={label} className="tag-color-picker__option" style={{ '--tag-color': color } as CSSProperties}>
              <input type="radio" name="new-tag-color" value={color} checked={newColor === color} onChange={() => setNewColor(color)} />
              <span aria-hidden="true" />
              <span className="sr-only">{label}</span>
            </label>)}
          </div>
        </fieldset>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      {tags.length === 0 && <p className="tag-management-empty" role="status">Nenhuma etiqueta criada. Crie a primeira para organizar sua biblioteca.</p>}
      <ul className="tag-management-list" aria-label="Etiquetas cadastradas">
        {tags.map((tag) => <li key={tag.name}>
          <span className="metadata-tag" aria-label={`Etiqueta ${tag.name}`} style={{ '--tag-color': tag.color } as CSSProperties}>{tag.name}</span>
          {renaming?.name === tag.name ? <><label><span className="sr-only">Novo nome para {tag.name}</span><input aria-label={`Novo nome para ${tag.name}`} value={renameName} disabled={isSaving} onChange={(event) => setRenameName(event.target.value)} /></label><button className="button button--secondary" type="button" disabled={isSaving || renameName.trim().length === 0} onClick={() => void saveRename()}>Salvar etiqueta</button><button className="button button--quiet" type="button" disabled={isSaving} onClick={() => setRenaming(null)}>Cancelar</button></> : <><button className="button button--quiet" type="button" disabled={isSaving} aria-label={`Renomear etiqueta ${tag.name}`} onClick={() => { setRenaming(tag); setRenameName(tag.name); }}>Renomear</button><button className="tag-remove-button" type="button" disabled={isSaving} aria-label={`Remover etiqueta ${tag.name}`} title={`Remover etiqueta ${tag.name}`} onClick={() => setRemoving(tag)}><span aria-hidden="true">×</span></button></>}
        </li>)}
      </ul>
      <button className="button button--quiet" type="button" onClick={() => navigate('/')}>Voltar à biblioteca</button>
      {removing && <div className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-tag-title"><div className="delete-dialog__panel"><h2 id="remove-tag-title">Remover etiqueta</h2><p>Remover <strong>{removing.name}</strong> de todos os documentos que a utilizam?</p><div className="delete-dialog__actions"><button className="button button--quiet" type="button" disabled={isSaving} onClick={() => setRemoving(null)}>Cancelar</button><button className="button button--danger" type="button" disabled={isSaving} onClick={() => void confirmRemove()}>Remover etiqueta definitivamente</button></div></div></div>}
    </section>
  );
}
