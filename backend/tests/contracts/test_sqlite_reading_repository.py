from itertools import count
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import (
    SqliteDocumentRepository,
    SqliteReadingOverrideRepository,
)
from backend.tests.contracts.reading_repository import ReadingOverrideRepositoryContract


@pytest.fixture
def repository(tmp_path):
    database = SqliteDatabase(tmp_path / "readings.db")
    identifiers = count(1)
    documents = SqliteDocumentRepository(
        database, uuid_factory=lambda: UUID(int=next(identifiers))
    )
    documents.create(CreateDocument("first", "猫"))
    documents.create(CreateDocument("second", "犬"))
    return SqliteReadingOverrideRepository(database)


class TestSqliteReadingOverrideRepository(ReadingOverrideRepositoryContract):
    pass
