from collections.abc import Iterable

from backend.app.reading_exceptions.models import ReadingException


class InMemoryReadingExceptionRepository:
    def __init__(self, exceptions: Iterable[ReadingException] = ()) -> None:
        self._exceptions = tuple(exceptions)

    def list_active(self) -> tuple[ReadingException, ...]:
        return tuple(sorted(self._exceptions, key=lambda exception: exception.lemma))

    def replace(self, exceptions: Iterable[ReadingException]) -> None:
        self._exceptions = tuple(exceptions)
