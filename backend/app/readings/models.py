from dataclasses import dataclass
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


@dataclass(frozen=True)
class ResolvedReading:
    reading: str | None
    has_override: bool
