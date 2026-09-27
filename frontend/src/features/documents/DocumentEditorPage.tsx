import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { Document } from '../../shared/api/client';
import { useDocumentClient, useRouter } from '../../app/providers';

interface DocumentEditorPageProps {
  documentId?: string;
}

type OperationError = 'load' | 'save' | 'analysis' | null;

export function DocumentEditorPage({ documentId }: DocumentEditorPageProps) {
  const client = useDocumentClient();
  const { navigate } = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [savedDocument, setSavedDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(documentId !== undefined);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<OperationError>(null);

  const loadDocument = useCallback(async () => {
    if (documentId === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const document = await client.get(documentId);
      setSavedDocument(document);
      setTitle(document.title);
      setContent(document.content);
    } catch {
      setError('load');
    } finally {
      setIsLoading(false);
    }
  }, [client, documentId]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const analyzeAndRead = async () => {
    if (isPending || content.trim().length === 0) return;
    setIsPending(true);
    setError(null);

    let document = savedDocument;
    try {
      if (document === null) {
        document = await client.create({ title, content });
      } else if (document.title !== title || document.content !== content) {
        document = await client.update(document.id, { title, content });
      }
      setSavedDocument(document);
    } catch {
      setError('save');
      setIsPending(false);
      return;
    }

    try {
      const analysis = await client.analyze(document.id);
      navigate(`/documents/${encodeURIComponent(document.id)}/read`, { document, analysis });
    } catch {
      setError('analysis');
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void analyzeAndRead();
  };

  if (isLoading) {
    return <p className="page-state" role="status">Carregando documento…</p>;
  }

  if (error === 'load') {
    return (
      <section className="page-state" aria-labelledby="load-error-title">
        <p className="eyebrow">Documento indisponível</p>
        <h1 id="load-error-title">Não foi possível carregar o documento.</h1>
        <button className="button button--primary" type="button" onClick={() => void loadDocument()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  const actionLabel = documentId === undefined ? 'Analisar e ler' : 'Salvar e analisar';

  return (
    <section className="editor-page" aria-labelledby="editor-title">
      <header className="page-heading">
        <p className="eyebrow">Leitura local</p>
        <h1 id="editor-title">{documentId === undefined ? 'Novo documento' : 'Editar documento'}</h1>
        <p>O texto original permanece intacto enquanto a leitura é preparada.</p>
      </header>

      <form className="editor-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Título</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isPending}
          />
        </label>

        <label className="field">
          <span>Texto japonês</span>
          <textarea
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={isPending}
            rows={16}
          />
        </label>

        {content.trim().length === 0 && (
          <p className="field-hint">Digite algum texto japonês para analisar.</p>
        )}

        {error !== null && (
          <div className="error-message" role="alert">
            <p>
              {error === 'analysis'
                ? 'Não foi possível analisar o documento. Seu texto continua aqui.'
                : 'Não foi possível salvar o documento. Seu texto continua aqui.'}
            </p>
            <button className="button button--secondary" type="button" onClick={() => void analyzeAndRead()}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={isPending || content.trim().length === 0}
          >
            {isPending ? 'Analisando…' : actionLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
