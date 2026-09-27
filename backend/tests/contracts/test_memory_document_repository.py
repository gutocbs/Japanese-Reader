from datetime import datetime, timedelta, timezone
from itertools import count
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument, UpdateDocument
from backend.app.persistence.memory.documents import InMemoryDocumentRepository
from backend.tests.contracts.document_repository import (
    CREATED_AT,
    UPDATED_AT,
    DocumentRepositoryContract,
)


@pytest.fixture
def repository():
    identifiers = count(1)
    timestamps = iter([CREATED_AT, UPDATED_AT])
    return InMemoryDocumentRepository(
        clock=lambda: next(timestamps),
        uuid_factory=lambda: UUID(int=next(identifiers)),
    )


class TestInMemoryDocumentRepository(DocumentRepositoryContract):
    pass


def test_default_factories_produce_distinct_ids_and_utc_timestamps():
    repository = InMemoryDocumentRepository()
    first = repository.create(CreateDocument(title="First", content="一"))
    second = repository.create(CreateDocument(title="Second", content="二"))
    assert first.id != second.id
    assert first.created_at.tzinfo is timezone.utc
    assert first.updated_at == first.created_at


def test_clock_offset_is_normalized_to_utc():
    local_time = datetime(2026, 9, 27, tzinfo=timezone(timedelta(hours=-3)))
    repository = InMemoryDocumentRepository(clock=lambda: local_time)
    original = repository.create(CreateDocument(title="First", content="一"))
    updated = repository.update(original.id, UpdateDocument(title="Second"))
    assert original.created_at == CREATED_AT
    assert original.created_at.tzinfo is timezone.utc
    assert updated.updated_at.tzinfo is timezone.utc


def test_naive_clock_is_rejected_before_creating_document():
    repository = InMemoryDocumentRepository(clock=lambda: datetime(2026, 9, 27))
    with pytest.raises(ValueError, match="timezone-aware"):
        repository.create(CreateDocument(title="First", content="一"))
    assert repository.list() == ()
