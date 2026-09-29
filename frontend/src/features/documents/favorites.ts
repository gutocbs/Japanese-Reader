const STORAGE_KEY = 'japanese-reader:document-favorites';
const STORAGE_VERSION = 1;

function isFavoritePayload(value: unknown): value is { version: number; documentIds: string[] } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === STORAGE_VERSION
    && Array.isArray(record.documentIds)
    && record.documentIds.every((documentId) => typeof documentId === 'string');
}

export function loadFavoriteDocumentIds(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return new Set();

    const value: unknown = JSON.parse(stored);
    return isFavoritePayload(value) ? new Set(value.documentIds) : new Set();
  } catch {
    return new Set();
  }
}

export function saveFavoriteDocumentIds(documentIds: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      documentIds: [...documentIds],
    }));
  } catch {
    // Favorites remain available for the current visit when browser storage is unavailable.
  }
}

export function toggleFavoriteDocumentId(documentIds: ReadonlySet<string>, documentId: string): Set<string> {
  const nextDocumentIds = new Set(documentIds);
  if (nextDocumentIds.has(documentId)) {
    nextDocumentIds.delete(documentId);
  } else {
    nextDocumentIds.add(documentId);
  }
  return nextDocumentIds;
}
