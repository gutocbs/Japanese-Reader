from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class Document:
    id: UUID
    title: str
    content: str
    revision: int
    created_at: datetime
    updated_at: datetime
    last_read_at: datetime | None = None


@dataclass(frozen=True)
class CreateDocument:
    title: str
    content: str


@dataclass(frozen=True)
class UpdateDocument:
    title: str | None = None
    content: str | None = None

    def __post_init__(self) -> None:
        if self.title is None and self.content is None:
            raise ValueError("Document update requires at least one field")
