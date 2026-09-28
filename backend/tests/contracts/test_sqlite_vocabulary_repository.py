from itertools import count
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import (
    SqliteDocumentRepository,
    SqliteVocabularyRepository,
)
from backend.tests.contracts.vocabulary_repository import (
    VocabularyDisplayPreferenceRepositoryContract,
    VocabularySelectionRepositoryContract,
)


@pytest.fixture
def database(tmp_path):
    database = SqliteDatabase(tmp_path / "vocabulary.db")
    identifiers = count(1)
    documents = SqliteDocumentRepository(
        database, uuid_factory=lambda: UUID(int=next(identifiers))
    )
    documents.create(CreateDocument("first", "猫"))
    documents.create(CreateDocument("second", "犬"))
    return database


@pytest.fixture
def repository(database):
    return SqliteVocabularyRepository(database)


@pytest.fixture
def display_repository(database):
    return SqliteVocabularyRepository(database)


class TestSqliteVocabularySelectionRepository(VocabularySelectionRepositoryContract):
    pass


class TestSqliteVocabularyDisplayPreferenceRepository(
    VocabularyDisplayPreferenceRepositoryContract
):
    pass
