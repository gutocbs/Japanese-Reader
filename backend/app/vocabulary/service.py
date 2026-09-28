from collections.abc import Iterable
from uuid import UUID

from backend.app.analysis.service import AnalysisService
from backend.app.documents.repository import DocumentRepository
from backend.app.documents.service import DocumentNotFoundError
from backend.app.vocabulary.models import (
    FuriganaVisibility,
    VocabularyDisplayPreference,
    VocabularyKey,
)
from backend.app.vocabulary.repository import (
    VocabularyDisplayPreferenceRepository,
    VocabularySelectionRepository,
)


class VocabularySelectionService:
    def __init__(
        self,
        documents: DocumentRepository,
        selections: VocabularySelectionRepository,
        analyses: AnalysisService,
        display_preferences: VocabularyDisplayPreferenceRepository,
    ) -> None:
        self._documents = documents
        self._selections = selections
        self._analyses = analyses
        self._display_preferences = display_preferences

    def list_selections(self, document_id: UUID) -> tuple[VocabularyKey, ...]:
        self._ensure_document_exists(document_id)
        selected = self._selections.list_selections(document_id)
        by_identity = {key.encode(): key for key in selected}
        ordered: list[VocabularyKey] = []

        for block in self._analyses.analyze(document_id).blocks:
            for token in block.tokens:
                key = by_identity.pop(token.vocabulary_key, None)
                if key is not None:
                    ordered.append(key)

        ordered.extend(sorted(by_identity.values(), key=VocabularyKey.encode))
        return tuple(ordered)

    def replace_selections(
        self, document_id: UUID, keys: Iterable[VocabularyKey]
    ) -> None:
        self._ensure_document_exists(document_id)
        self._selections.replace_selections(document_id, keys)

    def list_display_preferences(
        self, document_id: UUID
    ) -> tuple[VocabularyDisplayPreference, ...]:
        self._ensure_document_exists(document_id)
        return self._display_preferences.list_display_preferences(document_id)

    def set_display_preference(
        self,
        document_id: UUID,
        key: VocabularyKey,
        visibility: FuriganaVisibility,
    ) -> None:
        self._ensure_document_exists(document_id)
        self._display_preferences.set_display_preference(
            document_id, key, visibility
        )

    def _ensure_document_exists(self, document_id: UUID) -> None:
        if self._documents.get(document_id) is None:
            raise DocumentNotFoundError(document_id)
