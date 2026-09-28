import asyncio
from pathlib import Path
from uuid import UUID

from httpx import ASGITransport, AsyncClient

from backend.app.documents.models import CreateDocument, UpdateDocument
from backend.app.documents.service import DocumentService
from backend.app.main import create_app
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import (
    SqliteAnalysisRepository,
    SqliteDocumentRepository,
    SqliteReadingOverrideRepository,
    SqliteVocabularyRepository,
)
from backend.app.readings.models import ReadingOverride, ReadingOverrideKey
from backend.app.vocabulary.models import FuriganaVisibility, VocabularyKey
from backend.tests.contracts.analysis_repository import analysis_for


def repositories(path: Path):
    database = SqliteDatabase(path)
    return (
        database,
        SqliteDocumentRepository(database),
        SqliteAnalysisRepository(database),
        SqliteVocabularyRepository(database),
        SqliteReadingOverrideRepository(database),
    )


def test_reopening_the_same_file_preserves_canonical_and_study_data(tmp_path):
    path = tmp_path / "restart.db"
    database, documents, analyses, vocabulary, readings = repositories(path)
    document = documents.create(CreateDocument("原文", "𠮷野家\r\n日本語  😀"))
    key = VocabularyKey("日本語", "にほんご")
    override_key = ReadingOverrideKey(document.id, 1, 0, 1)
    stored_analysis = analysis_for(document.id)

    vocabulary.replace_selections(document.id, [key])
    vocabulary.set_display_preference(document.id, key, FuriganaVisibility.HIDE)
    readings.upsert(ReadingOverride(override_key, "よし"))
    analyses.save(stored_analysis)
    del database, documents, analyses, vocabulary, readings

    _, reopened_documents, reopened_analyses, reopened_vocabulary, reopened_readings = repositories(path)

    assert reopened_documents.get(document.id) == document
    assert reopened_vocabulary.list_selections(document.id) == frozenset({key})
    assert reopened_vocabulary.get_display_preference(document.id, key) is FuriganaVisibility.HIDE
    assert reopened_readings.get(override_key) == ReadingOverride(override_key, "よし")
    assert reopened_analyses.find_compatible(stored_analysis.cache_key) == stored_analysis


def test_failed_post_update_cache_write_rolls_back_and_returns_problem(tmp_path):
    path = tmp_path / "rollback.db"
    database, documents, analyses, _, readings = repositories(path)
    document = documents.create(CreateDocument("原文", "猫"))
    cached = analysis_for(document.id)
    analyses.save(cached)
    with database.unit_of_work(write=True) as connection:
        connection.execute(
            """
            CREATE TRIGGER reject_analysis_invalidation
            BEFORE DELETE ON document_analyses
            BEGIN
                SELECT RAISE(ABORT, 'forced cache failure');
            END
            """
        )

    application = create_app(path)
    application.state.document_service = DocumentService(documents, analyses, readings)

    async def request_update():
        async with AsyncClient(
            transport=ASGITransport(app=application, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            return await client.put(
                f"/api/documents/{document.id}", json={"content": "犬"}
            )

    response = asyncio.run(request_update())

    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["detail"] == "The local database operation failed; changes were not saved"
    assert documents.get(document.id) == document
    assert analyses.find_compatible(cached.cache_key) == cached


def test_database_configuration_uses_environment_and_versioned_migrations(tmp_path, monkeypatch):
    configured = tmp_path / "configured" / "reader.db"
    monkeypatch.setenv("DATABASE_PATH", str(configured))

    application = create_app()

    assert application.state.database.path == configured
    assert configured.is_file()
    with application.state.database.unit_of_work() as connection:
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
        assert [
            row[0]
            for row in connection.execute(
                "SELECT version FROM schema_migrations ORDER BY version"
            )
        ] == [1]
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
    assert {
        "documents",
        "document_analyses",
        "vocabulary_selections",
        "vocabulary_display_preferences",
        "reading_overrides",
        "schema_migrations",
    } <= tables
