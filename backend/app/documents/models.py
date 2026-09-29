from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class DocumentTag:
    name: str
    color: str

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Document tag name cannot be empty")
        if not self.color.strip():
            raise ValueError("Document tag color cannot be empty")


@dataclass(frozen=True)
class Document:
    id: UUID
    title: str
    content: str
    revision: int
    created_at: datetime
    updated_at: datetime
    last_read_at: datetime | None = None
    description: str | None = None
    tags: tuple[DocumentTag, ...] = ()


@dataclass(frozen=True)
class CreateDocument:
    title: str
    content: str


@dataclass(frozen=True)
class UnsetValue:
    pass


UNSET = UnsetValue()


@dataclass(frozen=True)
class UpdateDocument:
    title: str | None = None
    content: str | None = None
    description: str | None | UnsetValue = UNSET
    tags: tuple[DocumentTag, ...] | UnsetValue = UNSET

    def __post_init__(self) -> None:
        if (
            self.title is None
            and self.content is None
            and self.description is UNSET
            and self.tags is UNSET
        ):
            raise ValueError("Document update requires at least one field")
        if self.tags is not UNSET:
            names = [tag.name.casefold() for tag in self.tags]
            if len(names) != len(set(names)):
                raise ValueError("Document tag names must be unique")
