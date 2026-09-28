import pytest

from backend.app.analysis.furigana import FuriganaAligner, FuriganaSegment
from backend.app.analysis.models import AnalyzerMetadata, RawToken
from backend.app.analysis.service import AnalysisService
from backend.app.documents.models import CreateDocument
from backend.app.persistence.memory.analyses import InMemoryAnalysisRepository
from backend.app.persistence.memory.documents import InMemoryDocumentRepository
from backend.app.persistence.memory.readings import InMemoryReadingOverrideRepository
from backend.app.readings.models import ReadingOverrideKey
from backend.app.readings.service import (
    InvalidReadingError,
    InvalidReadingOverrideTargetError,
    ReadingOverrideResolver,
    ReadingOverrideService,
    StaleReadingOverrideRevisionError,
)


class RepeatedTokenAnalyzer:
    metadata = AnalyzerMetadata("test", "1", "dictionary", "1", "B")

    def analyze(self, text: str, base_offset: int = 0):
        assert text == "食べた食べた"
        part_of_speech = ("動詞", "一般", "*", "*", "下一段-バ行", "連用形-一般")
        return (
            RawToken(
                "食べた", base_offset, base_offset + 3, "食べる", "たべた",
                "たべる", part_of_speech, False,
            ),
            RawToken(
                "食べた", base_offset + 3, base_offset + 6, "食べる", "たべた",
                "たべる", part_of_speech, False,
            ),
        )


@pytest.fixture
def services():
    documents = InMemoryDocumentRepository()
    analyses = InMemoryAnalysisRepository()
    overrides = InMemoryReadingOverrideRepository()
    resolver = ReadingOverrideResolver(overrides)
    analysis = AnalysisService(
        documents, analyses, RepeatedTokenAnalyzer(), FuriganaAligner(), resolver
    )
    readings = ReadingOverrideService(documents, overrides, analysis, analyses)
    document = documents.create(CreateDocument("title", "食べた食べた"))
    return document, analysis, readings, overrides


def flattened_tokens(analysis):
    return [token for block in analysis.blocks for token in block.tokens]


def test_override_is_normalized_and_changes_only_the_target_occurrence(services):
    document, analysis, readings, _ = services
    key = ReadingOverrideKey(document.id, document.revision, 0, 3)

    saved = readings.set_override(key, " クッタ ")
    tokens = flattened_tokens(analysis.analyze(document.id))

    assert saved.reading == "くった"
    assert [(token.reading, token.has_reading_override) for token in tokens] == [
        ("くった", True),
        ("たべた", False),
    ]
    assert tokens[0].furigana_segments == (FuriganaSegment("食べた", "くった"),)
    assert "".join(segment.text for segment in tokens[0].furigana_segments) == "食べた"


def test_delete_restores_the_analyzer_reading(services):
    document, analysis, readings, _ = services
    key = ReadingOverrideKey(document.id, document.revision, 0, 3)
    readings.set_override(key, "くった")
    assert flattened_tokens(analysis.analyze(document.id))[0].reading == "くった"

    assert readings.delete_override(key)

    restored = flattened_tokens(analysis.analyze(document.id))[0]
    assert restored.reading == "たべた"
    assert not restored.has_reading_override


@pytest.mark.parametrize(
    "reading", ["", "   ", "食べる", "taberu", "かな かな", "ー", "\u3099"]
)
def test_override_rejects_empty_or_non_kana_readings(services, reading):
    document, _, readings, overrides = services
    key = ReadingOverrideKey(document.id, document.revision, 0, 3)

    with pytest.raises(InvalidReadingError):
        readings.set_override(key, reading)

    assert overrides.get(key) is None


@pytest.mark.parametrize("start, end", [(0, 2), (1, 3), (3, 3), (-1, 3), (3, 7)])
def test_override_offsets_must_match_one_current_analysis_token(services, start, end):
    document, _, readings, overrides = services
    key = ReadingOverrideKey(document.id, document.revision, start, end)

    with pytest.raises(InvalidReadingOverrideTargetError):
        readings.set_override(key, "くった")

    assert overrides.get(key) is None


def test_override_rejects_a_stale_document_revision_before_analysis(services):
    document, _, readings, overrides = services
    stale = ReadingOverrideKey(document.id, document.revision + 1, 0, 3)

    with pytest.raises(StaleReadingOverrideRevisionError) as error:
        readings.set_override(stale, "くった")

    assert error.value.document_id == document.id
    assert error.value.document_revision == document.revision + 1
    assert overrides.get(stale) is None
