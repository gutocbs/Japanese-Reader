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
from backend.app.persistence.memory.readings import InMemoryReadingOverrideRepository
from backend.app.persistence.memory.vocabulary import InMemoryVocabularySelectionRepository
from backend.app.vocabulary.service import VocabularySelectionService
from backend.app.readings.service import ReadingOverrideResolver, ReadingOverrideService


@asynccontextmanager
async def lifespan(application: FastAPI):
    analyzer = SudachiMorphologicalAnalyzer()
    application.state.morphological_analyzer = analyzer
    try:
        application.state.analysis_service = AnalysisService(
            application.state.document_repository,
            application.state.analysis_repository,
            analyzer,
            FuriganaAligner(),
            ReadingOverrideResolver(application.state.reading_override_repository),
        )
        application.state.reading_override_service = ReadingOverrideService(
            application.state.document_repository,
            application.state.reading_override_repository,
            application.state.analysis_service,
            application.state.analysis_repository,
        )
        application.state.vocabulary_service = VocabularySelectionService(
            application.state.document_repository,
            application.state.vocabulary_repository,
            application.state.analysis_service,
            application.state.vocabulary_repository,
        )
        yield
    finally:
        analyzer.close()
        del application.state.morphological_analyzer
        del application.state.analysis_service
        del application.state.reading_override_service
        del application.state.vocabulary_service


app = FastAPI(title="Japanese Reader", lifespan=lifespan)
app.state.document_repository = InMemoryDocumentRepository()
app.state.analysis_repository = InMemoryAnalysisRepository()
app.state.reading_override_repository = InMemoryReadingOverrideRepository()
app.state.document_service = DocumentService(
    app.state.document_repository,
    app.state.analysis_repository,
    app.state.reading_override_repository,
)
app.state.vocabulary_repository = InMemoryVocabularySelectionRepository()
install_error_handlers(app)
app.include_router(router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
