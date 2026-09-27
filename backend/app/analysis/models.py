from dataclasses import dataclass


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
