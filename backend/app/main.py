from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI

from backend.app.analysis.furigana import FuriganaAligner
from backend.app.analysis.morphology import SudachiMorphologicalAnalyzer
from backend.app.analysis.service import AnalysisService
from backend.app.api.errors import install_error_handlers
from backend.app.api.router import router
from backend.app.documents.service import DocumentService
from backend.app.persistence.sqlite.connection import SqliteDatabase
from backend.app.persistence.sqlite.repositories import (
    SqliteAnalysisRepository,
    SqliteDocumentRepository,
    SqliteReadingOverrideRepository,
    SqliteVocabularyRepository,
)
from backend.app.readings.service import ReadingOverrideResolver, ReadingOverrideService
from backend.app.vocabulary.service import VocabularySelectionService


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
        application.state.database.close()


def create_app(database_path: str | Path | None = None) -> FastAPI:
    configured_path = database_path or os.environ.get(
        "DATABASE_PATH", "./data/japanese-reader.db"
    )
    database = SqliteDatabase(configured_path)
    documents = SqliteDocumentRepository(database)
    analyses = SqliteAnalysisRepository(database)
    reading_overrides = SqliteReadingOverrideRepository(database)
    vocabulary = SqliteVocabularyRepository(database)

    application = FastAPI(title="Japanese Reader", lifespan=lifespan)
    application.state.database = database
    application.state.document_repository = documents
    application.state.analysis_repository = analyses
    application.state.reading_override_repository = reading_overrides
    application.state.vocabulary_repository = vocabulary
    application.state.document_service = DocumentService(
        documents, analyses, reading_overrides
    )
    install_error_handlers(application)
    application.include_router(router)

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
