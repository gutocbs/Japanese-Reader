from itertools import count
import json
from uuid import UUID

import pytest

from backend.app.documents.models import CreateDocument
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import (
    SqliteAnalysisRepository,
    SqliteDocumentRepository,
)
from backend.tests.contracts.analysis_repository import (
    AnalysisRepositoryContract,
    analysis_for,
)


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


def test_payload_identity_mismatch_is_a_cache_miss(tmp_path):
    database = SqliteDatabase(tmp_path / "corrupted-analysis.db")
    identifiers = count(1)
    documents = SqliteDocumentRepository(
        database, uuid_factory=lambda: UUID(int=next(identifiers))
    )
    first = documents.create(CreateDocument("first", "𠮷野"))
    second = documents.create(CreateDocument("second", "𠮷野"))
    repository = SqliteAnalysisRepository(database)
    stored = analysis_for(first.id)
    repository.save(stored)

    with database.unit_of_work(write=True) as connection:
        row = connection.execute(
            "SELECT analysis_json FROM document_analyses WHERE document_id = ?",
            (str(first.id),),
        ).fetchone()
        payload = json.loads(row["analysis_json"])
        payload["documentId"] = str(second.id)
        connection.execute(
            "UPDATE document_analyses SET analysis_json = ? WHERE document_id = ?",
            (json.dumps(payload, ensure_ascii=False), str(first.id)),
        )

    assert repository.find_compatible(stored.cache_key) is None


def test_legacy_unversioned_furigana_cache_entry_is_a_cache_miss(tmp_path):
    database = SqliteDatabase(tmp_path / "legacy-furigana-analysis.db")
    documents = SqliteDocumentRepository(database, uuid_factory=lambda: UUID(int=1))
    document = documents.create(CreateDocument("legacy", "食べた"))
    repository = SqliteAnalysisRepository(database)
    stored = analysis_for(document.id)
    repository.save(stored)

    with database.unit_of_work(write=True) as connection:
        row = connection.execute(
            "SELECT analysis_json FROM document_analyses WHERE document_id = ?",
            (str(document.id),),
        ).fetchone()
        payload = json.loads(row["analysis_json"])
        payload["analysisOptions"] = {"splitMode": "B"}
        connection.execute(
            """
            UPDATE document_analyses
            SET analysis_options_json = ?, analysis_json = ?
            WHERE document_id = ?
            """,
            (
                json.dumps({"splitMode": "B"}, separators=(",", ":")),
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                str(document.id),
            ),
        )

    assert repository.find_compatible(stored.cache_key) is None
