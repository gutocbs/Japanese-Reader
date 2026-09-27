from collections.abc import Iterable
from typing import Protocol
from uuid import UUID

from backend.app.vocabulary.models import VocabularyKey


class VocabularySelectionRepository(Protocol):
    def list_selections(self, document_id: UUID) -> frozenset[VocabularyKey]: ...

    def replace_selections(
        self, document_id: UUID, keys: Iterable[VocabularyKey]
    ) -> None: ...
