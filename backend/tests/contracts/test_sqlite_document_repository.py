from datetime import datetime
from itertools import count
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import SqliteDocumentRepository
from backend.tests.contracts.document_repository import (
    CREATED_AT,
    UPDATED_AT,
    DocumentRepositoryContract,
)


@pytest.fixture
def repository(tmp_path):
    identifiers = count(1)
    timestamps = iter([CREATED_AT, UPDATED_AT])
    database = SqliteDatabase(tmp_path / "documents.db")
    return SqliteDocumentRepository(
        database,
        clock=lambda: next(timestamps),
        uuid_factory=lambda: UUID(int=next(identifiers)),
    )


class TestSqliteDocumentRepository(DocumentRepositoryContract):
    pass


def test_naive_clock_rolls_back_without_creating_a_document(tmp_path):
    repository = SqliteDocumentRepository(
        SqliteDatabase(tmp_path / "naive-clock.db"),
        clock=lambda: datetime(2026, 9, 28),
    )

    with pytest.raises(ValueError, match="timezone-aware"):
        repository.create(CreateDocument("title", "本文"))

    assert repository.list() == ()
