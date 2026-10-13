from collections.abc import Callable, Iterable
from datetime import datetime, timezone

from backend.app.reading_exceptions.models import ReadingException


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(timestamp: datetime) -> datetime:
    if timestamp.utcoffset() is None:
        raise ValueError("Reading exception clock must return a timezone-aware datetime")
    return timestamp.astimezone(timezone.utc)


class InMemoryReadingExceptionRepository:
    def __init__(
        self,
        exceptions: Iterable[ReadingException] = (),
        *,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._exceptions = {exception.lemma: exception for exception in exceptions}
        self._clock = clock

    def list(self, *, include_deleted: bool = False) -> tuple[ReadingException, ...]:
        return tuple(
            sorted(
                (
                    exception
                    for exception in self._exceptions.values()
                    if include_deleted or exception.deleted_at is None
                ),
                key=lambda exception: exception.lemma,
            )
        )

    def list_active(self) -> tuple[ReadingException, ...]:
        return self.list()

    def put(self, lemma: str, reading: str) -> tuple[ReadingException, bool]:
        created = lemma not in self._exceptions
        exception = ReadingException(lemma, reading)
        self._exceptions[lemma] = exception
        return exception, created

    def soft_delete(self, lemma: str) -> ReadingException | None:
        exception = self._exceptions.get(lemma)
        if exception is None or exception.deleted_at is not None:
            return None
        deleted = ReadingException(lemma, exception.reading, _utc(self._clock()))
        self._exceptions[lemma] = deleted
        return deleted

    def restore(self, lemma: str) -> ReadingException | None:
        exception = self._exceptions.get(lemma)
        if exception is None:
            return None
        if exception.deleted_at is None:
            return exception
        restored = ReadingException(lemma, exception.reading)
        self._exceptions[lemma] = restored
        return restored

    def replace(self, exceptions: Iterable[ReadingException]) -> None:
        self._exceptions = {exception.lemma: exception for exception in exceptions}
