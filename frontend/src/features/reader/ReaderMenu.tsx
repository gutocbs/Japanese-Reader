import { useState } from 'react';
import {
  READER_FONT_SIZE_RANGE,
  type ReaderPreferences,
} from './preferences';

interface ReaderMenuProps {
  preferences: ReaderPreferences;
  onPreferencesChange: (preferences: ReaderPreferences) => void;
}

export function ReaderMenu({ preferences, onPreferencesChange }: ReaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = 'reader-preferences-panel';

  return (
    <div className="reader-menu">
      <button
        className="button button--secondary"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        Preferências de leitura
      </button>
      {isOpen && (
        <section id={panelId} className="reader-menu__panel" aria-label="Preferências de leitura">
          <label className="reader-menu__field" htmlFor="reader-font-size">
            <span>Tamanho da fonte japonesa</span>
            <input
              id="reader-font-size"
              type="range"
              min={READER_FONT_SIZE_RANGE.min}
              max={READER_FONT_SIZE_RANGE.max}
              step={READER_FONT_SIZE_RANGE.step}
              value={preferences.fontSizePx}
              onChange={(event) => onPreferencesChange({
                ...preferences,
                fontSizePx: Number(event.target.value),
              })}
            />
          </label>
          <label className="reader-menu__toggle">
            <input
              type="checkbox"
              checked={preferences.showFurigana}
              onChange={(event) => onPreferencesChange({
                ...preferences,
                showFurigana: event.target.checked,
              })}
            />
            Exibir furigana
          </label>
        </section>
      )}
    </div>
  );
}
