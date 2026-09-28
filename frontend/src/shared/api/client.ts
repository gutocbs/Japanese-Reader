import type { components, operations } from './generated';

export type Document = components['schemas']['DocumentResponse'];
export type CreateDocument = components['schemas']['CreateDocumentRequest'];
export type UpdateDocument = components['schemas']['UpdateDocumentRequest'];
export type Analysis = components['schemas']['DocumentAnalysisResponse'];
export type AnalysisBlock = components['schemas']['AnalysisBlockResponse'];
export type AnalyzedToken = components['schemas']['AnalyzedTokenResponse'];
export type VocabularySelection = components['schemas']['VocabularyKeyModel'];
export type FuriganaVisibility = components['schemas']['FuriganaVisibility'];
export type VocabularyDisplayPreference = components['schemas']['VocabularyDisplayPreferenceModel'];
export type ReadingOverrideKey = components['schemas']['ReadingOverrideKeyRequest'];
export type SetReadingOverride = components['schemas']['SetReadingOverrideRequest'];
export type ReadingOverride = components['schemas']['ReadingOverrideResponse'];
export type ProblemDetails = operations['getDocument']['responses'][404]['content']['application/problem+json'];

function isProblemDetails(body: unknown): body is ProblemDetails {
  if (typeof body !== 'object' || body === null) return false;
  const value = body as Record<string, unknown>;
  return typeof value.type === 'string' && typeof value.title === 'string'
    && typeof value.status === 'number' && typeof value.detail === 'string';
}

export class ApiError extends Error {
  readonly problem: ProblemDetails | undefined;

  constructor(readonly status: number, readonly body: unknown) {
    const problem = isProblemDetails(body) ? body : undefined;
    super(problem?.detail ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.problem = problem;
  }
}

export const READING_OVERRIDES_CONFIRMATION_REQUIRED_TYPE =
  'urn:japanese-reader:reading-overrides-confirmation-required';

export function isReadingOverridesConfirmationRequired(error: unknown): boolean {
  return error instanceof ApiError
    && error.status === 409
    && error.problem?.type === READING_OVERRIDES_CONFIRMATION_REQUIRED_TYPE;
}

export function createDocumentClient(fetcher: typeof fetch = globalThis.fetch) {
  async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const response = await fetcher(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      let errorBody: unknown = text;
      try { errorBody = JSON.parse(text); } catch { /* Preserve plain text failures. */ }
      throw new ApiError(response.status, errorBody);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  const documentPath = (id: string) => `/api/documents/${encodeURIComponent(id)}`;
  const vocabularyPath = (id: string) => `${documentPath(id)}/vocabulary-selections`;
  const displayPreferencesPath = (id: string) => `${documentPath(id)}/vocabulary-display-preferences`;
  const readingOverridesPath = (id: string) => `${documentPath(id)}/reading-overrides`;
  return {
    list: () => request<Document[]>('/api/documents', 'GET'),
    create: (data: CreateDocument) => request<Document>('/api/documents', 'POST', data),
    get: (id: string) => request<Document>(documentPath(id), 'GET'),
    update: (id: string, data: UpdateDocument) => request<Document>(documentPath(id), 'PUT', data),
    delete: (id: string) => request<void>(documentPath(id), 'DELETE'),
    analyze: (id: string) => request<Analysis>(`${documentPath(id)}/analysis`, 'POST'),
    listVocabularySelections: async (id: string) => (
      await request<{ selections: VocabularySelection[] }>(vocabularyPath(id), 'GET')
    ).selections,
    replaceVocabularySelections: (id: string, selections: VocabularySelection[]) => (
      request<void>(vocabularyPath(id), 'PUT', { selections })
    ),
    listVocabularyDisplayPreferences: async (id: string) => (
      await request<{ preferences: VocabularyDisplayPreference[] }>(displayPreferencesPath(id), 'GET')
    ).preferences,
    setVocabularyDisplayPreference: (id: string, preference: VocabularyDisplayPreference) => (
      request<void>(displayPreferencesPath(id), 'PUT', preference)
    ),
    setReadingOverride: (id: string, override: SetReadingOverride) => (
      request<ReadingOverride>(readingOverridesPath(id), 'PUT', override)
    ),
    deleteReadingOverride: (id: string, key: ReadingOverrideKey) => (
      request<void>(readingOverridesPath(id), 'DELETE', key)
    ),
  };
}

export type DocumentClient = ReturnType<typeof createDocumentClient>;
export const documentClient = createDocumentClient();
