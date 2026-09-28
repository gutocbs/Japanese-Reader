from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument, UpdateDocument
from backend.app.documents.service import DocumentNotFoundError, DocumentService
from backend.app.persistence.memory.documents import InMemoryDocumentRepository
from backend.app.analysis.models import (
    AnalysisOptions,
    AnalyzerMetadata,
    DocumentAnalysis,
)
from backend.app.persistence.memory.analyses import InMemoryAnalysisRepository
from backend.app.persistence.memory.readings import InMemoryReadingOverrideRepository
from backend.app.readings.models import ReadingOverride, ReadingOverrideKey


@pytest.fixture
def service():
    return DocumentService(InMemoryDocumentRepository())


def test_document_lifecycle_through_service(service):
    created = service.create(CreateDocument(title="日本語", content="𠮷野家\n日本語  text"))
    assert service.get(created.id).content == "𠮷野家\n日本語  text"
    assert service.list() == (created,)
    service.delete(created.id)
    assert service.list() == ()
    with pytest.raises(DocumentNotFoundError):
        service.get(created.id)


@pytest.mark.parametrize(
    "update, expected_title, expected_content, revision, content_changed",
    [
        (UpdateDocument(title="Second"), "Second", "日本語", 1, False),
        (UpdateDocument(content="日本語"), "First", "日本語", 1, False),
        (UpdateDocument(title="Second", content="日本語"), "Second", "日本語", 1, False),
        (UpdateDocument(content="別の内容"), "First", "別の内容", 2, True),
        (UpdateDocument(title="Second", content="別の内容"), "Second", "別の内容", 2, True),
        (UpdateDocument(content=""), "First", "", 2, True),
    ],
)
def test_update_reports_actual_content_change(
    service, update, expected_title, expected_content, revision, content_changed
):
    original = service.create(CreateDocument(title="First", content="日本語"))
    result = service.update(original.id, update)
    assert result.document.title == expected_title
    assert result.document.content == expected_content
    assert result.document.revision == revision
    assert result.content_changed is content_changed
    assert service.get(original.id) == result.document


@pytest.mark.parametrize("operation", ["get", "update", "delete"])
def test_missing_document_raises_domain_error(service, operation):
    document_id = UUID("00000000-0000-0000-0000-000000000099")
    with pytest.raises(DocumentNotFoundError) as error:
        if operation == "update":
            service.update(document_id, UpdateDocument(title="Missing"))
        else:
            getattr(service, operation)(document_id)
    assert error.value.document_id == document_id
    assert service.list() == ()


def test_content_edit_removes_cached_analysis_and_reading_overrides():
    documents = InMemoryDocumentRepository()
    analyses = InMemoryAnalysisRepository()
    overrides = InMemoryReadingOverrideRepository()
    service = DocumentService(documents, analyses, overrides)
    document = service.create(CreateDocument("First", "猫"))
    analysis = DocumentAnalysis(
        document_id=document.id,
        document_revision=document.revision,
        content_hash="old-content-hash",
        metadata=AnalyzerMetadata("test", "1", "dictionary", "1", "B"),
        analysis_options=AnalysisOptions("B"),
        blocks=(),
        diagnostics=(),
    )
    analyses.save(analysis)
    override_key = ReadingOverrideKey(document.id, document.revision, 0, 1)
    overrides.upsert(ReadingOverride(override_key, "びょう"))

    result = service.update(document.id, UpdateDocument(content="犬"))

    assert result.document.revision == 2
    assert analyses.find_compatible(analysis.cache_key) is None
    assert overrides.get(override_key) is None


def test_mark_read_uses_the_domain_clock_without_changing_canonical_content():
    created_at = datetime(2026, 9, 28, 12, tzinfo=timezone.utc)
    read_at = created_at + timedelta(minutes=5)
    repository = InMemoryDocumentRepository(clock=lambda: created_at)
    service = DocumentService(repository, clock=lambda: read_at)
    original = service.create(CreateDocument("First", "猫"))

    marked = service.mark_read(original.id)

    assert marked.last_read_at == read_at
    assert marked.content == original.content
    assert marked.revision == original.revision
    assert marked.updated_at == original.updated_at
    assert service.get(original.id) == marked


def test_mark_read_rejects_a_naive_domain_timestamp():
    repository = InMemoryDocumentRepository()
    service = DocumentService(repository, clock=lambda: datetime(2026, 9, 28, 12))
    original = service.create(CreateDocument("First", "猫"))

    with pytest.raises(ValueError, match="timezone-aware"):
        service.mark_read(original.id)

    assert service.get(original.id).last_read_at is None
