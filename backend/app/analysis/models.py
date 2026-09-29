from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from backend.app.analysis.furigana import FuriganaSegment


FURIGANA_ALGORITHM_VERSION = 2


@dataclass(frozen=True)
class RawToken:
    """Morphology derived from an unchanged slice of the original Python string."""

    raw_surface: str
    start_offset: int
    end_offset: int
    lemma: str
    reading: str | None
    dictionary_reading: str | None
    part_of_speech: tuple[str, str, str, str, str, str]
    is_out_of_vocabulary: bool


@dataclass(frozen=True)
class AnalyzerMetadata:
    analyzer_name: str
    analyzer_version: str
    dictionary_name: str
    dictionary_version: str
    split_mode: str


@dataclass(frozen=True)
class AnalysisOptions:
    split_mode: str
    furigana_algorithm_version: int = FURIGANA_ALGORITHM_VERSION


@dataclass(frozen=True)
class AnalysisCacheKey:
    document_id: UUID
    document_revision: int
    content_hash: str
    metadata: AnalyzerMetadata
    analysis_options: AnalysisOptions


@dataclass(frozen=True)
class AnalyzedToken:
    start_offset: int
    end_offset: int
    surface: str
    lemma: str
    reading: str | None
    dictionary_reading: str | None
    part_of_speech: tuple[str, str, str, str, str, str]
    is_out_of_vocabulary: bool
    is_lexical: bool
    vocabulary_key: str | None
    furigana_segments: tuple[FuriganaSegment, ...]
    has_reading_override: bool = False


@dataclass(frozen=True)
class AnalysisBlock:
    """Half-open original-text range, including its unmodified line ending."""

    start_offset: int
    end_offset: int
    tokens: tuple[AnalyzedToken, ...]


@dataclass(frozen=True)
class AnalysisDiagnostic:
    code: Literal["missing_reading", "furigana_fallback"]
    start_offset: int
    end_offset: int


@dataclass(frozen=True)
class DocumentAnalysis:
    document_id: UUID
    document_revision: int
    content_hash: str
    metadata: AnalyzerMetadata
    analysis_options: AnalysisOptions
    blocks: tuple[AnalysisBlock, ...]
    diagnostics: tuple[AnalysisDiagnostic, ...]

    @property
    def cache_key(self) -> AnalysisCacheKey:
        return AnalysisCacheKey(
            self.document_id, self.document_revision, self.content_hash,
            self.metadata, self.analysis_options,
        )
