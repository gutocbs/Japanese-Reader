from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument, UpdateDocument
from backend.app.documents.service import DocumentNotFoundError, DocumentService
from backend.app.persistence.memory.documents import InMemoryDocumentRepository


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
