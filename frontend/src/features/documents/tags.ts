import type { DocumentTag } from '../../shared/api/client';

export const TAG_COLOR_OPTIONS = [
  { color: '#0F766E', label: 'Verde-azulado' },
  { color: '#1D4ED8', label: 'Azul' },
  { color: '#7C3AED', label: 'Violeta' },
  { color: '#B45309', label: 'Âmbar' },
  { color: '#BE123C', label: 'Carmim' },
] as const;

const PALETTE = TAG_COLOR_OPTIONS.map(({ color }) => color);

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
