from fastapi import APIRouter

from backend.app.documents.api import router as documents_router

router = APIRouter(prefix="/api")
router.include_router(documents_router)
