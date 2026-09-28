import {
  type KeyboardEvent,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

interface ContentEditConfirmationDialogProps {
  isPending: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ContentEditConfirmationDialog({
  isPending,
  returnFocusRef,
  onCancel,
  onConfirm,
}: ContentEditConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    cancelButtonRef.current?.focus();
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
        <h2 id={titleId}>Remover correções de leitura?</h2>
        <p>
          Ao alterar o texto, as correções manuais de leitura serão removidas porque
          pertencem à versão atual do documento.
        </p>
        <div className="delete-dialog__actions">
          <button
            ref={cancelButtonRef}
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
            {isPending ? 'Salvando…' : 'Continuar e remover correções'}
          </button>
        </div>
      </div>
    </div>,
    globalThis.document.body,
  );
}
