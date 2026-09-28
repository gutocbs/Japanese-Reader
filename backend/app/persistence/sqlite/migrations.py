from collections.abc import Iterator
from pathlib import Path
import sqlite3


MIGRATIONS_DIRECTORY = Path(__file__).with_name("migrations")


def apply_migrations(connection: sqlite3.Connection) -> None:
    migrations = sorted(MIGRATIONS_DIRECTORY.glob("[0-9][0-9][0-9]_*.sql"))

    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        applied = {
            row[0]
            for row in connection.execute("SELECT version FROM schema_migrations")
        }

        for migration in migrations:
            version = int(migration.name.split("_", 1)[0])
            if version in applied:
                continue

            script = migration.read_text(encoding="utf-8")
            for statement in _migration_statements(script):
                connection.execute(statement)
            connection.execute(
                "INSERT INTO schema_migrations(version, name) VALUES (?, ?)",
                (version, migration.name),
            )

        connection.commit()
    except BaseException:
        if connection.in_transaction:
            connection.rollback()
        raise


def _migration_statements(script: str) -> Iterator[str]:
    statement = ""
    for line in script.splitlines(keepends=True):
        statement += line
        if sqlite3.complete_statement(statement):
            if statement.strip():
                yield statement
            statement = ""

    if statement.strip():
        raise sqlite3.OperationalError("incomplete SQL statement in migration")
