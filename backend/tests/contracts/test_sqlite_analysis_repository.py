from itertools import count
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import (
    SqliteAnalysisRepository,
    SqliteDocumentRepository,
)
from backend.tests.contracts.analysis_repository import AnalysisRepositoryContract


@pytest.fixture
def analysis_repository(tmp_path):
    database = SqliteDatabase(tmp_path / "analyses.db")
    identifiers = count(1)
    documents = SqliteDocumentRepository(
        database, uuid_factory=lambda: UUID(int=next(identifiers))
    )
    documents.create(CreateDocument("first", "𠮷野"))
    documents.create(CreateDocument("second", "𠮷野"))
    return SqliteAnalysisRepository(database)


class TestSqliteAnalysisRepository(AnalysisRepositoryContract):
    pass
