from typing import Annotated, Literal, Self
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel

from backend.app.api.errors import PROBLEM_RESPONSES, ProblemDetails
from backend.app.readings.models import (
    ReadingOverride,
    ReadingOverrideKey,
    ReadingOverrideOperation,
    ReadingOverrideScope,
)
from backend.app.readings.service import ReadingOverrideService


class ReadingOverrideHttpModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


class ReadingOverrideRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReadingOverrideKeyRequest(ReadingOverrideRequestModel):
    # Camel-case field names avoid a FastAPI/Pydantic warning triggered when
    # request-body model aliases are unpacked into dependency fields.
    documentRevision: int
    startOffset: int
    endOffset: int
    scope: Literal["local", "vocabulary"] = "local"
    vocabularyKey: str | None = None

    @model_validator(mode="after")
    def validate_scope(self) -> Self:
        if self.scope == "vocabulary" and self.vocabularyKey is None:
            raise ValueError("Vocabulary scope requires vocabularyKey")
        if self.scope == "local" and self.vocabularyKey is not None:
            raise ValueError("Local scope does not accept vocabularyKey")
        return self

    def to_key(self, document_id: UUID) -> ReadingOverrideKey:
        return ReadingOverrideKey(
            document_id, self.documentRevision, self.startOffset, self.endOffset
        )


class SetReadingOverrideRequest(ReadingOverrideKeyRequest):
    reading: str


class ReadingOverrideResponse(ReadingOverrideHttpModel):
    document_id: UUID
    document_revision: int
    start_offset: int
    end_offset: int
    reading: str

    @classmethod
    def from_override(cls, override: ReadingOverride) -> Self:
        return cls(
            document_id=override.key.document_id,
            document_revision=override.key.document_revision,
            start_offset=override.key.start_offset,
            end_offset=override.key.end_offset,
            reading=override.reading,
        )


class ReadingOverrideOperationResponse(ReadingOverrideHttpModel):
    affected_occurrence_count: int
    overrides: list[ReadingOverrideResponse]

    @classmethod
    def from_operation(cls, operation: ReadingOverrideOperation) -> Self:
        return cls(
            affected_occurrence_count=operation.affected_occurrence_count,
            overrides=[
                ReadingOverrideResponse.from_override(override)
                for override in operation.overrides
            ],
        )


def get_reading_override_service(request: Request) -> ReadingOverrideService:
    return request.app.state.reading_override_service


ReadingOverrideServiceDependency = Annotated[
    ReadingOverrideService, Depends(get_reading_override_service)
]
router = APIRouter(
    prefix="/documents",
    tags=["reading-overrides"],
    responses={
        **PROBLEM_RESPONSES,
        409: {
            "description": "Conflict",
            "content": {
                "application/problem+json": {
                    "schema": ProblemDetails.model_json_schema()
                }
            },
        },
    },
)


@router.put(
    "/{document_id}/reading-overrides",
    response_model=ReadingOverrideOperationResponse,
    operation_id="setReadingOverride",
)
def set_reading_override(
    document_id: UUID,
    data: SetReadingOverrideRequest,
    service: ReadingOverrideServiceDependency,
) -> ReadingOverrideOperationResponse:
    return ReadingOverrideOperationResponse.from_operation(
        service.set_override(
            data.to_key(document_id),
            data.reading,
            scope=ReadingOverrideScope(data.scope),
            vocabulary_key=data.vocabularyKey,
        )
    )


@router.delete(
    "/{document_id}/reading-overrides",
    response_model=ReadingOverrideOperationResponse,
    operation_id="deleteReadingOverride",
)
def delete_reading_override(
    document_id: UUID,
    data: ReadingOverrideKeyRequest,
    service: ReadingOverrideServiceDependency,
) -> ReadingOverrideOperationResponse:
    return ReadingOverrideOperationResponse.from_operation(
        service.delete_override(
            data.to_key(document_id),
            scope=ReadingOverrideScope(data.scope),
            vocabulary_key=data.vocabularyKey,
        )
    )
