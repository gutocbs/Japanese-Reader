export const documentKeys = {
  all: ['documents'] as const,
  list: () => [...documentKeys.all, 'list'] as const,
  detail: (documentId: string) => [...documentKeys.all, 'detail', documentId] as const,
  analysis: (documentId: string, revision: number) => (
    [...documentKeys.detail(documentId), 'analysis', revision] as const
  ),
};
