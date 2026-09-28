import { type KeyboardEvent, type RefObject, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Document } from '../../shared/api/client';

interface DeleteDocumentDialogProps {
  document: Document;
  error: boolean;
  isPending: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteDocumentDialog({
  document,
  error,
  isPending,
  returnFocusRef,
  onCancel,
  onConfirm,
}: DeleteDocumentDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    cancelButton.current?.focus();
  }, []);

  const close = () => {
    if (isPending) return;
    returnFocusRef.current?.focus();
    onCancel();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && globalThis.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && globalThis.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="delete-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <div className="delete-dialog__panel">
        <p className="eyebrow">Confirmação necessária</p>
        <h2 id={titleId}>Excluir documento</h2>
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
            onClick={close}
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
    </div>,
    globalThis.document.body,
  );
}
