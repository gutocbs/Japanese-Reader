import hashlib
import json
from dataclasses import dataclass, replace

from backend.app.analysis.models import RawToken
from backend.app.reading_exceptions.models import ReadingException
from backend.app.reading_exceptions.repository import ReadingExceptionRepository
from backend.app.readings.normalization import (
    InvalidReadingError,
    normalize_kana_reading,
)


class InvalidReadingExceptionError(ValueError):
    def __init__(self, lemma: str) -> None:
        self.lemma = lemma
        super().__init__(f"Invalid reading exception for lemma {lemma}")


class ReadingExceptionNotFoundError(LookupError):
    def __init__(self, lemma: str) -> None:
        self.lemma = lemma
        super().__init__(f"Reading exception not found for lemma {lemma}")


class ReadingExceptionService:
    def __init__(self, repository: ReadingExceptionRepository) -> None:
        self._repository = repository

    def list(self, *, include_deleted: bool = False) -> tuple[ReadingException, ...]:
        return self._repository.list(include_deleted=include_deleted)

    def put(self, lemma: str, reading: str) -> tuple[ReadingException, bool]:
        self._validate_lemma(lemma)
        try:
            normalized_reading = normalize_kana_reading(reading)
        except InvalidReadingError as error:
            raise InvalidReadingExceptionError(lemma) from error
        return self._repository.put(lemma, normalized_reading)

    def soft_delete(self, lemma: str) -> ReadingException:
        self._validate_lemma(lemma)
        exception = self._repository.soft_delete(lemma)
        if exception is None:
            raise ReadingExceptionNotFoundError(lemma)
        return exception

    def restore(self, lemma: str) -> ReadingException:
        self._validate_lemma(lemma)
        exception = self._repository.restore(lemma)
        if exception is None:
            raise ReadingExceptionNotFoundError(lemma)
        return exception

    @staticmethod
    def _validate_lemma(lemma: str) -> None:
        if not lemma.strip():
            raise InvalidReadingExceptionError(lemma)


@dataclass(frozen=True)
class ReadingExceptionSnapshot:
    _pairs: tuple[tuple[str, str], ...]
    version: str

    def resolve(self, token: RawToken) -> RawToken:
        reading = next(
            (reading for lemma, reading in self._pairs if lemma == token.lemma),
            None,
        )
        if reading is None:
            return token
        return replace(token, reading=reading, dictionary_reading=reading)


class ReadingExceptionResolver:
    def __init__(self, repository: ReadingExceptionRepository) -> None:
        self._repository = repository

    def snapshot(self) -> ReadingExceptionSnapshot:
        pairs = []
        for exception in self._repository.list_active():
            try:
                reading = normalize_kana_reading(exception.reading)
            except InvalidReadingError as error:
                raise InvalidReadingExceptionError(exception.lemma) from error
            pairs.append((exception.lemma, reading))
        normalized = tuple(sorted(pairs))
        encoded = json.dumps(normalized, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        version = hashlib.sha256(encoded).hexdigest()
        return ReadingExceptionSnapshot(normalized, version)
