from dataclasses import replace

import pytest

from backend.app.analysis.models import RawToken
from backend.app.reading_exceptions.models import ReadingException
from backend.app.reading_exceptions.service import (
    InvalidReadingExceptionError,
    ReadingExceptionResolver,
)


class Repository:
    def __init__(self, exceptions):
        self.exceptions = tuple(exceptions)

    def list_active(self):
        return self.exceptions


def token(lemma="私"):
    return RawToken(
        "私", 2, 3, lemma, "わたし", "わたし",
        ("名詞", "普通名詞", "一般", "*", "*", "*"), False,
    )


def test_snapshot_normalizes_readings_and_has_deterministic_version():
    first = ReadingException("私", "ワタシ")
    second = ReadingException("猫", "ネコ")

    left = ReadingExceptionResolver(Repository([first, second])).snapshot()
    right = ReadingExceptionResolver(Repository([second, first])).snapshot()

    assert left.version == right.version
    assert left.resolve(token()).reading == "わたし"


def test_snapshot_rejects_empty_romaji_and_mixed_active_readings():
    with pytest.raises(InvalidReadingExceptionError, match="私"):
        ReadingExceptionResolver(
            Repository([ReadingException("私", "romaji")])
        ).snapshot()

    with pytest.raises(InvalidReadingExceptionError, match="猫"):
        ReadingExceptionResolver(
            Repository([ReadingException("私", "わたし"), ReadingException("猫", "")])
        ).snapshot()


def test_resolver_replaces_both_readings_and_preserves_token_identity_fields():
    snapshot = ReadingExceptionResolver(
        Repository([ReadingException("私", "ワタシ")])
    ).snapshot()

    resolved = snapshot.resolve(token())

    assert resolved == replace(token(), reading="わたし", dictionary_reading="わたし")
    assert (resolved.raw_surface, resolved.start_offset, resolved.end_offset) == ("私", 2, 3)


def test_resolver_matches_the_complete_lemma_only():
    snapshot = ReadingExceptionResolver(
        Repository([ReadingException("私", "わたし")])
    ).snapshot()

    assert snapshot.resolve(token("私流")) == token("私流")
