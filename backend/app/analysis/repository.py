from typing import Protocol
from uuid import UUID

from backend.app.analysis.models import AnalysisCacheKey, DocumentAnalysis


class AnalysisRepository(Protocol):
    """Disposable derived snapshots; identity includes revision and analyzer configuration."""

    def find_compatible(self, key: AnalysisCacheKey) -> DocumentAnalysis | None: ...

    def save(self, analysis: DocumentAnalysis) -> None: ...

    def invalidate_document(self, document_id: UUID) -> None: ...
