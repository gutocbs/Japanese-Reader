from typing import Self

from fastapi import APIRouter
from pydantic import field_validator, model_validator

from backend.app.api.errors import PROBLEM_RESPONSES
from backend.app.documents.api import (
    DocumentResponse,
    DocumentServiceDependency,
    DocumentTagModel,
    HttpModel,
)
from backend.app.documents.models import CreateDocument


class ImportDocumentRequest(HttpModel):
    title: str
    text: str
    description: str | None
    source: str
    tags: list[DocumentTagModel]

    @field_validator("title", "source")
    @classmethod
    def validate_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Import title and source cannot be empty")
        return value

    @model_validator(mode="after")
    def validate_unique_tags(self) -> Self:
        names = [tag.name.casefold() for tag in self.tags]
        if len(names) != len(set(names)):
            raise ValueError("Document tag names must be unique")
        return self


router = APIRouter(prefix="/imports", tags=["imports"], responses=PROBLEM_RESPONSES)


@router.post("", status_code=201, response_model=DocumentResponse, operation_id="importDocument")
def import_document(data: ImportDocumentRequest, service: DocumentServiceDependency):
    document = service.create(
        CreateDocument(
            title=data.title,
            content=data.text,
            description=data.description,
            source=data.source,
            tags=tuple(tag.to_tag() for tag in data.tags),
        )
    )
    return DocumentResponse.from_document(document)
