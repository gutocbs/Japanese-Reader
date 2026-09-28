import {
  type FormEvent,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  AnalyzedToken,
  ReadingOverrideKey,
  SetReadingOverride,
} from '../../shared/api/client';


interface ReadingOverrideDialogProps {
  token: AnalyzedToken;
  documentRevision: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSave: (override: SetReadingOverride) => Promise<void>;
  onRemove: (key: ReadingOverrideKey) => Promise<void>;
}


export function ReadingOverrideDialog({
  token,
  documentRevision,
  returnFocusRef,
  onClose,
  onSave,
  onRemove,
}: ReadingOverrideDialogProps) {
  const titleId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(token.reading ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const key: ReadingOverrideKey = {
    documentRevision,
    startOffset: token.startOffset,
    endOffset: token.endOffset,
  };

  useLayoutEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const close = () => {
    if (isSaving) return;
    returnFocusRef.current?.focus();
    onClose();
  };

  const run = async (operation: () => Promise<void>) => {
    setError('');
    setIsSaving(true);
    try {
      await operation();
      close();
    } catch {
      setError('Não foi possível salvar. Use apenas kana.');
    } finally {
      setIsSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedInput = reading.trim();
    if (!normalizedInput) {
      setError('Informe uma leitura em kana.');
      return;
    }
    void run(() => onSave({ ...key, reading: normalizedInput }));
  };

  return createPortal(
    <section
      className="reading-override-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        if (!isSaving) close();
      }}
    >
      <form onSubmit={submit}>
        <p className="eyebrow">Correção desta ocorrência</p>
        <h2 id={titleId}>Corrigir leitura de {token.surface}</h2>
        <p>Leitura atual: <span lang="ja">{token.reading ?? 'sem leitura'}</span></p>
        <label className="field">
          Nova leitura em kana
          <input
            ref={inputRef}
            value={reading}
            lang="ja"
            inputMode="text"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setReading(event.target.value)}
          />
        </label>
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        <div className="reading-override-dialog__actions">
          {token.hasReadingOverride && (
            <button
              className="button button--secondary"
              type="button"
              disabled={isSaving}
              onClick={() => void run(() => onRemove(key))}
            >
              Remover correção
            </button>
          )}
          <button
            className="button button--secondary"
            type="button"
            disabled={isSaving}
            onClick={close}
          >
            Cancelar
          </button>
          <button className="button button--primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar correção'}
          </button>
        </div>
      </form>
    </section>,
    document.body,
  );
}
