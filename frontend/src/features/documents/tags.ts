import type { DocumentTag } from '../../shared/api/client';

const STORAGE_KEY = 'japanese-reader:document-tags';
const PALETTE = ['#0F766E', '#1D4ED8', '#7C3AED', '#B45309', '#BE123C'] as const;

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function persist(tags: DocumentTag[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tags }));
}

export function tagColorForName(name: string) {
  let hash = 0;
  for (const character of name.trim().toLocaleLowerCase()) {
    hash = ((hash * 31) + character.codePointAt(0)!) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function loadCatalogTags(): DocumentTag[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null || !('tags' in parsed) || !Array.isArray(parsed.tags)) return [];
    return parsed.tags.filter((tag): tag is DocumentTag => (
      typeof tag === 'object' && tag !== null
      && 'name' in tag && typeof tag.name === 'string' && tag.name.trim().length > 0
      && 'color' in tag && typeof tag.color === 'string' && tag.color.trim().length > 0
    ));
  } catch {
    return [];
  }
}

export function mergeCatalogTags(catalog: DocumentTag[], documentTags: DocumentTag[]) {
  const merged = [...catalog];
  for (const tag of documentTags) {
    if (!merged.some((item) => normalizedName(item.name) === normalizedName(tag.name))) merged.push(tag);
  }
  persist(merged);
  return merged;
}

export function saveCatalogTags(tags: DocumentTag[]) {
  persist(tags);
}

export function addCatalogTag(catalog: DocumentTag[], name: string) {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) throw new Error('Tag name is required');
  if (catalog.some((tag) => normalizedName(tag.name) === normalizedName(trimmedName))) {
    throw new Error('Tag already exists');
  }
  const next = [...catalog, { name: trimmedName, color: tagColorForName(trimmedName) }];
  persist(next);
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
  persist(next);
  return next;
}

export function removeCatalogTag(catalog: DocumentTag[], name: string) {
  const next = catalog.filter((tag) => normalizedName(tag.name) !== normalizedName(name));
  persist(next);
  return next;
}

export function canonicalTag(catalog: DocumentTag[], name: string): DocumentTag {
  const trimmedName = name.trim();
  return catalog.find((tag) => normalizedName(tag.name) === normalizedName(trimmedName))
    ?? { name: trimmedName, color: '#7C3AED' };
}
