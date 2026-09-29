from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from backend.app.documents.models import CreateDocument, Document, DocumentTag, UpdateDocument
from backend.app.documents.repository import DocumentRepository
from backend.app.analysis.repository import AnalysisRepository
from backend.app.readings.repository import ReadingOverrideRepository


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentNotFoundError(LookupError):
    def __init__(self, document_id: UUID) -> None:
        self.document_id = document_id
        super().__init__(f"Document {document_id} was not found")


class ReadingOverridesConfirmationRequiredError(RuntimeError):
    def __init__(self, document_id: UUID) -> None:
        self.document_id = document_id
        super().__init__(
            "Editing this content will remove its manual reading corrections"
        )


@dataclass(frozen=True)
class DocumentUpdateResult:
    document: Document
    content_changed: bool


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        analyses: AnalysisRepository | None = None,
        reading_overrides: ReadingOverrideRepository | None = None,
        *,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._repository = repository
        self._analyses = analyses
        self._reading_overrides = reading_overrides
        self._clock = clock

    def create(self, data: CreateDocument) -> Document:
        return self._repository.create(data)

    def get(self, document_id: UUID) -> Document:
        document = self._repository.get(document_id)
        if document is None:
            raise DocumentNotFoundError(document_id)
        return document

    def list(self) -> tuple[Document, ...]:
        return self._repository.list()

    def list_tags(self) -> tuple[DocumentTag, ...]: return self._repository.list_tags()
    def create_tag(self, tag: DocumentTag) -> DocumentTag: return self._repository.create_tag(tag)
    def rename_tag(self, name: str, replacement: str) -> bool: return self._repository.rename_tag(name, replacement)
    def delete_tag(self, name: str) -> bool: return self._repository.delete_tag(name)

    def update(
        self,
        document_id: UUID,
        data: UpdateDocument,
        *,
        confirm_reading_override_removal: bool = False,
    ) -> DocumentUpdateResult:
        with self._repository.revision_guard(document_id):
            original = self.get(document_id)
            content_will_change = data.content is not None and data.content != original.content
            if (
                content_will_change
                and self._reading_overrides is not None
                and self._reading_overrides.has_document(document_id)
                and not confirm_reading_override_removal
            ):
                raise ReadingOverridesConfirmationRequiredError(document_id)
            updated = self._repository.update(document_id, data)
            if updated is None:
                raise DocumentNotFoundError(document_id)
            result = DocumentUpdateResult(
                document=updated,
                content_changed=updated.content != original.content,
            )
            if result.content_changed:
                if self._analyses is not None:
                    self._analyses.invalidate_document(document_id)
                if self._reading_overrides is not None:
                    self._reading_overrides.delete_document(document_id)
            return result

    def delete(self, document_id: UUID) -> None:
        if not self._repository.delete(document_id):
            raise DocumentNotFoundError(document_id)

    def mark_read(self, document_id: UUID) -> Document:
        timestamp = self._clock()
        if timestamp.utcoffset() is None:
            raise ValueError("Document clock must return a timezone-aware datetime")
        marked = self._repository.mark_read(document_id, timestamp.astimezone(timezone.utc))
        if marked is None:
            raise DocumentNotFoundError(document_id)
        return marked
