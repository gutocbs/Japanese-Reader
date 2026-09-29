import type { DocumentTag } from '../../shared/api/client';

const PALETTE = ['#0F766E', '#1D4ED8', '#7C3AED', '#B45309', '#BE123C'] as const;

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function tagColorForName(name: string) {
  let hash = 0;
  for (const character of name.trim().toLocaleLowerCase()) {
    hash = ((hash * 31) + character.codePointAt(0)!) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function addCatalogTag(catalog: DocumentTag[], name: string) {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) throw new Error('Tag name is required');
  if (catalog.some((tag) => normalizedName(tag.name) === normalizedName(trimmedName))) {
    throw new Error('Tag already exists');
  }
  const next = [...catalog, { name: trimmedName, color: tagColorForName(trimmedName) }];
  return next;
}

export function renameCatalogTag(catalog: DocumentTag[], name: string, nextName: string) {
  const trimmedName = nextName.trim();
  if (trimmedName.length === 0) throw new Error('Tag name is required');
  if (normalizedName(name) !== normalizedName(trimmedName)
    && catalog.some((tag) => normalizedName(tag.name) === normalizedName(trimmedName))) {
    throw new Error('Tag already exists');
  }
  const next = catalog.map((tag) => normalizedName(tag.name) === normalizedName(name)
    ? { ...tag, name: trimmedName }
    : tag);
  return next;
}

export function removeCatalogTag(catalog: DocumentTag[], name: string) {
  const next = catalog.filter((tag) => normalizedName(tag.name) !== normalizedName(name));
  return next;
}

export function canonicalTag(catalog: DocumentTag[], name: string): DocumentTag {
  const trimmedName = name.trim();
  return catalog.find((tag) => normalizedName(tag.name) === normalizedName(trimmedName))
    ?? { name: trimmedName, color: tagColorForName(trimmedName) };
}
