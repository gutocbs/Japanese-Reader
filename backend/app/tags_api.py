from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from backend.app.documents.api import DocumentServiceDependency, DocumentTagModel

router = APIRouter(prefix="/tags", tags=["tags"])

class RenameTagRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip(): raise ValueError("Tag name cannot be empty")
        return value.strip()

@router.get("", response_model=list[DocumentTagModel])
def list_tags(service: DocumentServiceDependency):
    return [DocumentTagModel.from_tag(tag) for tag in service.list_tags()]

@router.post("", status_code=201, response_model=DocumentTagModel)
def create_tag(tag: DocumentTagModel, service: DocumentServiceDependency):
    try: return DocumentTagModel.from_tag(service.create_tag(tag.to_tag()))
    except ValueError as error: raise HTTPException(409, str(error)) from error

@router.put("/{name}", status_code=204)
def rename_tag(name: str, data: RenameTagRequest, service: DocumentServiceDependency):
    try:
        if not service.rename_tag(name, data.name): raise HTTPException(404, "Tag not found")
    except ValueError as error: raise HTTPException(409, str(error)) from error

@router.delete("/{name}", status_code=204)
def delete_tag(name: str, service: DocumentServiceDependency):
    if not service.delete_tag(name): raise HTTPException(404, "Tag not found")
