from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timezone
from uuid import UUID, uuid4

from backend.app.documents.models import CreateDocument, Document, UpdateDocument


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryDocumentRepository:
    def __init__(
        self,
        *,
        clock: Callable[[], datetime] = utc_now,
        uuid_factory: Callable[[], UUID] = uuid4,
    ) -> None:
        self._clock = clock
        self._uuid_factory = uuid_factory
        self._documents: dict[UUID, Document] = {}

    def _now(self) -> datetime:
        timestamp = self._clock()
        if timestamp.utcoffset() is None:
            raise ValueError("Document clock must return a timezone-aware datetime")
        return timestamp.astimezone(timezone.utc)

    def create(self, data: CreateDocument) -> Document:
        timestamp = self._now()
        document = Document(
            id=self._uuid_factory(),
            title=data.title,
            content=data.content,
            revision=1,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self._documents[document.id] = document
        return document

    def get(self, document_id: UUID) -> Document | None:
        return self._documents.get(document_id)

    def list(self) -> tuple[Document, ...]:
        return tuple(self._documents.values())

    def update(self, document_id: UUID, data: UpdateDocument) -> Document | None:
        document = self.get(document_id)
        if document is None:
            return None
        content = document.content if data.content is None else data.content
        updated = replace(
            document,
            title=document.title if data.title is None else data.title,
            content=content,
            revision=document.revision + (content != document.content),
            updated_at=self._now(),
        )
        self._documents[document_id] = updated
        return updated

    def delete(self, document_id: UUID) -> bool:
        return self._documents.pop(document_id, None) is not None
