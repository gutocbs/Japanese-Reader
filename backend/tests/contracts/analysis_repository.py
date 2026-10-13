from dataclasses import replace
from uuid import UUID

from backend.app.analysis.furigana import FuriganaSegment
from backend.app.analysis.models import (
    AnalysisBlock,
    AnalysisDiagnostic,
    AnalysisOptions,
    AnalyzedToken,
    AnalyzerMetadata,
    DocumentAnalysis,
)
from backend.app.analysis.repository import AnalysisRepository


FIRST_DOCUMENT = UUID("00000000-0000-0000-0000-000000000001")
SECOND_DOCUMENT = UUID("00000000-0000-0000-0000-000000000002")


def analysis_for(
    document_id: UUID = FIRST_DOCUMENT,
    *,
    analyzer_version: str = "1.0",
) -> DocumentAnalysis:
    return DocumentAnalysis(
        document_id=document_id,
        document_revision=1,
        content_hash="sha256:exact-content",
        metadata=AnalyzerMetadata(
            analyzer_name="contract-analyzer",
            analyzer_version=analyzer_version,
            dictionary_name="contract-dictionary",
            dictionary_version="2026.09",
            split_mode="B",
        ),
        analysis_options=AnalysisOptions(split_mode="B"),
        blocks=(
            AnalysisBlock(
                start_offset=0,
                end_offset=2,
                tokens=(
                    AnalyzedToken(
                        start_offset=0,
                        end_offset=2,
                        surface="𠮷野",
                        lemma="𠮷野",
                        reading="よしの",
                        dictionary_reading="よしの",
                        part_of_speech=("名詞", "固有名詞", "人名", "姓", "*", "*"),
                        is_out_of_vocabulary=False,
                        is_lexical=True,
                        vocabulary_key='["𠮷野","よしの"]',
                        furigana_segments=(FuriganaSegment("𠮷野", "よしの"),),
                        has_reading_override=True,
                    ),
                ),
            ),
        ),
        diagnostics=(AnalysisDiagnostic("furigana_fallback", 0, 2),),
    )


class AnalysisRepositoryContract:
    def test_round_trips_versioned_analysis_and_requires_the_complete_cache_key(
        self, analysis_repository: AnalysisRepository
    ):
        stored = analysis_for()
        analysis_repository.save(stored)

        assert analysis_repository.find_compatible(stored.cache_key) == stored
        assert analysis_repository.find_compatible(
            replace(
                stored.cache_key,
                metadata=replace(stored.metadata, analyzer_version="2.0"),
            )
        ) is None
        assert analysis_repository.find_compatible(
            replace(
                stored.cache_key,
                analysis_options=AnalysisOptions(split_mode="A"),
            )
        ) is None
        assert analysis_repository.find_compatible(
            replace(
                stored.cache_key,
                analysis_options=AnalysisOptions(
                    split_mode="B", reading_exceptions_version="v2"
                ),
            )
        ) is None

    def test_invalidation_removes_only_the_target_document(
        self, analysis_repository: AnalysisRepository
    ):
        first = analysis_for()
        second = analysis_for(SECOND_DOCUMENT)
        analysis_repository.save(first)
        analysis_repository.save(second)

        analysis_repository.invalidate_document(FIRST_DOCUMENT)

        assert analysis_repository.find_compatible(first.cache_key) is None
        assert analysis_repository.find_compatible(second.cache_key) == second
