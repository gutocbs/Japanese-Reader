from typing import Annotated, Self
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from backend.app.api.errors import PROBLEM_RESPONSES, ProblemDetails
from backend.app.readings.models import ReadingOverride, ReadingOverrideKey
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
    response_model=ReadingOverrideResponse,
    operation_id="setReadingOverride",
)
def set_reading_override(
    document_id: UUID,
    data: SetReadingOverrideRequest,
    service: ReadingOverrideServiceDependency,
) -> ReadingOverrideResponse:
    return ReadingOverrideResponse.from_override(
        service.set_override(data.to_key(document_id), data.reading)
    )


@router.delete(
    "/{document_id}/reading-overrides",
    status_code=204,
    operation_id="deleteReadingOverride",
)
def delete_reading_override(
    document_id: UUID,
    data: ReadingOverrideKeyRequest,
    service: ReadingOverrideServiceDependency,
) -> Response:
    service.delete_override(data.to_key(document_id))
    return Response(status_code=204)
