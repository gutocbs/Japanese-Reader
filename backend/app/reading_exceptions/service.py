import hashlib
import json
from dataclasses import replace

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


class ReadingExceptionSnapshot:
    def __init__(self, pairs: tuple[tuple[str, str], ...], version: str) -> None:
        self._pairs = dict(pairs)
        self.version = version

    def resolve(self, token: RawToken) -> RawToken:
        reading = self._pairs.get(token.lemma)
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
