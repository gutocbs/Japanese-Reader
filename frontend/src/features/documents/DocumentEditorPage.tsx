import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  isReadingOverridesConfirmationRequired,
  type Document,
} from '../../shared/api/client';
import { useDocumentClient, useRouter } from '../../app/providers';
import { ContentEditConfirmationDialog } from './ContentEditConfirmationDialog';
import { documentKeys } from './queries';

interface DocumentEditorPageProps {
  documentId?: string;
}

type OperationError = 'load' | 'save' | 'analysis' | 'stale-analysis' | null;

interface EditorDraft {
  documentId: string | null;
  title: string;
  content: string;
}

function routedDraft(state: unknown, documentId: string | undefined): EditorDraft | null {
  if (typeof state !== 'object' || state === null || !('editorDraft' in state)) return null;
  const draft = (state as { editorDraft?: unknown }).editorDraft;
  if (typeof draft !== 'object' || draft === null) return null;
  const candidate = draft as Partial<EditorDraft>;
  if (
    candidate.documentId !== (documentId ?? null)
    || typeof candidate.title !== 'string'
    || typeof candidate.content !== 'string'
  ) return null;
  return candidate as EditorDraft;
}

export function DocumentEditorPage({ documentId }: DocumentEditorPageProps) {
  const client = useDocumentClient();
  const { location, navigate, replaceState } = useRouter();
  const queryClient = useQueryClient();
  const initialDraft = useRef(routedDraft(location.state, documentId));
  const [title, setTitle] = useState(initialDraft.current?.title ?? '');
  const [content, setContent] = useState(initialDraft.current?.content ?? '');
  const [savedDocument, setSavedDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(documentId !== undefined);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<OperationError>(null);
  const [needsOverrideConfirmation, setNeedsOverrideConfirmation] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const restoreSubmitFocusRef = useRef(false);

  useEffect(() => {
    if (isPending || needsOverrideConfirmation || !restoreSubmitFocusRef.current) return;
    restoreSubmitFocusRef.current = false;
    submitButtonRef.current?.focus();
  }, [isPending, needsOverrideConfirmation]);

  const loadDocument = useCallback(async () => {
    if (documentId === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const document = await client.get(documentId);
      queryClient.setQueryData(documentKeys.detail(documentId), document);
      setSavedDocument(document);
      if (initialDraft.current === null) {
        setTitle(document.title);
        setContent(document.content);
      }
    } catch {
      setError('load');
    } finally {
      setIsLoading(false);
    }
  }, [client, documentId, queryClient]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const analyzeAndRead = async (confirmReadingOverrideRemoval = false) => {
    if (isPending || content.trim().length === 0) return;
    setIsPending(true);
    setError(null);

    let document = savedDocument;
    try {
      if (document === null) {
        document = await client.create({ title, content });
      } else if (document.title !== title || document.content !== content) {
        document = await client.update(document.id, {
          title,
          content,
          ...(confirmReadingOverrideRemoval
            ? { confirmReadingOverrideRemoval: true }
            : {}),
        });
      }
      setSavedDocument(document);
      queryClient.setQueryData(documentKeys.detail(document.id), document);
      await queryClient.invalidateQueries({ queryKey: documentKeys.list() });
    } catch (saveError) {
      if (
        !confirmReadingOverrideRemoval
        && isReadingOverridesConfirmationRequired(saveError)
      ) {
        setNeedsOverrideConfirmation(true);
        setIsPending(false);
        return;
      }
      setError('save');
      if (confirmReadingOverrideRemoval) {
        restoreSubmitFocusRef.current = true;
        setNeedsOverrideConfirmation(false);
      }
      setIsPending(false);
      return;
    }

    try {
      const analysis = await client.analyze(document.id);
      if (analysis.documentRevision !== document.revision) {
        setError('stale-analysis');
        return;
      }
      queryClient.setQueryData(
        documentKeys.analysis(document.id, document.revision),
        analysis,
      );
      await queryClient.invalidateQueries({ queryKey: documentKeys.list() });
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

  const preserveDraft = (nextTitle: string, nextContent: string) => {
    replaceState({
      editorDraft: {
        documentId: documentId ?? null,
        title: nextTitle,
        content: nextContent,
      },
    });
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
        <a
          className="text-link"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate('/');
          }}
        >
          Voltar à biblioteca
        </a>
      </header>

      <form className="editor-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Título</span>
          <input
            name="title"
            value={title}
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              preserveDraft(nextTitle, content);
            }}
            disabled={isPending}
          />
        </label>

        <label className="field">
          <span>Texto japonês</span>
          <textarea
            name="content"
            value={content}
            onChange={(event) => {
              const nextContent = event.target.value;
              setContent(nextContent);
              preserveDraft(title, nextContent);
            }}
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
              {error === 'stale-analysis'
                ? 'A análise recebida pertence a uma versão anterior do documento. Seu texto continua aqui.'
                : error === 'analysis'
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
            ref={submitButtonRef}
            className="button button--primary"
            type="submit"
            disabled={isPending || content.trim().length === 0}
          >
            {isPending ? 'Analisando…' : actionLabel}
          </button>
        </div>
      </form>
      {needsOverrideConfirmation && (
        <ContentEditConfirmationDialog
          isPending={isPending}
          returnFocusRef={submitButtonRef}
          onCancel={() => setNeedsOverrideConfirmation(false)}
          onConfirm={() => void analyzeAndRead(true)}
        />
      )}
    </section>
  );
}
