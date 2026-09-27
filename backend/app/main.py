from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.analysis.furigana import FuriganaAligner
from backend.app.analysis.morphology import SudachiMorphologicalAnalyzer
from backend.app.analysis.service import AnalysisService
from backend.app.api.errors import install_error_handlers
from backend.app.api.router import router
from backend.app.documents.service import DocumentService
from backend.app.persistence.memory.analyses import InMemoryAnalysisRepository
from backend.app.persistence.memory.documents import InMemoryDocumentRepository


@asynccontextmanager
async def lifespan(application: FastAPI):
    analyzer = SudachiMorphologicalAnalyzer()
    application.state.morphological_analyzer = analyzer
    try:
        application.state.analysis_service = AnalysisService(
            application.state.document_repository, InMemoryAnalysisRepository(),
            analyzer, FuriganaAligner(),
        )
        yield
    finally:
        analyzer.close()
        del application.state.morphological_analyzer
        del application.state.analysis_service


app = FastAPI(title="Japanese Reader", lifespan=lifespan)
app.state.document_repository = InMemoryDocumentRepository()
app.state.document_service = DocumentService(app.state.document_repository)
install_error_handlers(app)
app.include_router(router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
