from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime, timezone
from threading import Lock, RLock
from typing import Iterator
from uuid import UUID, uuid4

from backend.app.documents.models import UNSET, CreateDocument, Document, DocumentTag, UpdateDocument


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
        self._tags: dict[str, DocumentTag] = {}
        self._lock = Lock()
        self._revision_locks: dict[UUID, RLock] = {}

    def _now(self) -> datetime:
        timestamp = self._clock()
        if timestamp.utcoffset() is None:
            raise ValueError("Document clock must return a timezone-aware datetime")
        return timestamp.astimezone(timezone.utc)

    def create(self, data: CreateDocument) -> Document:
        with self._lock:
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
        with self._lock:
            return self._documents.get(document_id)

    def list(self) -> tuple[Document, ...]:
        with self._lock:
            return tuple(self._documents.values())

    def list_tags(self) -> tuple[DocumentTag, ...]:
        with self._lock:
            return tuple(self._tags.values())

    def create_tag(self, tag: DocumentTag) -> DocumentTag:
        with self._lock:
            key = tag.name.casefold()
            if key in self._tags:
                raise ValueError("Tag already exists")
            self._tags[key] = tag
            return tag

    def rename_tag(self, name: str, replacement: str) -> bool:
        with self._lock:
            old_key, new_key = name.casefold(), replacement.casefold()
            tag = self._tags.get(old_key)
            if tag is None or (new_key != old_key and new_key in self._tags): return False
            renamed = DocumentTag(replacement, tag.color)
            self._tags.pop(old_key); self._tags[new_key] = renamed
            self._documents = {identifier: replace(document, tags=tuple(renamed if item.name.casefold() == old_key else item for item in document.tags)) for identifier, document in self._documents.items()}
            return True

    def delete_tag(self, name: str) -> bool:
        with self._lock:
            key = name.casefold()
            if self._tags.pop(key, None) is None: return False
            self._documents = {identifier: replace(document, tags=tuple(item for item in document.tags if item.name.casefold() != key)) for identifier, document in self._documents.items()}
            return True

    @contextmanager
    def revision_guard(self, document_id: UUID) -> Iterator[None]:
        with self._lock:
            revision_lock = self._revision_locks.setdefault(document_id, RLock())
        with revision_lock:
            yield

    def update(self, document_id: UUID, data: UpdateDocument) -> Document | None:
        with self._lock:
            document = self._documents.get(document_id)
            if document is None:
                return None
            content = document.content if data.content is None else data.content
            if data.tags is UNSET:
                tags = document.tags
            else:
                tags = tuple(
                    self._tags.setdefault(tag.name.casefold(), tag) for tag in data.tags
                )
            updated = replace(
                document,
                title=document.title if data.title is None else data.title,
                content=content,
                description=(
                    document.description if data.description is UNSET else data.description
                ),
                tags=tags,
                revision=document.revision + (content != document.content),
                updated_at=self._now(),
            )
            self._documents[document_id] = updated
            return updated

    def mark_read(self, document_id: UUID, read_at: datetime) -> Document | None:
        with self._lock:
            document = self._documents.get(document_id)
            if document is None:
                return None
            marked = replace(document, last_read_at=read_at)
            self._documents[document_id] = marked
            return marked

    def delete(self, document_id: UUID) -> bool:
        with self._lock:
            return self._documents.pop(document_id, None) is not None
