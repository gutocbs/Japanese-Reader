import { useLayoutEffect, useRef } from 'react';
import type { FuriganaVisibility } from './preferences';

interface TokenContextMenuProps {
  onClose: () => void;
  onSetVisibility?: (visibility: FuriganaVisibility) => void;
  furiganaVisible?: boolean;
  furiganaVisibility?: FuriganaVisibility;
  onEditReading?: () => void;
  onRemoveReading?: () => void;
}

export function TokenContextMenu({
  onClose,
  onSetVisibility,
  furiganaVisible = true,
  furiganaVisibility = 'inherit',
  onEditReading,
  onRemoveReading,
}: TokenContextMenuProps) {
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const toggleAction = furiganaVisible
    ? { label: 'Ocultar furigana', visibility: 'hide' as const }
    : { label: 'Mostrar furigana', visibility: 'show' as const };
  const selectVisibility = (visibility: FuriganaVisibility) => {
    onSetVisibility?.(visibility);
    onClose();
  };

  useLayoutEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  return (
    <span className="reader-context-menu" role="menu" aria-label="Opções da palavra">
      {onEditReading && (
        <button
          ref={firstItemRef}
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onEditReading();
          }}
        >
          Corrigir leitura
        </button>
      )}
      {onRemoveReading && (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            onRemoveReading();
          }}
        >
          Remover correção
        </button>
      )}
      {onSetVisibility && (
        <button
          ref={!onEditReading ? firstItemRef : undefined}
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            selectVisibility(toggleAction.visibility);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            selectVisibility(toggleAction.visibility);
          }}
        >
          {toggleAction.label}
        </button>
      )}
      {onSetVisibility && furiganaVisibility !== 'inherit' && (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            selectVisibility('inherit');
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            selectVisibility('inherit');
          }}
        >
          Seguir configuração geral
        </button>
      )}
    </span>
  );
}
