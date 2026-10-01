from dataclasses import dataclass
from enum import Enum
from uuid import UUID


@dataclass(frozen=True)
class ReadingOverrideKey:
    document_id: UUID
    document_revision: int
    start_offset: int
    end_offset: int


@dataclass(frozen=True)
class ReadingOverride:
    key: ReadingOverrideKey
    reading: str


class ReadingOverrideScope(str, Enum):
    LOCAL = "local"
    VOCABULARY = "vocabulary"


@dataclass(frozen=True)
class ReadingOverrideOperation:
    affected_occurrence_count: int
    overrides: tuple[ReadingOverride, ...]


@dataclass(frozen=True)
class ResolvedReading:
    reading: str | None
    has_override: bool
