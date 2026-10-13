from typing import Annotated, Self
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from backend.app.api.errors import PROBLEM_RESPONSES
from backend.app.reading_exceptions.models import ReadingException
from backend.app.reading_exceptions.service import ReadingExceptionService


class ReadingExceptionHttpModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


class ReadingExceptionRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SetReadingExceptionRequest(ReadingExceptionRequestModel):
    reading: str


class ReadingExceptionResponse(ReadingExceptionHttpModel):
    lemma: str
    reading: str
    deleted_at: datetime | None

    @classmethod
    def from_exception(cls, exception: ReadingException) -> Self:
        return cls(
            lemma=exception.lemma,
            reading=exception.reading,
            deleted_at=exception.deleted_at,
        )


def get_reading_exception_service(request: Request) -> ReadingExceptionService:
    return request.app.state.reading_exception_service


ReadingExceptionServiceDependency = Annotated[
    ReadingExceptionService, Depends(get_reading_exception_service)
]
router = APIRouter(
    prefix="/reading-exceptions",
    tags=["reading-exceptions"],
    responses=PROBLEM_RESPONSES,
)


@router.get(
    "",
    response_model=list[ReadingExceptionResponse],
    operation_id="listReadingExceptions",
)
def list_reading_exceptions(
    service: ReadingExceptionServiceDependency,
    include_deleted: bool = Query(default=False, alias="includeDeleted"),
) -> list[ReadingExceptionResponse]:
    return [
        ReadingExceptionResponse.from_exception(exception)
        for exception in service.list(include_deleted=include_deleted)
    ]


@router.put(
    "/{lemma}",
    response_model=ReadingExceptionResponse,
    operation_id="setReadingException",
)
def set_reading_exception(
    lemma: str,
    data: SetReadingExceptionRequest,
    response: Response,
    service: ReadingExceptionServiceDependency,
) -> ReadingExceptionResponse:
    exception, created = service.put(lemma, data.reading)
    if created:
        response.status_code = 201
    return ReadingExceptionResponse.from_exception(exception)


@router.delete(
    "/{lemma}",
    response_model=ReadingExceptionResponse,
    operation_id="deleteReadingException",
)
def delete_reading_exception(
    lemma: str, service: ReadingExceptionServiceDependency
) -> ReadingExceptionResponse:
    return ReadingExceptionResponse.from_exception(service.soft_delete(lemma))


@router.put(
    "/{lemma}/restore",
    response_model=ReadingExceptionResponse,
    operation_id="restoreReadingException",
)
def restore_reading_exception(
    lemma: str, service: ReadingExceptionServiceDependency
) -> ReadingExceptionResponse:
    return ReadingExceptionResponse.from_exception(service.restore(lemma))
