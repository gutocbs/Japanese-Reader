from dataclasses import dataclass
from uuid import UUID

from backend.app.documents.models import CreateDocument, Document, UpdateDocument
from backend.app.documents.repository import DocumentRepository
from backend.app.analysis.repository import AnalysisRepository
from backend.app.readings.repository import ReadingOverrideRepository


class DocumentNotFoundError(LookupError):
    def __init__(self, document_id: UUID) -> None:
        self.document_id = document_id
        super().__init__(f"Document {document_id} was not found")


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
    ) -> None:
        self._repository = repository
        self._analyses = analyses
        self._reading_overrides = reading_overrides

    def create(self, data: CreateDocument) -> Document:
        return self._repository.create(data)

    def get(self, document_id: UUID) -> Document:
        document = self._repository.get(document_id)
        if document is None:
            raise DocumentNotFoundError(document_id)
        return document

    def list(self) -> tuple[Document, ...]:
        return self._repository.list()

    def update(self, document_id: UUID, data: UpdateDocument) -> DocumentUpdateResult:
        with self._repository.revision_guard(document_id):
            original = self.get(document_id)
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
