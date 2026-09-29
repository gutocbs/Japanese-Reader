import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCatalogTag,
  loadCatalogTags,
  removeCatalogTag,
  renameCatalogTag,
  tagColorForName,
} from './tags';

describe('document tag catalog', () => {
  beforeEach(() => localStorage.clear());

  it('assigns one controlled palette color and rejects duplicate names', () => {
    const first = addCatalogTag([], 'Estudo');
    expect(first).toEqual([{ name: 'Estudo', color: tagColorForName('Estudo') }]);
    expect(() => addCatalogTag(first, 'estudo')).toThrow('already exists');
  });

  it('persists catalog entries across reloads', () => {
    const tags = addCatalogTag([], 'Literatura');
    expect(loadCatalogTags()).toEqual(tags);
  });

  it('renames and removes catalog entries without changing their controlled color', () => {
    const tags = [{ name: 'Leitura', color: tagColorForName('Leitura') }];
    expect(renameCatalogTag(tags, 'Leitura', 'Clássicos')).toEqual([
      { name: 'Clássicos', color: tagColorForName('Leitura') },
    ]);
    expect(removeCatalogTag(tags, 'Leitura')).toEqual([]);
  });
});
