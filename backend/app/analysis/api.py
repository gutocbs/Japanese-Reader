from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from backend.app.analysis.service import AnalysisService
from backend.app.api.errors import PROBLEM_RESPONSES, ProblemDetails


class AnalysisResponseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class AnalyzerMetadataResponse(AnalysisResponseModel):
    analyzer_name: str
    analyzer_version: str
    dictionary_name: str
    dictionary_version: str
    split_mode: str


class AnalysisOptionsResponse(AnalysisResponseModel):
    split_mode: str


class FuriganaSegmentResponse(AnalysisResponseModel):
    text: str
    reading: str | None


class AnalyzedTokenResponse(AnalysisResponseModel):
    start_offset: int
    end_offset: int
    surface: str
    lemma: str
    reading: str | None
    dictionary_reading: str | None
    part_of_speech: list[str]
    is_out_of_vocabulary: bool
    is_lexical: bool
    vocabulary_key: str | None
    furigana_segments: list[FuriganaSegmentResponse]
    has_reading_override: bool = False


class AnalysisBlockResponse(AnalysisResponseModel):
    start_offset: int
    end_offset: int
    tokens: list[AnalyzedTokenResponse]


class AnalysisDiagnosticResponse(AnalysisResponseModel):
    code: Literal["missing_reading", "furigana_fallback"]
    start_offset: int
    end_offset: int


class DocumentAnalysisResponse(AnalysisResponseModel):
    document_id: UUID
    document_revision: int
    content_hash: str
    metadata: AnalyzerMetadataResponse
    analysis_options: AnalysisOptionsResponse
    blocks: list[AnalysisBlockResponse]
    diagnostics: list[AnalysisDiagnosticResponse]


def get_analysis_service(request: Request) -> AnalysisService:
    return request.app.state.analysis_service


AnalysisServiceDependency = Annotated[AnalysisService, Depends(get_analysis_service)]
router = APIRouter(prefix="/documents", tags=["analysis"], responses={
    **PROBLEM_RESPONSES,
    409: {
        "description": "Conflict",
        "content": {"application/problem+json": {"schema": ProblemDetails.model_json_schema()}},
    },
})


@router.post("/{document_id}/analysis", response_model=DocumentAnalysisResponse, operation_id="analyzeDocument")
def analyze_document(document_id: UUID, service: AnalysisServiceDependency):
    return DocumentAnalysisResponse.model_validate(service.analyze(document_id))
