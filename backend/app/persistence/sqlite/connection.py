from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
import sqlite3
from threading import local
from uuid import uuid4

from backend.app.persistence.sqlite.migrations import apply_migrations


class SqliteDatabase:
    """Creates one SQLite connection per outer unit of work.

    Nested repository calls share the outer connection, which lets services keep
    document changes and derived-data invalidation in one transaction without
    leaking SQLite into the domain ports.
    """

    def __init__(self, path: str | Path) -> None:
        raw_path = str(path)
        self.path: str | Path = ":memory:" if raw_path == ":memory:" else Path(path)
        self._local = local()
        self._keeper: sqlite3.Connection | None = None

        if self.path == ":memory:":
            self._database = f"file:japanese-reader-{uuid4().hex}?mode=memory&cache=shared"
            self._uri = True
            self._keeper = self._connect()
            apply_migrations(self._keeper)
        else:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._database = str(self.path)
            self._uri = False
            connection = self._connect()
            try:
                apply_migrations(connection)
            finally:
                connection.close()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self._database,
            uri=self._uri,
            timeout=5,
            isolation_level=None,
            check_same_thread=False,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    @contextmanager
    def unit_of_work(self, *, write: bool = False) -> Iterator[sqlite3.Connection]:
        active = getattr(self._local, "connection", None)
        if active is not None:
            if write and not self._local.write:
                raise RuntimeError("Cannot start a write inside a read-only unit of work")
            yield active
            return

        connection = self._connect()
        self._local.connection = connection
        self._local.write = write
        try:
            connection.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            del self._local.connection
            del self._local.write
            connection.close()

    def close(self) -> None:
        if self._keeper is not None:
            self._keeper.close()
            self._keeper = None
