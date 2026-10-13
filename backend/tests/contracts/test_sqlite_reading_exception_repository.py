import sqlite3

import pytest

from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import SqliteReadingExceptionRepository
from backend.app.reading_exceptions.models import ReadingException
from backend.tests.contracts.reading_exception_repository import (
    DELETED_AT,
    ReadingExceptionRepositoryContract,
)


@pytest.fixture
def repository(tmp_path):
    database = SqliteDatabase(tmp_path / "reading-exceptions.db")
    with database.unit_of_work(write=True) as connection:
        connection.executemany(
            "INSERT INTO reading_exceptions(lemma, reading, deleted_at) VALUES (?, ?, ?)",
            (("猫", "ねこ", None),),
        )
    return SqliteReadingExceptionRepository(database, clock=lambda: DELETED_AT)


class TestSqliteReadingExceptionRepository(ReadingExceptionRepositoryContract):
    pass

    def test_deleted_invalid_reading_is_filtered_in_sql(self, repository):
        with repository._database.unit_of_work(write=True) as connection:
            connection.execute(
                "INSERT INTO reading_exceptions(lemma, reading, deleted_at) VALUES (?, ?, ?)",
                ("無効", "", "2026-10-12T00:00:00Z"),
            )

        assert ReadingException("無効", "") not in repository.list_active()
