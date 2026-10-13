import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDocumentClient } from '../../app/providers';
import { ApiError, type ReadingException } from '../../shared/api/client';

const readingExceptionsKey = ['reading-exceptions'] as const;

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.problem?.detail !== undefined
    ? error.problem.detail
    : fallback;
}

export function ReadingExceptionsPage() {
  const client = useDocumentClient();
  const queryClient = useQueryClient();
  const [lemma, setLemma] = useState('');
  const [reading, setReading] = useState('');
  const [editing, setEditing] = useState<ReadingException | null>(null);
  const [editedReading, setEditedReading] = useState('');
  const [removing, setRemoving] = useState<ReadingException | null>(null);
  const [notice, setNotice] = useState('');
  const [operationError, setOperationError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const removeTriggerRef = useRef<HTMLButtonElement>(null);

  const exceptionsQuery = useQuery({
    queryKey: readingExceptionsKey,
    queryFn: () => {
      if (client.listReadingExceptions === undefined) {
        throw new Error('Reading exceptions API unavailable');
      }
      return client.listReadingExceptions();
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: readingExceptionsKey });
  const clearFeedback = () => {
    setNotice('');
    setOperationError('');
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (client.setReadingException === undefined) throw new Error('Reading exceptions API unavailable');
      return client.setReadingException(lemma, { reading });
    },
    onSuccess: async () => {
      setLemma('');
      setReading('');
      setNotice('Exceção adicionada.');
      await refresh();
    },
    onError: (error) => setOperationError(messageFor(error, 'Não foi possível adicionar a exceção.')),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (editing === null || client.setReadingException === undefined) throw new Error('Reading exceptions API unavailable');
      return client.setReadingException(editing.lemma, { reading: editedReading });
    },
    onSuccess: async () => {
      setEditing(null);
      setNotice('Exceção atualizada.');
      await refresh();
    },
    onError: (error) => setOperationError(messageFor(error, 'Não foi possível atualizar a exceção.')),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (removing === null || client.deleteReadingException === undefined) throw new Error('Reading exceptions API unavailable');
      return client.deleteReadingException(removing.lemma);
    },
    onSuccess: async () => {
      setRemoving(null);
      setNotice('Exceção removida.');
      await refresh();
    },
    onError: (error) => setOperationError(messageFor(error, 'Não foi possível remover a exceção.')),
  });

  useEffect(() => {
    if (removing !== null) dialogRef.current?.focus();
  }, [removing]);

  const closeRemove = () => {
    setRemoving(null);
    requestAnimationFrame(() => removeTriggerRef.current?.focus());
  };

  if (exceptionsQuery.isPending) {
    return <p className="reading-exceptions-page__state" role="status">Carregando exceções de leitura…</p>;
  }

  if (exceptionsQuery.isError) {
    return <section className="reading-exceptions-page__state" role="alert"><h1>Exceções de leitura indisponíveis</h1><button className="button button--primary" type="button" onClick={() => void exceptionsQuery.refetch()}>Tentar novamente</button></section>;
  }

  const exceptions = (exceptionsQuery.data ?? []).filter((exception) => exception.deletedAt === null);
  const canAdd = lemma.trim().length > 0 && reading.trim().length > 0 && !addMutation.isPending;
  const isEditing = editing !== null;

  return (
    <section className="editor-page reading-exceptions-page" aria-labelledby="reading-exceptions-title">
      <header className="page-heading reading-exceptions-page__heading">
        <div><p className="eyebrow">Leitura · Catálogo global</p><h1 id="reading-exceptions-title">Exceções de leitura</h1><p>Defina leituras compartilhadas para lemas específicos.</p></div>
      </header>
      <form className="reading-exceptions-page__add-form" onSubmit={(event) => { event.preventDefault(); if (canAdd) { clearFeedback(); addMutation.mutate(); } }}>
        <label>Lemma<input value={lemma} disabled={addMutation.isPending} onChange={(event) => setLemma(event.target.value)} /></label>
        <label>Leitura<input value={reading} disabled={addMutation.isPending} onChange={(event) => setReading(event.target.value)} /></label>
        <button className="button button--primary" type="submit" disabled={!canAdd}>{addMutation.isPending ? 'Adicionando exceção…' : 'Adicionar exceção'}</button>
      </form>
      {(addMutation.isPending || editMutation.isPending || deleteMutation.isPending || notice) && <p className="reading-exceptions-page__notice" role="status" aria-live="polite">{notice || 'Salvando exceção…'}</p>}
      {operationError && <p className="field-error" role="alert">{operationError}</p>}
      {exceptions.length === 0 && <p className="reading-exceptions-page__empty" role="status">Nenhuma exceção cadastrada.</p>}
      <ul className="reading-exceptions-page__list" aria-label="Exceções de leitura cadastradas">
        {exceptions.map((exception) => {
          const rowEditing = isEditing && editing.lemma === exception.lemma;
          return <li key={exception.lemma} className={rowEditing ? 'reading-exceptions-page__row reading-exceptions-page__row--editing' : 'reading-exceptions-page__row'}>
            <div className="reading-exceptions-page__values"><strong>{exception.lemma}</strong><span>{exception.reading}</span></div>
            {rowEditing ? <div className="reading-exceptions-page__editor"><label><span className="sr-only">Leitura para {exception.lemma}</span><input aria-label={`Leitura para ${exception.lemma}`} value={editedReading} disabled={editMutation.isPending} onChange={(event) => setEditedReading(event.target.value)} /></label><button className="button button--secondary" type="button" disabled={editMutation.isPending || editedReading.trim().length === 0} onClick={() => { clearFeedback(); editMutation.mutate(); }}>Salvar leitura</button><button className="button button--quiet" type="button" disabled={editMutation.isPending} onClick={() => setEditing(null)}>Cancelar edição</button></div> : <div className="reading-exceptions-page__actions"><button className="button button--quiet" type="button" disabled={editMutation.isPending} aria-label={`Editar exceção ${exception.lemma}`} onClick={() => { clearFeedback(); setEditing(exception); setEditedReading(exception.reading); }}>Editar</button><button ref={removeTriggerRef} className="tag-remove-button" type="button" disabled={deleteMutation.isPending} aria-label={`Remover exceção ${exception.lemma}`} onClick={(event) => { clearFeedback(); removeTriggerRef.current = event.currentTarget; setRemoving(exception); }}><span aria-hidden="true">×</span></button></div>}
          </li>;
        })}
      </ul>
      {removing && <div ref={dialogRef} className="delete-dialog" role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="remove-reading-exception-title" aria-describedby="remove-reading-exception-description" onKeyDown={(event) => { if (event.key === 'Escape' && !deleteMutation.isPending) { event.preventDefault(); closeRemove(); } }}><div className="delete-dialog__panel"><p className="eyebrow">Ação permanente</p><h2 id="remove-reading-exception-title">Remover exceção</h2><p id="remove-reading-exception-description">A exceção para <strong>{removing.lemma}</strong> será removida. Essa ação não pode ser desfeita.</p><div className="delete-dialog__actions"><button className="button button--quiet" type="button" disabled={deleteMutation.isPending} onClick={closeRemove}>Cancelar remoção</button><button className="button button--danger" type="button" disabled={deleteMutation.isPending} onClick={() => { clearFeedback(); deleteMutation.mutate(); }}>{deleteMutation.isPending ? 'Removendo exceção…' : 'Remover exceção definitivamente'}</button></div></div></div>}
    </section>
  );
}
