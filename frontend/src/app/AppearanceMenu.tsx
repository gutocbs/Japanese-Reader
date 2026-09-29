import { useState } from 'react';
import { useTheme } from './providers';

export function AppearanceMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const panelId = 'appearance-preferences-panel';

  return (
    <div className="appearance-menu">
      <button
        className="button button--secondary appearance-menu__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        Aparência
      </button>
      {isOpen && (
        <section id={panelId} className="appearance-menu__panel" aria-label="Aparência">
          <span className="appearance-menu__label">Tema</span>
          <label className="appearance-menu__choice">
            <input
              type="radio"
              name="theme"
              checked={theme === 'light'}
              onChange={() => setTheme('light')}
            />
            Tema claro
          </label>
          <label className="appearance-menu__choice">
            <input
              type="radio"
              name="theme"
              checked={theme === 'dark'}
              onChange={() => setTheme('dark')}
            />
            Tema escuro
          </label>
        </section>
      )}
    </div>
  );
}
