"""Benchmark import and SQLite document-library persistence/reload workflows."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import platform
import sqlite3
from statistics import median
import sys
from tempfile import TemporaryDirectory
from time import perf_counter
from typing import Callable

from fastapi.testclient import TestClient


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from backend.app.documents.models import CreateDocument, DocumentTag  # noqa: E402
from backend.app.main import create_app  # noqa: E402
from backend.app.persistence.sqlite.connection import SqliteDatabase  # noqa: E402
from backend.app.persistence.sqlite.repositories import (  # noqa: E402
    SqliteDocumentRepository,
    _document,
    _document_tags,
)
from tests.performance.generate_documents import generate_document  # noqa: E402


DEFAULT_DOCUMENT_COUNT = 500
DEFAULT_RUNS = 5
TAGS = (
    DocumentTag("Grammar", "#7C3AED"),
    DocumentTag("News", "#0F766E"),
    DocumentTag("N1", "#B45309"),
)


@dataclass(frozen=True)
class Timing:
    median_ms: float
    samples_ms: list[float]


class TracedSqliteDatabase(SqliteDatabase):
    def __init__(self, path: str | Path) -> None:
        self.select_count = 0
        super().__init__(path)

    def _connect(self):
        connection = super()._connect()
        connection.set_trace_callback(self._trace)
        return connection

    def _trace(self, statement: str) -> None:
        if statement.lstrip().upper().startswith("SELECT"):
            self.select_count += 1


def measure(operation: Callable[[], object], runs: int) -> Timing:
    samples: list[float] = []
    for _ in range(runs):
        started = perf_counter()
        operation()
        samples.append(round((perf_counter() - started) * 1000, 3))
    return Timing(round(median(samples), 3), samples)


def benchmark_import(database_path: Path, runs: int) -> dict[str, object]:
    app = create_app(database_path)
    content = generate_document(10_000)
    samples: list[float] = []
    with TestClient(app) as client:
        for index in range(runs):
            started = perf_counter()
            response = client.post(
                "/api/imports",
                json={
                    "title": f"Imported {index}",
                    "text": content,
                    "description": "Measured import with exact Unicode text.",
                    "source": "Task 17 benchmark",
                    "tags": [asdict(tag) for tag in TAGS],
                },
            )
            samples.append(round((perf_counter() - started) * 1000, 3))
            response.raise_for_status()
            payload = response.json()
            if payload["content"] != content or payload["tags"] != [asdict(tag) for tag in TAGS]:
                raise AssertionError("import changed canonical text or tags")
    return asdict(Timing(round(median(samples), 3), samples))


def seed_library(path: Path, document_count: int) -> None:
    repository = SqliteDocumentRepository(SqliteDatabase(path))
    for index in range(document_count):
        repository.create(
            CreateDocument(
                title=f"Document {index:05d}",
                content=f"本文 {index}\r\n  preserved",
                description=f"Description {index}",
                source="Task 17 benchmark",
                tags=TAGS if index % 2 == 0 else (),
            )
        )


def legacy_n_plus_one_list(
    database: SqliteDatabase,
) -> tuple[object, ...]:
    """Reproduce the pre-Task-17 list implementation for same-run comparison."""

    with database.unit_of_work() as connection:
        rows = connection.execute("SELECT * FROM documents ORDER BY rowid").fetchall()
        return tuple(
            _document(row, _document_tags(connection, row["id"])) for row in rows
        )


def benchmark_reload(
    path: Path,
    document_count: int,
    runs: int,
    *,
    legacy: bool,
) -> dict[str, object]:
    database = TracedSqliteDatabase(path)
    repository = SqliteDocumentRepository(database)
    database.select_count = 0
    observed: tuple[object, ...] = ()

    def reload_documents() -> None:
        nonlocal observed
        observed = (
            legacy_n_plus_one_list(database) if legacy else repository.list()
        )
        if len(observed) != document_count:
            raise AssertionError("reload returned an unexpected document count")
        first, second = observed[:2]
        if first.content != "本文 0\r\n  preserved" or first.tags != TAGS:
            raise AssertionError("reload changed canonical text, metadata, or tags")
        if second.content != "本文 1\r\n  preserved" or second.tags != ():
            raise AssertionError("reload lost an untagged document or changed its text")

    timing = measure(reload_documents, runs)
    return {
        **asdict(timing),
        "documents": document_count,
        "taggedDocuments": (document_count + 1) // 2,
        "tagsPerTaggedDocument": len(TAGS),
        "selectsPerReload": database.select_count // runs,
    }


def benchmark(document_count: int, runs: int) -> dict[str, object]:
    if runs < 3:
        raise ValueError("runs must be at least 3")
    with TemporaryDirectory(prefix="japanese-reader-workflows-") as directory:
        root = Path(directory)
        import_result = benchmark_import(root / "imports.db", runs)
        library_path = root / "library.db"
        started = perf_counter()
        seed_library(library_path, document_count)
        persistence_ms = round((perf_counter() - started) * 1000, 3)
        legacy_reload = benchmark_reload(
            library_path, document_count, runs, legacy=True
        )
        joined_reload = benchmark_reload(
            library_path, document_count, runs, legacy=False
        )
        speedup_percent = round(
            (legacy_reload["median_ms"] - joined_reload["median_ms"])
            / legacy_reload["median_ms"]
            * 100,
            3,
        )
    return {
        "benchmark": "task17-sqlite-list-v1",
        "environment": {
            "platform": platform.platform(),
            "processor": platform.processor() or "unknown",
            "logicalCpuCount": os.cpu_count(),
            "python": platform.python_version(),
            "sqlite": sqlite3.sqlite_version,
            "measurement": (
                "same seeded SQLite file; legacy N+1 and current joined domain "
                "reconstruction; median wall time"
            ),
        },
        "runs": runs,
        "import10k": import_result,
        "sqlitePersistence": {
            "documents": document_count,
            "taggedDocuments": (document_count + 1) // 2,
            "tagsPerTaggedDocument": len(TAGS),
            "totalMs": persistence_ms,
            "meanPerDocumentMs": round(persistence_ms / document_count, 3),
        },
        "sqliteListComparison": {
            "legacyNPlusOne": legacy_reload,
            "joinedCurrent": joined_reload,
            "medianSpeedupPercent": speedup_percent,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--documents", type=int, default=DEFAULT_DOCUMENT_COUNT)
    parser.add_argument("--runs", type=int, default=DEFAULT_RUNS)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = benchmark(args.documents, args.runs)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8", newline="\n")
    print(rendered, end="")


if __name__ == "__main__":
    main()
