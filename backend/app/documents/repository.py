from contextlib import AbstractContextManager
from typing import Protocol
from uuid import UUID

from backend.app.documents.models import CreateDocument, Document, UpdateDocument


class DocumentRepository(Protocol):
    """Storage port returning immutable snapshots and explicit missing results."""

    def create(self, data: CreateDocument) -> Document: ...

    def get(self, document_id: UUID) -> Document | None: ...

    def list(self) -> tuple[Document, ...]: ...

    def revision_guard(self, document_id: UUID) -> AbstractContextManager[None]: ...

    def update(self, document_id: UUID, data: UpdateDocument) -> Document | None: ...

    def delete(self, document_id: UUID) -> bool: ...
