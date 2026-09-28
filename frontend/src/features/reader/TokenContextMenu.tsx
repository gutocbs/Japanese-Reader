import { useLayoutEffect, useRef } from 'react';
import type { FuriganaVisibility } from './preferences';

interface TokenContextMenuProps {
  onClose: () => void;
  onSetVisibility: (visibility: FuriganaVisibility) => void;
}

const actions: readonly { label: string; visibility: FuriganaVisibility }[] = [
  { label: 'Sempre mostrar furigana', visibility: 'show' },
  { label: 'Ocultar furigana', visibility: 'hide' },
  { label: 'Seguir configuração geral', visibility: 'inherit' },
];

export function TokenContextMenu({ onClose, onSetVisibility }: TokenContextMenuProps) {
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const selectVisibility = (visibility: FuriganaVisibility) => {
    onSetVisibility(visibility);
    onClose();
  };

  useLayoutEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  return (
    <span className="reader-context-menu" role="menu" aria-label="Opções de furigana">
      {actions.map((action) => (
        <button
          key={action.visibility}
          ref={action.visibility === 'show' ? firstItemRef : undefined}
          type="button"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            selectVisibility(action.visibility);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            selectVisibility(action.visibility);
          }}
        >
          {action.label}
        </button>
      ))}
    </span>
  );
}
