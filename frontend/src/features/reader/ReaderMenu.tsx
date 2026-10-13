import {
  READER_FONT_SIZE_RANGE,
  type ReaderPreferences,
} from './preferences';

interface ReaderMenuProps {
  preferences: ReaderPreferences;
  onPreferencesChange: (preferences: ReaderPreferences) => void;
}

export function ReaderMenu({ preferences, onPreferencesChange }: ReaderMenuProps) {
  const decreaseFontSize = () => onPreferencesChange({
    ...preferences,
    fontSizePx: preferences.fontSizePx - READER_FONT_SIZE_RANGE.step,
  });
  const increaseFontSize = () => onPreferencesChange({
    ...preferences,
    fontSizePx: preferences.fontSizePx + READER_FONT_SIZE_RANGE.step,
  });
  const furiganaAction = preferences.showFurigana ? 'Ocultar furigana' : 'Mostrar furigana';

  return (
    <div className="reader-menu" role="group" aria-label="Controles de leitura">
      <button
        className="reader-rail__button"
        type="button"
        aria-label="Aumentar tamanho da fonte japonesa"
        title="Aumentar tamanho da fonte japonesa"
        disabled={preferences.fontSizePx >= READER_FONT_SIZE_RANGE.max}
        onClick={increaseFontSize}
      >
        <span aria-hidden="true">＋</span>
      </button>
      <output className="reader-rail__font-size" aria-live="polite">
        {preferences.fontSizePx} px
      </output>
      <button
        className="reader-rail__button"
        type="button"
        aria-label="Diminuir tamanho da fonte japonesa"
        title="Diminuir tamanho da fonte japonesa"
        disabled={preferences.fontSizePx <= READER_FONT_SIZE_RANGE.min}
        onClick={decreaseFontSize}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="reader-rail__divider" aria-hidden="true" />
      <button
        className={`reader-rail__button reader-rail__furigana${preferences.showFurigana ? ' reader-rail__furigana--active' : ''}`}
        type="button"
        aria-label={furiganaAction}
        title={furiganaAction}
        aria-pressed={preferences.showFurigana}
        onClick={() => onPreferencesChange({
          ...preferences,
          showFurigana: !preferences.showFurigana,
        })}
      >
        <span aria-hidden="true">あ</span>
      </button>
    </div>
  );
}
