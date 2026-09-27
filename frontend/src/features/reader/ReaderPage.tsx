import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentClient, useRouter } from '../../app/providers';
import type { Analysis, Document } from '../../shared/api/client';
import {
  decodeVocabularyKey,
  encodeVocabularyKey,
  orderedVocabularyEntries,
  ReviewList,
} from '../vocabulary/ReviewList';
import { DocumentText } from './DocumentText';

interface ReaderPageProps {
  documentId: string;
}

interface ReaderSnapshot {
  document: Document;
  analysis: Analysis;
}

function isReaderSnapshot(value: unknown, documentId: string): value is ReaderSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snapshot = value as Partial<ReaderSnapshot>;
  return snapshot.document?.id === documentId
    && snapshot.analysis?.documentId === documentId
    && snapshot.analysis.documentRevision === snapshot.document.revision;
}

export function ReaderPage({ documentId }: ReaderPageProps) {
  const client = useDocumentClient();
  const { location, navigate } = useRouter();
  const routedSnapshot = isReaderSnapshot(location.state, documentId) ? location.state : null;
  const [snapshot, setSnapshot] = useState<ReaderSnapshot | null>(routedSnapshot);
  const [isLoading, setIsLoading] = useState(routedSnapshot === null);
  const [hasError, setHasError] = useState(false);
  const [areSelectionsHydrated, setAreSelectionsHydrated] = useState(false);
  const [persistenceError, setPersistenceError] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const selectedKeysRef = useRef(selectedKeys);
  const desiredSelectionKeysRef = useRef(selectedKeys);
  const selectionWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const selectionIntentVersionRef = useRef(0);
  const requestGeneration = useRef(0);

  const loadReader = useCallback(async (candidate: ReaderSnapshot | null) => {
    const generation = ++requestGeneration.current;
    const ownsState = () => requestGeneration.current === generation;
    if (candidate !== null) setSnapshot(candidate);
    setIsLoading(candidate === null);
    setHasError(false);
    setAreSelectionsHydrated(false);
    setPersistenceError('');
    try {
      const [document, selections] = await Promise.all([
        client.get(documentId),
        client.listVocabularySelections(documentId),
      ]);
      if (!ownsState()) return;
      const analysis = candidate?.analysis.documentRevision === document.revision
        ? candidate.analysis
        : await client.analyze(documentId);
      if (!ownsState()) return;
      if (analysis.documentRevision !== document.revision) {
        throw new Error('Analysis revision does not match the document');
      }
      const loadedKeys = new Set(selections.map(encodeVocabularyKey));
      selectedKeysRef.current = loadedKeys;
      desiredSelectionKeysRef.current = loadedKeys;
      setSelectedKeys(loadedKeys);
      setSnapshot({ document, analysis });
      setAreSelectionsHydrated(true);
    } catch {
      if (ownsState()) setHasError(true);
    } finally {
      if (ownsState()) setIsLoading(false);
    }
  }, [client, documentId]);

  useEffect(() => {
    void loadReader(routedSnapshot);
    return () => {
      requestGeneration.current += 1;
    };
  }, [loadReader, routedSnapshot]);

  const toggleVocabulary = useCallback((key: string) => {
    if (!areSelectionsHydrated) return;
    const decoded = decodeVocabularyKey(key);
    if (decoded === null) return;
    const next = new Set(desiredSelectionKeysRef.current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    desiredSelectionKeysRef.current = next;
    setPersistenceError('');
    const intentVersion = ++selectionIntentVersionRef.current;

    const selections = [...next]
      .map(decodeVocabularyKey)
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    const write = selectionWriteChainRef.current.then(async () => {
      try {
        await client.replaceVocabularySelections(documentId, selections);
        selectedKeysRef.current = next;
        setSelectedKeys(next);
      } catch {
        try {
          const serverSelections = await client.listVocabularySelections(documentId);
          const confirmedKeys = new Set(serverSelections.map(encodeVocabularyKey));
          selectedKeysRef.current = confirmedKeys;
          setSelectedKeys(confirmedKeys);
          if (selectionIntentVersionRef.current === intentVersion) {
            desiredSelectionKeysRef.current = confirmedKeys;
          }
        } catch {
          if (selectionIntentVersionRef.current === intentVersion) {
            desiredSelectionKeysRef.current = selectedKeysRef.current;
          }
        }
        setPersistenceError('Não foi possível salvar as marcações.');
      }
    });
    selectionWriteChainRef.current = write;
  }, [areSelectionsHydrated, client, documentId]);

  if (isLoading) {
    return <p className="page-state" role="status">Preparando leitura…</p>;
  }

  if (hasError || snapshot === null) {
    return (
      <section className="page-state" aria-labelledby="reader-error-title">
        <p className="eyebrow">Leitura indisponível</p>
        <h1 id="reader-error-title">Não foi possível preparar a leitura.</h1>
        <p>Você pode tentar novamente sem alterar o documento.</p>
        <button className="button button--primary" type="button" onClick={() => void loadReader(null)}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <article className="reader-page" aria-labelledby="reader-title">
      <header className="reader-heading">
        <div>
          <p className="eyebrow">Modo de leitura</p>
          <h1 id="reader-title">{snapshot.document.title || 'Sem título'}</h1>
        </div>
        <a
          className="text-link"
          href={`/documents/${encodeURIComponent(documentId)}/edit`}
          onClick={(event) => {
            event.preventDefault();
            navigate(`/documents/${encodeURIComponent(documentId)}/edit`);
          }}
        >
          Editar documento
        </a>
      </header>
      <DocumentText
        content={snapshot.document.content}
        analysis={snapshot.analysis}
        selectedKeys={selectedKeys}
        onToggleVocabulary={areSelectionsHydrated ? toggleVocabulary : undefined}
      />
      {persistenceError && (
        <p className="reader-persistence-status" role="status" aria-live="polite" aria-atomic="true">
          {persistenceError}
        </p>
      )}
      <ReviewList
        entries={orderedVocabularyEntries(snapshot.analysis, selectedKeys)}
        onRemove={areSelectionsHydrated ? toggleVocabulary : () => undefined}
      />
    </article>
  );
}
