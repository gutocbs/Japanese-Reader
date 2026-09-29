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
  const decreaseFontSize = () => onPreferencesChange({
    ...preferences,
    fontSizePx: preferences.fontSizePx - READER_FONT_SIZE_RANGE.step,
  });
  const increaseFontSize = () => onPreferencesChange({
    ...preferences,
    fontSizePx: preferences.fontSizePx + READER_FONT_SIZE_RANGE.step,
  });

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
          <div className="reader-menu__field">
            <span id="reader-font-size-label">Tamanho da fonte japonesa</span>
            <div className="reader-menu__font-size-control" role="group" aria-labelledby="reader-font-size-label">
              <button
                className="button button--secondary reader-menu__font-size-button"
                type="button"
                aria-label="Diminuir tamanho da fonte japonesa"
                disabled={preferences.fontSizePx <= READER_FONT_SIZE_RANGE.min}
                onClick={decreaseFontSize}
              >
                −
              </button>
              <output className="reader-menu__font-size-value" aria-live="polite">
                {preferences.fontSizePx} px
              </output>
              <button
                className="button button--secondary reader-menu__font-size-button"
                type="button"
                aria-label="Aumentar tamanho da fonte japonesa"
                disabled={preferences.fontSizePx >= READER_FONT_SIZE_RANGE.max}
                onClick={increaseFontSize}
              >
                ＋
              </button>
            </div>
          </div>
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
