from collections.abc import Iterable
from threading import Lock
from uuid import UUID

from backend.app.vocabulary.models import (
    FuriganaVisibility,
    VocabularyDisplayPreference,
    VocabularyKey,
)


class InMemoryVocabularySelectionRepository:
    def __init__(self) -> None:
        self._selections: dict[UUID, frozenset[VocabularyKey]] = {}
        self._display_preferences: dict[
            UUID, dict[VocabularyKey, FuriganaVisibility]
        ] = {}
        self._lock = Lock()

    def list_selections(self, document_id: UUID) -> frozenset[VocabularyKey]:
        with self._lock:
            return self._selections.get(document_id, frozenset())

    def replace_selections(
        self, document_id: UUID, keys: Iterable[VocabularyKey]
    ) -> None:
        replacement = frozenset(keys)
        with self._lock:
            if replacement:
                self._selections[document_id] = replacement
            else:
                self._selections.pop(document_id, None)

    def list_display_preferences(
        self, document_id: UUID
    ) -> tuple[VocabularyDisplayPreference, ...]:
        with self._lock:
            preferences = self._display_preferences.get(document_id, {})
            return tuple(
                VocabularyDisplayPreference(key, preferences[key])
                for key in sorted(preferences, key=VocabularyKey.encode)
            )

    def get_display_preference(
        self, document_id: UUID, key: VocabularyKey
    ) -> FuriganaVisibility:
        with self._lock:
            return self._display_preferences.get(document_id, {}).get(
                key, FuriganaVisibility.INHERIT
            )

    def set_display_preference(
        self,
        document_id: UUID,
        key: VocabularyKey,
        visibility: FuriganaVisibility,
    ) -> None:
        with self._lock:
            self._display_preferences.setdefault(document_id, {})[key] = visibility
