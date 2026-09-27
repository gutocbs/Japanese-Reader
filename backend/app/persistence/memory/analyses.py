from threading import Lock
from uuid import UUID

from backend.app.analysis.models import AnalysisCacheKey, DocumentAnalysis


class InMemoryAnalysisRepository:
    def __init__(self) -> None:
        self._analyses: dict[AnalysisCacheKey, DocumentAnalysis] = {}
        self._lock = Lock()

    def find_compatible(self, key: AnalysisCacheKey) -> DocumentAnalysis | None:
        with self._lock:
            return self._analyses.get(key)

    def save(self, analysis: DocumentAnalysis) -> None:
        with self._lock:
            self._analyses[analysis.cache_key] = analysis

    def invalidate_document(self, document_id: UUID) -> None:
        with self._lock:
            self._analyses = {
                key: analysis for key, analysis in self._analyses.items()
                if key.document_id != document_id
            }
