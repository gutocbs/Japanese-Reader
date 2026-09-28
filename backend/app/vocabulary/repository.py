from collections.abc import Iterable
from typing import Protocol
from uuid import UUID

from backend.app.vocabulary.models import (
    FuriganaVisibility,
    VocabularyDisplayPreference,
    VocabularyKey,
)


class VocabularySelectionRepository(Protocol):
    def list_selections(self, document_id: UUID) -> frozenset[VocabularyKey]: ...

    def replace_selections(
        self, document_id: UUID, keys: Iterable[VocabularyKey]
    ) -> None: ...


class VocabularyDisplayPreferenceRepository(Protocol):
    def list_display_preferences(
        self, document_id: UUID
    ) -> tuple[VocabularyDisplayPreference, ...]: ...

    def get_display_preference(
        self, document_id: UUID, key: VocabularyKey
    ) -> FuriganaVisibility: ...

    def set_display_preference(
        self,
        document_id: UUID,
        key: VocabularyKey,
        visibility: FuriganaVisibility,
    ) -> None: ...
