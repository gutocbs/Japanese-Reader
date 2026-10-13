from dataclasses import replace
from dataclasses import FrozenInstanceError

import pytest

from backend.app.analysis.models import RawToken
from backend.app.reading_exceptions.models import ReadingException
from backend.app.reading_exceptions.service import (
    InvalidReadingExceptionError,
    ReadingExceptionNotFoundError,
    ReadingExceptionResolver,
    ReadingExceptionService,
)
from backend.app.persistence.memory.reading_exceptions import (
    InMemoryReadingExceptionRepository,
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


def test_snapshot_state_cannot_be_reassigned_or_mutated():
    snapshot = ReadingExceptionResolver(
        Repository([ReadingException("私", "わたし")])
    ).snapshot()

    with pytest.raises(FrozenInstanceError):
        snapshot.version = "changed"

    assert isinstance(snapshot._pairs, tuple)
    with pytest.raises(AttributeError):
        snapshot._pairs.append(("猫", "ねこ"))


def exception_service(*exceptions):
    return ReadingExceptionService(InMemoryReadingExceptionRepository(exceptions))


def test_service_put_normalizes_katakana_and_reports_lifecycle_state():
    service = exception_service()

    created, is_created = service.put("猫", "ネコ")
    updated, is_updated = service.put("猫", "ねこ")
    assert service.soft_delete("猫").deleted_at is not None
    reactivated, is_reactivated = service.put("猫", "ネコ")

    assert (created, is_created) == (ReadingException("猫", "ねこ"), True)
    assert (updated, is_updated) == (ReadingException("猫", "ねこ"), False)
    assert (reactivated, is_reactivated) == (ReadingException("猫", "ねこ"), False)
    assert service.list() == (ReadingException("猫", "ねこ"),)


@pytest.mark.parametrize("lemma", ["", "  "])
def test_service_rejects_empty_lemma_before_repository_calls(lemma):
    repository = InMemoryReadingExceptionRepository()
    service = ReadingExceptionService(repository)

    with pytest.raises(InvalidReadingExceptionError, match="lemma"):
        service.put(lemma, "ねこ")

    assert repository.list(include_deleted=True) == ()


@pytest.mark.parametrize("reading", ["", "romaji", "ねcat"])
def test_service_rejects_invalid_readings(reading):
    service = exception_service()

    with pytest.raises(InvalidReadingExceptionError, match="猫"):
        service.put("猫", reading)


def test_service_lists_deleted_exceptions_only_when_requested():
    service = exception_service(ReadingException("犬", "いぬ"), ReadingException("猫", "ねこ"))
    service.soft_delete("猫")

    assert service.list() == (ReadingException("犬", "いぬ"),)
    assert service.list(include_deleted=True)[1].lemma == "猫"
    assert service.list(include_deleted=True)[1].deleted_at is not None


@pytest.mark.parametrize("exception", [None, ReadingException("猫", "ねこ")])
def test_service_cannot_delete_missing_or_inactive_exception(exception):
    service = exception_service(*( () if exception is None else (exception,) ))
    if exception is not None:
        service.soft_delete("猫")

    with pytest.raises(ReadingExceptionNotFoundError, match="猫"):
        service.soft_delete("猫")


def test_service_cannot_restore_missing_exception():
    service = exception_service()

    with pytest.raises(ReadingExceptionNotFoundError, match="猫"):
        service.restore("猫")


@pytest.mark.parametrize("operation", ["soft_delete", "restore"])
def test_service_rejects_empty_lemma_for_lifecycle_operations(operation):
    service = exception_service()

    with pytest.raises(InvalidReadingExceptionError, match="lemma"):
        getattr(service, operation)("")
