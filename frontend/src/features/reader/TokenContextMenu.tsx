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
  return (
    <span className="reader-context-menu" role="menu" aria-label="Opções de furigana">
      {actions.map((action) => (
        <button
          key={action.visibility}
          type="button"
          role="menuitem"
          onClick={() => {
            onSetVisibility(action.visibility);
            onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </span>
  );
}
