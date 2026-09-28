import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentClient, useRouter } from '../../app/providers';
import type {
  Analysis,
  Document,
  ReadingOverrideKey,
  SetReadingOverride,
} from '../../shared/api/client';
import {
  decodeVocabularyKey,
  encodeVocabularyKey,
  orderedVocabularyEntries,
  ReviewList,
} from '../vocabulary/ReviewList';
import { DocumentText } from './DocumentText';
import { ReaderMenu } from './ReaderMenu';
import {
  loadReaderPreferences,
  saveReaderPreferences,
  type FuriganaVisibility,
  type ReaderPreferences,
} from './preferences';

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

function replaceAnalysisOccurrence(
  current: Analysis,
  refreshed: Analysis,
  key: ReadingOverrideKey,
): Analysis {
  if (refreshed.documentRevision !== key.documentRevision) {
    throw new Error('Reading override analysis revision changed');
  }
  const replacement = refreshed.blocks
    .flatMap((block) => block.tokens)
    .find((token) => (
      token.startOffset === key.startOffset && token.endOffset === key.endOffset
    ));
  if (replacement === undefined) throw new Error('Reading override token disappeared');
  let replaced = false;
  const blocks = current.blocks.map((block) => ({
    ...block,
    tokens: block.tokens.map((token) => {
      if (token.startOffset !== key.startOffset || token.endOffset !== key.endOffset) return token;
      replaced = true;
      return replacement;
    }),
  }));
  if (!replaced) throw new Error('Reading override token is not in the current reader');
  return { ...current, blocks, diagnostics: refreshed.diagnostics };
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
  const [readerPreferences, setReaderPreferences] = useState<ReaderPreferences>(
    loadReaderPreferences,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [displayPreferences, setDisplayPreferences] = useState<
    ReadonlyMap<string, FuriganaVisibility>
  >(() => new Map());
  const [areDisplayPreferencesHydrated, setAreDisplayPreferencesHydrated] = useState(false);
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
    setAreDisplayPreferencesHydrated(false);
    setPersistenceError('');
    try {
      const [document, selections, loadedDisplayPreferences] = await Promise.all([
        client.get(documentId),
        client.listVocabularySelections(documentId),
        client.listVocabularyDisplayPreferences(documentId),
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
      setDisplayPreferences(new Map(loadedDisplayPreferences.map((preference) => [
        encodeVocabularyKey(preference.key), preference.visibility,
      ])));
      setSnapshot({ document, analysis });
      setAreSelectionsHydrated(true);
      setAreDisplayPreferencesHydrated(true);
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

  const updateReaderPreferences = useCallback((nextPreferences: ReaderPreferences) => {
    saveReaderPreferences(nextPreferences);
    setReaderPreferences(nextPreferences);
  }, []);

  const setFuriganaVisibility = useCallback(async (
    key: string,
    visibility: FuriganaVisibility,
  ) => {
    if (!areDisplayPreferencesHydrated) return;
    const decoded = decodeVocabularyKey(key);
    if (decoded === null) return;
    try {
      await client.setVocabularyDisplayPreference(documentId, {
        key: decoded,
        visibility,
      });
      setDisplayPreferences((current) => {
        const next = new Map(current);
        next.set(key, visibility);
        return next;
      });
    } catch {
      setPersistenceError('Não foi possível salvar a preferência de furigana.');
    }
  }, [areDisplayPreferencesHydrated, client, documentId]);

  const refreshReadingOccurrence = useCallback(async (
    key: ReadingOverrideKey,
    mutation: () => Promise<unknown>,
  ) => {
    setPersistenceError('');
    try {
      if (snapshot === null || snapshot.analysis.documentRevision !== key.documentRevision) {
        throw new Error('Reading override is no longer on the displayed revision');
      }
      await mutation();
      const refreshed = await client.analyze(documentId);
      const analysis = replaceAnalysisOccurrence(snapshot.analysis, refreshed, key);
      setSnapshot((current) => {
        if (current === null || current.analysis.documentRevision !== key.documentRevision) {
          return current;
        }
        return { ...current, analysis };
      });
    } catch (error) {
      setPersistenceError('Não foi possível salvar a correção de leitura.');
      throw error;
    }
  }, [client, documentId, snapshot]);

  const saveReadingOverride = useCallback(async (override: SetReadingOverride) => {
    const key: ReadingOverrideKey = {
      documentRevision: override.documentRevision,
      startOffset: override.startOffset,
      endOffset: override.endOffset,
    };
    await refreshReadingOccurrence(
      key,
      () => client.setReadingOverride(documentId, override),
    );
  }, [client, documentId, refreshReadingOccurrence]);

  const removeReadingOverride = useCallback(async (key: ReadingOverrideKey) => {
    await refreshReadingOccurrence(
      key,
      () => client.deleteReadingOverride(documentId, key),
    );
  }, [client, documentId, refreshReadingOccurrence]);

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
        <ReaderMenu
          preferences={readerPreferences}
          onPreferencesChange={updateReaderPreferences}
        />
      </header>
      <DocumentText
        content={snapshot.document.content}
        analysis={snapshot.analysis}
        selectedKeys={selectedKeys}
        onToggleVocabulary={areSelectionsHydrated ? toggleVocabulary : undefined}
        showFurigana={readerPreferences.showFurigana}
        fontSizePx={readerPreferences.fontSizePx}
        furiganaVisibilityByKey={displayPreferences}
        onSetFuriganaVisibility={
          areDisplayPreferencesHydrated ? setFuriganaVisibility : undefined
        }
        onSaveReadingOverride={saveReadingOverride}
        onRemoveReadingOverride={removeReadingOverride}
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
