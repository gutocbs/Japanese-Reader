import { useEffect, useRef } from 'react';
import type { Document } from '../../shared/api/client';

interface DeleteDocumentDialogProps {
  document: Document;
  error: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDocumentDialog({
  document,
  error,
  isPending,
  onCancel,
  onConfirm,
}: DeleteDocumentDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onCancel]);

  return (
    <div className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="delete-dialog__panel">
        <p className="eyebrow">Confirmação necessária</p>
        <h2 id="delete-title">Excluir documento</h2>
        <p>
          “{document.title || 'Sem título'}” e seus dados de leitura serão removidos desta sessão.
        </p>
        {error && (
          <p className="field-error" role="alert">
            Não foi possível excluir o documento. Ele continua na biblioteca.
          </p>
        )}
        <div className="delete-dialog__actions">
          <button
            ref={cancelButton}
            className="button button--secondary"
            type="button"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending
              ? 'Excluindo…'
              : error ? 'Tentar excluir novamente' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
