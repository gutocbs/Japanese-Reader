from datetime import datetime, timezone
from typing import Annotated, Self
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel
from pydantic.json_schema import SkipJsonSchema

from backend.app.api.errors import PROBLEM_RESPONSES, ProblemDetails
from backend.app.documents.models import UNSET, CreateDocument, Document, DocumentTag, UpdateDocument
from backend.app.documents.service import DocumentService


class HttpModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateDocumentRequest(HttpModel):
    title: str
    content: str


class DocumentTagModel(HttpModel):
    name: str
    color: str

    @field_validator("name", "color")
    @classmethod
    def validate_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Document tag fields cannot be empty")
        return value

    @field_validator("color")
    @classmethod
    def validate_palette(cls, value: str) -> str:
        if value not in {"#0F766E", "#1D4ED8", "#7C3AED", "#B45309", "#BE123C"}:
            raise ValueError("Document tag color must use the controlled palette")
        return value

    @classmethod
    def from_tag(cls, tag: DocumentTag) -> Self:
        return cls(name=tag.name, color=tag.color)

    def to_tag(self) -> DocumentTag:
        return DocumentTag(name=self.name, color=self.color)


class UpdateDocumentRequest(HttpModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "minProperties": 1,
            "not": {
                "maxProperties": 1,
                "required": ["confirmReadingOverrideRemoval"],
            },
        },
    )

    # None represents omission internally, never an accepted JSON value.
    title: str | SkipJsonSchema[None] = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )
    content: str | SkipJsonSchema[None] = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )
    description: str | None = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )
    tags: list[DocumentTagModel] | SkipJsonSchema[None] = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )
    confirmReadingOverrideRemoval: bool | SkipJsonSchema[None] = Field(  # noqa: N815
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )

    @model_validator(mode="after")
    def validate_update(self) -> Self:
        update_fields = self.model_fields_set & {"title", "content", "description", "tags"}
        if not update_fields:
            raise ValueError("Document update requires at least one field")
        required_fields = update_fields & {"title", "content", "tags"}
        if any(getattr(self, field) is None for field in required_fields):
            raise ValueError("Document update fields cannot be null")
        if (
            "confirmReadingOverrideRemoval" in self.model_fields_set
            and self.confirmReadingOverrideRemoval is None
        ):
            raise ValueError("Reading override confirmation cannot be null")
        if "tags" in update_fields and self.tags is not None:
            names = [tag.name.casefold() for tag in self.tags]
            if len(names) != len(set(names)):
                raise ValueError("Document tag names must be unique")
        return self


class DocumentResponse(HttpModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid")

    id: UUID
    title: str
    content: str
    description: str | None
    source: str = "Local"
    tags: list[DocumentTagModel]
    revision: int
    created_at: datetime
    updated_at: datetime
    last_read_at: datetime | None

    @classmethod
    def from_document(cls, document: Document) -> Self:
        return cls(
            id=document.id, title=document.title, content=document.content,
            description=document.description,
            source=document.source,
            tags=[DocumentTagModel.from_tag(tag) for tag in document.tags],
            revision=document.revision, createdAt=document.created_at,
            updatedAt=document.updated_at, lastReadAt=document.last_read_at,
        )


def get_document_service(request: Request) -> DocumentService:
    return request.app.state.document_service


DocumentServiceDependency = Annotated[DocumentService, Depends(get_document_service)]
router = APIRouter(prefix="/documents", tags=["documents"], responses=PROBLEM_RESPONSES)


@router.post("", status_code=201, response_model=DocumentResponse, operation_id="createDocument")
def create_document(data: CreateDocumentRequest, service: DocumentServiceDependency):
    return DocumentResponse.from_document(service.create(CreateDocument(data.title, data.content)))


@router.get("", response_model=list[DocumentResponse], operation_id="listDocuments")
def list_documents(service: DocumentServiceDependency):
    oldest = datetime.min.replace(tzinfo=timezone.utc)
    documents = sorted(
        service.list(), key=lambda document: document.last_read_at or oldest, reverse=True
    )
    return [DocumentResponse.from_document(document) for document in documents]


@router.get("/{document_id}", response_model=DocumentResponse, operation_id="getDocument")
def get_document(document_id: UUID, service: DocumentServiceDependency):
    return DocumentResponse.from_document(service.get(document_id))


@router.put(
    "/{document_id}",
    response_model=DocumentResponse,
    operation_id="updateDocument",
    responses={
        409: {
            "description": "Conflict",
            "content": {
                "application/problem+json": {
                    "schema": ProblemDetails.model_json_schema()
                }
            },
        }
    },
)
def update_document(document_id: UUID, data: UpdateDocumentRequest, service: DocumentServiceDependency):
    fields = data.model_fields_set
    result = service.update(
        document_id,
        UpdateDocument(
            title=data.title,
            content=data.content,
            description=data.description if "description" in fields else UNSET,
            tags=(
                tuple(tag.to_tag() for tag in data.tags)
                if "tags" in fields and data.tags is not None
                else UNSET
            ),
        ),
        confirm_reading_override_removal=data.confirmReadingOverrideRemoval is True,
    )
    return DocumentResponse.from_document(result.document)


@router.delete("/{document_id}", status_code=204, operation_id="deleteDocument")
def delete_document(document_id: UUID, service: DocumentServiceDependency) -> Response:
    service.delete(document_id)
    return Response(status_code=204)
