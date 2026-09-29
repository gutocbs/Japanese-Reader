import { useAppSettings, useRouter } from '../../app/providers';
import { READER_FONT_SIZE_RANGE } from '../reader/preferences';

export function SettingsPage() {
  const { settings, updateSettings } = useAppSettings();
  const { navigate } = useRouter();

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header className="page-heading">
        <p className="eyebrow">Preferências locais</p>
        <h1 id="settings-title">Configurações</h1>
        <p>Estas preferências ficam somente neste navegador.</p>
      </header>
      <form className="settings-form">
        <fieldset className="settings-fieldset">
          <legend>Tema</legend>
          <label className="settings-choice">
            <input
              type="radio"
              name="theme"
              checked={settings.theme === 'light'}
              onChange={() => updateSettings({ ...settings, theme: 'light' })}
            />
            Tema claro
          </label>
          <label className="settings-choice">
            <input
              type="radio"
              name="theme"
              checked={settings.theme === 'dark'}
              onChange={() => updateSettings({ ...settings, theme: 'dark' })}
            />
            Tema escuro
          </label>
        </fieldset>
        <label className="field">
          <span>Tamanho padrão da fonte japonesa</span>
          <input
            type="number"
            min={READER_FONT_SIZE_RANGE.min}
            max={READER_FONT_SIZE_RANGE.max}
            step={READER_FONT_SIZE_RANGE.step}
            value={settings.defaultReaderFontSizePx}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value)
                && value >= READER_FONT_SIZE_RANGE.min
                && value <= READER_FONT_SIZE_RANGE.max) {
                updateSettings({ ...settings, defaultReaderFontSizePx: value });
              }
            }}
          />
        </label>
        <label className="settings-choice">
          <input
            type="checkbox"
            checked={settings.lineBreakNormalizationEnabled}
            onChange={(event) => updateSettings({
              ...settings,
              lineBreakNormalizationEnabled: event.target.checked,
            })}
          />
          Disponibilizar ação para unir quebras de linha
        </label>
        <button className="button button--secondary" type="button" onClick={() => navigate('/')}>
          Voltar à biblioteca
        </button>
      </form>
    </section>
  );
}
