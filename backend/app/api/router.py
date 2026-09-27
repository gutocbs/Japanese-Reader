from fastapi import APIRouter

from backend.app.analysis.api import router as analysis_router
from backend.app.documents.api import router as documents_router

router = APIRouter(prefix="/api")
router.include_router(documents_router)
router.include_router(analysis_router)
