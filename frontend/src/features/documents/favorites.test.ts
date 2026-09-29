import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function favoritesModule() {
  return import('./favorites');
}

describe('local document favorites', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses an empty set when no local favorites have been saved', async () => {
    const { loadFavoriteDocumentIds } = await favoritesModule();

    expect(loadFavoriteDocumentIds()).toEqual(new Set());
  });

  it('round-trips document ids through a versioned localStorage payload', async () => {
    const { loadFavoriteDocumentIds, saveFavoriteDocumentIds } = await favoritesModule();

    saveFavoriteDocumentIds(new Set(['document-2', 'document-1']));

    expect(localStorage.getItem('japanese-reader:document-favorites')).toBe(JSON.stringify({
      version: 1,
      documentIds: ['document-2', 'document-1'],
    }));
    expect(loadFavoriteDocumentIds()).toEqual(new Set(['document-2', 'document-1']));
  });

  it('falls back to an empty set for invalid or unavailable storage', async () => {
    const { loadFavoriteDocumentIds, saveFavoriteDocumentIds } = await favoritesModule();
    localStorage.setItem('japanese-reader:document-favorites', JSON.stringify({
      version: 2,
      documentIds: ['document-1'],
    }));
    expect(loadFavoriteDocumentIds()).toEqual(new Set());

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(loadFavoriteDocumentIds()).toEqual(new Set());
    expect(() => saveFavoriteDocumentIds(new Set(['document-1']))).not.toThrow();
  });

  it('toggles only the requested document id', async () => {
    const { toggleFavoriteDocumentId } = await favoritesModule();

    const added = toggleFavoriteDocumentId(new Set(['document-1']), 'document-2');
    expect(added).toEqual(new Set(['document-1', 'document-2']));
    expect(toggleFavoriteDocumentId(added, 'document-1')).toEqual(new Set(['document-2']));
  });
});
