from typing import Protocol
from unicodedata import normalize
from uuid import UUID

from backend.app.analysis.models import DocumentAnalysis
from backend.app.analysis.repository import AnalysisRepository
from backend.app.documents.repository import DocumentRepository
from backend.app.documents.service import DocumentNotFoundError
from backend.app.readings.models import (
    ReadingOverride,
    ReadingOverrideKey,
    ResolvedReading,
)
from backend.app.readings.repository import ReadingOverrideRepository


class InvalidReadingError(ValueError):
    def __init__(self) -> None:
        super().__init__("Reading must contain kana only")


class InvalidReadingOverrideTargetError(ValueError):
    def __init__(self, key: ReadingOverrideKey) -> None:
        self.key = key
        super().__init__(
            f"Offsets {key.start_offset}:{key.end_offset} do not identify a token "
            f"in document {key.document_id} revision {key.document_revision}"
        )


class StaleReadingOverrideRevisionError(ValueError):
    def __init__(self, document_id: UUID, revision: int) -> None:
        self.document_id = document_id
        self.document_revision = revision
        super().__init__(
            f"Document {document_id} is no longer at revision {revision}"
        )


class AnalysisProvider(Protocol):
    def analyze(self, document_id: UUID) -> DocumentAnalysis: ...


def normalize_kana_reading(reading: str) -> str:
    stripped = normalize("NFKC", reading.strip())
    hiragana = normalize(
        "NFC",
        "".join(
            chr(ord(character) - 0x60)
            if "ァ" <= character <= "ヶ" or character in "ヽヾ"
            else character
            for character in normalize("NFD", stripped)
        ),
    )
    if not any("ぁ" <= character <= "ゖ" for character in hiragana) or any(
        not (
            "ぁ" <= character <= "ゖ"
            or character in "ゝゞー\u3099\u309a"
        )
        for character in hiragana
    ):
        raise InvalidReadingError()
    return hiragana


class ReadingOverrideResolver:
    def __init__(self, repository: ReadingOverrideRepository) -> None:
        self._repository = repository

    def resolve(
        self, key: ReadingOverrideKey, analyzer_reading: str | None
    ) -> ResolvedReading:
        override = self._repository.get(key)
        if override is None:
            return ResolvedReading(analyzer_reading, False)
        return ResolvedReading(override.reading, True)


class ReadingOverrideService:
    def __init__(
        self,
        documents: DocumentRepository,
        overrides: ReadingOverrideRepository,
        analyses: AnalysisProvider,
        analysis_repository: AnalysisRepository,
    ) -> None:
        self._documents = documents
        self._overrides = overrides
        self._analyses = analyses
        self._analysis_repository = analysis_repository

    def set_override(self, key: ReadingOverrideKey, reading: str) -> ReadingOverride:
        with self._documents.revision_guard(key.document_id):
            self._validate_target(key)
            normalized = normalize_kana_reading(reading)
            override = ReadingOverride(key, normalized)
            self._overrides.upsert(override)
            self._analysis_repository.invalidate_document(key.document_id)
            return override

    def delete_override(self, key: ReadingOverrideKey) -> bool:
        with self._documents.revision_guard(key.document_id):
            self._validate_target(key)
            deleted = self._overrides.delete(key)
            if deleted:
                self._analysis_repository.invalidate_document(key.document_id)
            return deleted

    def _validate_target(self, key: ReadingOverrideKey) -> None:
        document = self._documents.get(key.document_id)
        if document is None:
            raise DocumentNotFoundError(key.document_id)
        if document.revision != key.document_revision:
            raise StaleReadingOverrideRevisionError(
                key.document_id, key.document_revision
            )
        analysis = self._analyses.analyze(key.document_id)
        matching = any(
            token.start_offset == key.start_offset
            and token.end_offset == key.end_offset
            for block in analysis.blocks
            for token in block.tokens
        )
        if not matching:
            raise InvalidReadingOverrideTargetError(key)
        current = self._documents.get(key.document_id)
        if current is None or current.revision != key.document_revision:
            raise StaleReadingOverrideRevisionError(
                key.document_id, key.document_revision
            )
