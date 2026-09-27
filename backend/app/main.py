from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.analysis.morphology import SudachiMorphologicalAnalyzer
from backend.app.api.errors import install_error_handlers
from backend.app.api.router import router
from backend.app.documents.service import DocumentService
from backend.app.persistence.memory.documents import InMemoryDocumentRepository


@asynccontextmanager
async def lifespan(application: FastAPI):
    analyzer = SudachiMorphologicalAnalyzer()
    application.state.morphological_analyzer = analyzer
    try:
        yield
    finally:
        analyzer.close()


app = FastAPI(title="Japanese Reader", lifespan=lifespan)
app.state.document_service = DocumentService(InMemoryDocumentRepository())
install_error_handlers(app)
app.include_router(router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
