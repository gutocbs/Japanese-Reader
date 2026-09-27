from datetime import datetime, timezone
from typing import Annotated, Self
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from pydantic.json_schema import SkipJsonSchema

from backend.app.api.errors import PROBLEM_RESPONSES
from backend.app.documents.models import CreateDocument, Document, UpdateDocument
from backend.app.documents.service import DocumentService


class HttpModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateDocumentRequest(HttpModel):
    title: str
    content: str


class UpdateDocumentRequest(HttpModel):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"minProperties": 1})

    # None represents omission internally, never an accepted JSON value.
    title: str | SkipJsonSchema[None] = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )
    content: str | SkipJsonSchema[None] = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )

    @model_validator(mode="after")
    def validate_update(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Document update requires at least one field")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Document update fields cannot be null")
        return self


class DocumentResponse(HttpModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid")

    id: UUID
    title: str
    content: str
    revision: int
    created_at: datetime
    updated_at: datetime
    last_read_at: datetime | None

    @classmethod
    def from_document(cls, document: Document) -> Self:
        return cls(
            id=document.id, title=document.title, content=document.content,
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


@router.put("/{document_id}", response_model=DocumentResponse, operation_id="updateDocument")
def update_document(document_id: UUID, data: UpdateDocumentRequest, service: DocumentServiceDependency):
    result = service.update(document_id, UpdateDocument(title=data.title, content=data.content))
    return DocumentResponse.from_document(result.document)


@router.delete("/{document_id}", status_code=204, operation_id="deleteDocument")
def delete_document(document_id: UUID, service: DocumentServiceDependency) -> Response:
    service.delete(document_id)
    return Response(status_code=204)
