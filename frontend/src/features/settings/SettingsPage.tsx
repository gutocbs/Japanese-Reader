import { useState } from 'react';
import { useAppSettings, useRouter } from '../../app/providers';
import { READER_FONT_SIZE_RANGE } from '../reader/preferences';

export function SettingsPage() {
  const { settings, updateSettings } = useAppSettings();
  const { navigate } = useRouter();
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);
  const lineBreakExperimentAvailable = import.meta.env.VITE_ENABLE_LINE_BREAK_NORMALIZATION !== 'false';

  function applySettings(nextSettings: typeof settings) {
    setFeedback(updateSettings(nextSettings) ? 'saved' : 'error');
  }

  function changeDefaultFontSize(direction: -1 | 1) {
    const nextSize = settings.defaultReaderFontSizePx + (direction * READER_FONT_SIZE_RANGE.step);
    if (nextSize >= READER_FONT_SIZE_RANGE.min && nextSize <= READER_FONT_SIZE_RANGE.max) {
      applySettings({ ...settings, defaultReaderFontSizePx: nextSize });
    }
  }

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header className="page-heading">
        <p className="eyebrow">Preferências locais</p>
        <h1 id="settings-title">Configurações</h1>
        <p>Estas preferências ficam somente neste navegador.</p>
      </header>
      <form className="settings-form">
        <fieldset className="settings-section">
          <legend>Aparência</legend>
          <p className="settings-section__description">Escolha o contraste mais confortável para sua sessão.</p>
          <div className="settings-theme-options" role="radiogroup" aria-label="Tema">
            <label className={`settings-theme-option${settings.theme === 'light' ? ' settings-theme-option--active' : ''}`}>
              <input
                type="radio"
                name="theme"
                checked={settings.theme === 'light'}
                onChange={() => applySettings({ ...settings, theme: 'light' })}
              />
              <span>Tema claro</span>
            </label>
            <label className={`settings-theme-option${settings.theme === 'dark' ? ' settings-theme-option--active' : ''}`}>
              <input
                type="radio"
                name="theme"
                checked={settings.theme === 'dark'}
                onChange={() => applySettings({ ...settings, theme: 'dark' })}
              />
              <span>Tema escuro</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="settings-section">
          <legend>Leitura</legend>
          <div className="settings-font-control">
            <div>
              <p className="settings-control-label">Tamanho padrão da fonte japonesa</p>
              <p className="settings-section__description">Usado ao abrir leituras sem um tamanho já salvo.</p>
            </div>
            <div className="settings-font-control__actions" aria-label="Tamanho padrão da fonte japonesa">
              <button
                className="settings-font-control__button"
                type="button"
                aria-label="Diminuir tamanho padrão da fonte japonesa"
                disabled={settings.defaultReaderFontSizePx <= READER_FONT_SIZE_RANGE.min}
                onClick={() => changeDefaultFontSize(-1)}
              >
                −
              </button>
              <output className="settings-font-control__value" aria-live="polite">
                {settings.defaultReaderFontSizePx} px
              </output>
              <button
                className="settings-font-control__button"
                type="button"
                aria-label="Aumentar tamanho padrão da fonte japonesa"
                disabled={settings.defaultReaderFontSizePx >= READER_FONT_SIZE_RANGE.max}
                onClick={() => changeDefaultFontSize(1)}
              >
                +
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset className="settings-section">
          <legend>Experimentos</legend>
          <label className={`settings-experiment${settings.lineBreakNormalizationEnabled ? ' settings-experiment--active' : ''}`}>
            <input
              type="checkbox"
              aria-label="Disponibilizar ação para unir quebras de linha"
              aria-describedby="line-break-experiment-description"
              checked={settings.lineBreakNormalizationEnabled}
              disabled={!lineBreakExperimentAvailable}
              onChange={(event) => applySettings({
                ...settings,
                lineBreakNormalizationEnabled: event.target.checked,
              })}
            />
            <span>
              <strong>Disponibilizar ação para unir quebras de linha</strong>
              <span id="line-break-experiment-description" className="settings-experiment__description">
                {lineBreakExperimentAvailable
                  ? 'A ação continua opcional e pode ser desfeita antes de salvar o texto.'
                  : 'Este experimento foi desativado nesta instalação.'}
              </span>
            </span>
          </label>
        </fieldset>

        {feedback && (
          <p className={`settings-feedback settings-feedback--${feedback}`} role={feedback === 'error' ? 'alert' : 'status'} aria-live="polite">
            {feedback === 'saved'
              ? 'Configurações salvas neste navegador.'
              : 'Não foi possível salvar as configurações neste navegador.'}
          </p>
        )}
        <button className="button button--secondary" type="button" onClick={() => navigate('/')}>
          Voltar à biblioteca
        </button>
      </form>
    </section>
  );
}
