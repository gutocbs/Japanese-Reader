from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument, UpdateDocument
from backend.app.documents.repository import DocumentRepository

CONTENT = "𠮷野家\n日本語  text"
CREATED_AT = datetime(2026, 9, 27, 3, 0, tzinfo=timezone.utc)
UPDATED_AT = datetime(2026, 9, 27, 3, 1, tzinfo=timezone.utc)
LAST_READ_AT = datetime(2026, 9, 28, 12, 5, tzinfo=timezone.utc)


class DocumentRepositoryContract:
    """Adapters supply an isolated repository fixture for this shared contract."""

    def test_create_preserves_exact_content_and_initial_metadata(
        self, repository: DocumentRepository
    ):
        document = repository.create(CreateDocument(title="日本語", content=CONTENT))
        assert isinstance(document.id, UUID)
        assert document.title == "日本語"
        assert document.content == "𠮷野家\n日本語  text"
        assert document.revision == 1
        assert document.created_at == CREATED_AT
        assert document.updated_at == CREATED_AT
        assert document.created_at.tzinfo is timezone.utc
        assert document.updated_at.tzinfo is timezone.utc
        assert document.last_read_at is None

    def test_get_and_list_return_created_documents(self, repository):
        assert repository.list() == ()
        first = repository.create(CreateDocument(title="First", content=CONTENT))
        second = repository.create(CreateDocument(title="Second", content="二"))
        assert first.id != second.id
        assert repository.get(first.id) == first
        assert set(repository.list()) == {first, second}

    def test_content_update_advances_revision_and_preserves_creation(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        updated = repository.update(original.id, UpdateDocument(content="𠮷\r\nにほん  "))
        assert updated.id == original.id
        assert updated.title == "First"
        assert updated.content == "𠮷\r\nにほん  "
        assert updated.revision == 2
        assert updated.created_at == CREATED_AT
        assert updated.updated_at == UPDATED_AT
        assert repository.get(original.id) == updated
        assert original.content == CONTENT
        assert original.revision == 1

    def test_title_update_does_not_advance_content_revision(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        updated = repository.update(original.id, UpdateDocument(title="Second"))
        assert updated.title == "Second"
        assert updated.content == CONTENT
        assert updated.revision == 1
        assert updated.updated_at == UPDATED_AT

    def test_identical_content_does_not_advance_revision(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        updated = repository.update(original.id, UpdateDocument(content=CONTENT))
        assert updated.revision == 1
        assert updated.content == CONTENT

    def test_combined_update_advances_revision_once(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        updated = repository.update(
            original.id, UpdateDocument(title="Second", content="別の内容")
        )
        assert updated.title == "Second"
        assert updated.content == "別の内容"
        assert updated.revision == 2

    def test_empty_content_is_an_explicit_update(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        updated = repository.update(original.id, UpdateDocument(title="", content=""))
        assert updated.title == ""
        assert updated.content == ""
        assert updated.revision == 2

    def test_mark_read_changes_only_the_read_timestamp(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))

        marked = repository.mark_read(original.id, LAST_READ_AT)

        assert marked.last_read_at == LAST_READ_AT
        assert marked.title == original.title
        assert marked.content == original.content
        assert marked.revision == original.revision
        assert marked.created_at == original.created_at
        assert marked.updated_at == original.updated_at
        assert repository.get(original.id) == marked
        assert repository.mark_read(UUID(int=99), LAST_READ_AT) is None

    def test_delete_and_missing_operations_are_explicit(self, repository):
        missing_id = UUID("00000000-0000-0000-0000-000000000099")
        assert repository.get(missing_id) is None
        assert repository.update(missing_id, UpdateDocument(title="Missing")) is None
        assert repository.delete(missing_id) is False
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        assert repository.delete(original.id) is True
        assert repository.get(original.id) is None
        assert repository.list() == ()
        assert repository.delete(original.id) is False

    def test_documents_and_list_snapshots_cannot_mutate_repository(self, repository):
        original = repository.create(CreateDocument(title="First", content=CONTENT))
        documents = repository.list()
        with pytest.raises(FrozenInstanceError):
            original.content = "Changed outside repository"
        with pytest.raises(FrozenInstanceError):
            repository.get(original.id).title = "Changed outside repository"
        with pytest.raises(FrozenInstanceError):
            documents[0].revision = 100
        repository.delete(original.id)
        assert documents == (original,)
        assert repository.list() == ()

    def test_update_requires_at_least_one_field(self, repository):
        with pytest.raises(ValueError, match="at least one field"):
            UpdateDocument()
        with pytest.raises(ValueError, match="at least one field"):
            UpdateDocument(title=None, content=None)
