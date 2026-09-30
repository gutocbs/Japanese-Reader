from datetime import datetime
from itertools import count
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument, DocumentTag
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


class TracedSqliteDatabase(SqliteDatabase):
    def __init__(self, path):
        self.select_count = 0
        super().__init__(path)

    def _connect(self):
        connection = super()._connect()
        connection.set_trace_callback(self._trace)
        return connection

    def _trace(self, statement):
        if statement.lstrip().upper().startswith("SELECT"):
            self.select_count += 1


def test_list_loads_document_tags_with_fixed_query_budget(tmp_path):
    database = TracedSqliteDatabase(tmp_path / "list-query-budget.db")
    repository = SqliteDocumentRepository(database)
    tags = (
        DocumentTag(name="Grammar", color="#7C3AED"),
        DocumentTag(name="News", color="#0F766E"),
    )
    expected = tuple(
        repository.create(
            CreateDocument(title=f"Document {index}", content=f"本文 {index}", tags=tags)
        )
        for index in range(4)
    )
    database.select_count = 0

    actual = repository.list()

    assert actual == expected
    assert database.select_count <= 2


def test_naive_clock_rolls_back_without_creating_a_document(tmp_path):
    repository = SqliteDocumentRepository(
        SqliteDatabase(tmp_path / "naive-clock.db"),
        clock=lambda: datetime(2026, 9, 28),
    )

    with pytest.raises(ValueError, match="timezone-aware"):
        repository.create(CreateDocument("title", "本文"))

    assert repository.list() == ()
