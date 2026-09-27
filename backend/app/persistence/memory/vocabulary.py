from collections.abc import Iterable
from threading import Lock
from uuid import UUID

from backend.app.vocabulary.models import VocabularyKey


class InMemoryVocabularySelectionRepository:
    def __init__(self) -> None:
        self._selections: dict[UUID, frozenset[VocabularyKey]] = {}
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
