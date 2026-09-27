from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from backend.app.documents.service import DocumentNotFoundError


class ProblemDetails(BaseModel):
    type: str
    title: str
    status: int
    detail: str


class ProblemResponse(JSONResponse):
    media_type = "application/problem+json"


def problem_response(status: int, detail: str) -> ProblemResponse:
    problem = ProblemDetails(
        type="about:blank", title=HTTPStatus(status).phrase, status=status, detail=detail
    )
    return ProblemResponse(status_code=status, content=problem.model_dump())


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DocumentNotFoundError)
    async def document_not_found(request: Request, error: DocumentNotFoundError):
        return problem_response(404, str(error))

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError):
        return problem_response(422, str(error))

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        response = problem_response(error.status_code, str(error.detail))
        if error.headers:
            response.headers.update(error.headers)
        return response


PROBLEM_RESPONSES = {
    status: {
        "description": HTTPStatus(status).phrase,
        "content": {"application/problem+json": {"schema": ProblemDetails.model_json_schema()}},
    }
    for status in (404, 422)
}
