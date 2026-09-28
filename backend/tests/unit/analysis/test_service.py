from dataclasses import replace
from hashlib import sha256
from uuid import uuid4

import pytest

from backend.app.analysis.furigana import FuriganaAligner
from backend.app.analysis.models import (
    AnalysisCacheKey,
    AnalysisOptions,
    AnalyzerMetadata,
    RawToken,
)
from backend.app.analysis.morphology import SudachiMorphologicalAnalyzer
from backend.app.analysis.service import AnalysisService, EmptyDocumentError, StaleDocumentRevisionError
from backend.app.documents.models import CreateDocument, UpdateDocument
from backend.app.documents.service import DocumentNotFoundError
from backend.app.persistence.memory.analyses import InMemoryAnalysisRepository
from backend.app.persistence.memory.documents import InMemoryDocumentRepository
from backend.app.persistence.memory.readings import InMemoryReadingOverrideRepository
from backend.app.readings.service import ReadingOverrideResolver


@pytest.fixture
def analyzer():
    instance = SudachiMorphologicalAnalyzer()
    yield instance
    instance.close()


def service_for(documents, analyzer, cache=None):
    return AnalysisService(documents, cache or InMemoryAnalysisRepository(), analyzer, FuriganaAligner())


def test_analysis_preserves_absolute_code_point_offsets_and_original_gaps(analyzer):
    content = "A𠮷野家\n昨日、食べた。"
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", content))
    result = service_for(documents, analyzer).analyze(document.id)
    assert result.document_id == document.id
    assert result.document_revision == 1
    assert result.content_hash == sha256(content.encode("utf-8")).hexdigest()
    assert result.metadata == analyzer.metadata
    assert result.analysis_options.split_mode == "B"
    assert [(block.start_offset, block.end_offset) for block in result.blocks] == [(0, 5), (5, 12)]
    assert result.blocks[1].tokens[0].surface == "昨日"
    assert result.blocks[1].tokens[0].start_offset == 5
    cursor = 0
    reconstructed = ""
    for block in result.blocks:
        for token in block.tokens:
            assert cursor <= token.start_offset < token.end_offset <= len(content)
            assert content[token.start_offset:token.end_offset] == token.surface
            assert "".join(segment.text for segment in token.furigana_segments) == token.surface
            reconstructed += content[cursor:token.start_offset] + token.surface
            cursor = token.end_offset
    assert reconstructed + content[cursor:] == content
    food = next(token for block in result.blocks for token in block.tokens if token.surface == "食べ")
    assert food.reading == "たべ"
    assert food.dictionary_reading == "たべる"
    assert food.vocabulary_key == '["食べる","たべる"]'
    assert food.is_lexical
    punctuation = result.blocks[1].tokens[-1]
    assert not punctuation.is_lexical
    assert punctuation.vocabulary_key is None


@pytest.mark.parametrize("content, boundaries", [
    ("猫\r\n\r\n犬\t ", [(0, 3), (3, 5), (5, 8)]),
    ("\n猫\n", [(0, 1), (1, 3)]),
    ("猫\r犬", [(0, 2), (2, 3)]),
    ("猫\u2029犬", [(0, 2), (2, 3)]),
])
def test_blocks_cover_newlines_and_blank_paragraphs_without_changing_offsets(analyzer, content, boundaries):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", content))
    result = service_for(documents, analyzer).analyze(document.id)
    assert [(block.start_offset, block.end_offset) for block in result.blocks] == boundaries
    assert "".join(content[block.start_offset:block.end_offset] for block in result.blocks) == content
    for block in result.blocks:
        for token in block.tokens:
            assert block.start_offset <= token.start_offset < token.end_offset <= block.end_offset
            assert content[token.start_offset:token.end_offset] == token.surface


class UncalledAnalyzer:
    metadata = AnalyzerMetadata("test", "1", "dictionary", "1", "B")

    def analyze(self, text, base_offset=0):
        raise AssertionError("Morphology must not be invoked")


def test_missing_document_is_rejected_before_morphology():
    with pytest.raises(DocumentNotFoundError):
        service_for(InMemoryDocumentRepository(), UncalledAnalyzer()).analyze(uuid4())


@pytest.mark.parametrize("content", ["", " \t\r\n\u3000"])
def test_empty_document_is_rejected_before_morphology(content):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", content))
    with pytest.raises(EmptyDocumentError):
        service_for(documents, UncalledAnalyzer()).analyze(document.id)


@pytest.mark.parametrize("delete", [False, True])
def test_revision_change_or_deletion_during_analysis_never_saves_stale_result(analyzer, delete):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "猫"))
    cache = InMemoryAnalysisRepository()
    baseline = service_for(documents, analyzer).analyze(document.id)

    class EditingAnalyzer:
        metadata = analyzer.metadata

        def analyze(self, text, base_offset=0):
            result = analyzer.analyze(text, base_offset)
            if delete:
                documents.delete(document.id)
            else:
                documents.update(document.id, UpdateDocument(content="犬"))
            return result

    with pytest.raises(StaleDocumentRevisionError):
        service_for(documents, EditingAnalyzer(), cache).analyze(document.id)
    assert cache.find_compatible(baseline.cache_key) is None


def test_same_revision_content_change_during_analysis_is_rejected_by_utf8_hash(analyzer):
    storage = InMemoryDocumentRepository()
    document = storage.create(CreateDocument("title", "猫"))
    cache = InMemoryAnalysisRepository()

    class SameRevisionRepository:
        current = document

        def get(self, document_id):
            return self.current if document_id == document.id else None

    documents = SameRevisionRepository()

    class SameRevisionEditingAnalyzer:
        metadata = analyzer.metadata

        def analyze(self, text, base_offset=0):
            result = analyzer.analyze(text, base_offset)
            documents.current = replace(document, content="犬")
            return result

    with pytest.raises(StaleDocumentRevisionError):
        service_for(documents, SameRevisionEditingAnalyzer(), cache).analyze(document.id)
    stale_key = AnalysisCacheKey(
        document.id,
        document.revision,
        sha256(document.content.encode("utf-8")).hexdigest(),
        analyzer.metadata,
        AnalysisOptions(split_mode=analyzer.metadata.split_mode),
    )
    assert cache.find_compatible(stale_key) is None


def test_compatible_cache_skips_morphology_and_title_changes_keep_it(analyzer):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "猫"))
    cache = InMemoryAnalysisRepository()
    original = service_for(documents, analyzer, cache).analyze(document.id)
    documents.update(document.id, UpdateDocument(title="renamed"))
    uncalled = UncalledAnalyzer()
    uncalled.metadata = analyzer.metadata
    assert service_for(documents, uncalled, cache).analyze(document.id) == original


def test_cache_hit_rechecks_revision_before_returning(analyzer):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "猫"))

    class EditingCache(InMemoryAnalysisRepository):
        def find_compatible(self, key):
            result = super().find_compatible(key)
            documents.update(document.id, UpdateDocument(content="犬"))
            return result

    cache = EditingCache()
    original = service_for(documents, analyzer).analyze(document.id)
    cache.save(original)
    with pytest.raises(StaleDocumentRevisionError):
        service_for(documents, analyzer, cache).analyze(document.id)


def test_revision_change_while_cache_is_saved_is_rejected_before_publication(analyzer):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "猫"))

    class EditingSaveCache(InMemoryAnalysisRepository):
        def save(self, analysis):
            super().save(analysis)
            documents.update(document.id, UpdateDocument(content="犬"))

    cache = EditingSaveCache()
    original = service_for(documents, analyzer).analyze(document.id)
    with pytest.raises(StaleDocumentRevisionError):
        service_for(documents, analyzer, cache).analyze(document.id)
    assert cache.find_compatible(original.cache_key) is None


def test_content_edit_computes_new_revision_even_if_old_cache_exists(analyzer):
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "猫"))
    cache = InMemoryAnalysisRepository()
    service = service_for(documents, analyzer, cache)
    old = service.analyze(document.id)
    documents.update(document.id, UpdateDocument(content="犬"))
    new = service.analyze(document.id)
    assert new.document_revision == 2
    assert new.content_hash != old.content_hash
    assert new.blocks[0].tokens[0].surface == "犬"
    assert cache.find_compatible(new.cache_key) == new


def test_cache_requires_every_identity_component_and_invalidates_only_target_document(analyzer):
    documents = InMemoryDocumentRepository()
    first = documents.create(CreateDocument("first", "猫"))
    second = documents.create(CreateDocument("second", "猫"))
    cache = InMemoryAnalysisRepository()
    service = service_for(documents, analyzer, cache)
    result = service.analyze(first.id)
    other = service.analyze(second.id)
    key = result.cache_key
    incompatible = [
        replace(key, document_id=uuid4()), replace(key, document_revision=2),
        replace(key, content_hash="different"),
        replace(key, metadata=replace(key.metadata, analyzer_version="different")),
        replace(key, metadata=replace(key.metadata, dictionary_version="different")),
        replace(key, analysis_options=replace(key.analysis_options, split_mode="A")),
    ]
    for incompatible_key in incompatible:
        assert cache.find_compatible(incompatible_key) is None
    cache.invalidate_document(first.id)
    assert cache.find_compatible(key) is None
    assert cache.find_compatible(other.cache_key) == other


def test_analysis_records_missing_reading_and_actual_alignment_fallback():
    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "謎 食べた 昨日"))

    class DiagnosticAnalyzer:
        metadata = UncalledAnalyzer.metadata

        def analyze(self, text, base_offset=0):
            return (
                RawToken("謎", 0, 1, "謎", None, None, ("名詞", "*", "*", "*", "*", "*"), True),
                RawToken("食べた", 2, 5, "食べる", "くった", "たべる", ("動詞", "*", "*", "*", "*", "*"), False),
                RawToken("昨日", 6, 8, "昨日", "きのう", "きのう", ("名詞", "*", "*", "*", "*", "*"), False),
            )

    result = service_for(documents, DiagnosticAnalyzer()).analyze(document.id)
    assert [(item.code, item.start_offset, item.end_offset) for item in result.diagnostics] == [
        ("missing_reading", 0, 1), ("furigana_fallback", 2, 5),
    ]
    assert result.blocks[0].tokens[0].furigana_segments[0].reading is None
    assert result.blocks[0].tokens[1].furigana_segments[0].reading == "くった"


def test_analysis_without_overrides_does_not_query_each_token(analyzer):
    class CountingReadingRepository(InMemoryReadingOverrideRepository):
        def __init__(self):
            super().__init__()
            self.has_document_calls = 0
            self.get_calls = 0

        def has_document(self, document_id):
            self.has_document_calls += 1
            return super().has_document(document_id)

        def get(self, key):
            self.get_calls += 1
            return super().get(key)

    documents = InMemoryDocumentRepository()
    document = documents.create(CreateDocument("title", "昨日、日本語を読みました。"))
    overrides = CountingReadingRepository()
    service = AnalysisService(
        documents,
        InMemoryAnalysisRepository(),
        analyzer,
        FuriganaAligner(),
        ReadingOverrideResolver(overrides),
    )

    result = service.analyze(document.id)

    assert sum(len(block.tokens) for block in result.blocks) > 1
    assert overrides.has_document_calls == 1
    assert overrides.get_calls == 0
