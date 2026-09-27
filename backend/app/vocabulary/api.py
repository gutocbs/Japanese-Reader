from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict

from backend.app.api.errors import PROBLEM_RESPONSES
from backend.app.vocabulary.models import VocabularyKey
from backend.app.vocabulary.service import VocabularySelectionService


class VocabularyHttpModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VocabularyKeyModel(VocabularyHttpModel):
    lemma: str
    reading: str | None

    @classmethod
    def from_key(cls, key: VocabularyKey) -> "VocabularyKeyModel":
        return cls(lemma=key.lemma, reading=key.reading)

    def to_key(self) -> VocabularyKey:
        return VocabularyKey(self.lemma, self.reading)


class VocabularySelectionsModel(VocabularyHttpModel):
    selections: list[VocabularyKeyModel]


def get_vocabulary_service(request: Request) -> VocabularySelectionService:
    return request.app.state.vocabulary_service


VocabularyServiceDependency = Annotated[
    VocabularySelectionService, Depends(get_vocabulary_service)
]
router = APIRouter(
    prefix="/documents",
    tags=["vocabulary"],
    responses=PROBLEM_RESPONSES,
)


@router.get(
    "/{document_id}/vocabulary-selections",
    response_model=VocabularySelectionsModel,
    operation_id="listVocabularySelections",
)
def list_vocabulary_selections(
    document_id: UUID, service: VocabularyServiceDependency
) -> VocabularySelectionsModel:
    return VocabularySelectionsModel(
        selections=[
            VocabularyKeyModel.from_key(key)
            for key in service.list_selections(document_id)
        ]
    )


@router.put(
    "/{document_id}/vocabulary-selections",
    status_code=204,
    operation_id="replaceVocabularySelections",
)
def replace_vocabulary_selections(
    document_id: UUID,
    data: VocabularySelectionsModel,
    service: VocabularyServiceDependency,
) -> Response:
    service.replace_selections(document_id, (key.to_key() for key in data.selections))
    return Response(status_code=204)
