from typing import Protocol

from backend.app.reading_exceptions.models import ReadingException


class ReadingExceptionRepository(Protocol):
    def list_active(self) -> tuple[ReadingException, ...]: ...
