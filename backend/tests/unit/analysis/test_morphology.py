import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from importlib.metadata import version
from pathlib import Path
from types import SimpleNamespace

import pytest
from sudachipy import dictionary, tokenizer

from backend.app.analysis.morphology import SudachiMorphologicalAnalyzer
from backend.app import main
from backend.app.main import app


CORPUS = json.loads(
    (Path(__file__).parents[4] / "tests/fixtures/japanese_cases.json").read_text(
        encoding="utf-8"
    )
)
CASES = CORPUS["cases"]


@pytest.fixture(scope="module")
def analyzer():
    instance = SudachiMorphologicalAnalyzer()
    yield instance
    instance.close()


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_original_text_is_reconstructed_at_absolute_code_point_offsets(analyzer, case):
    text = case["text"]
    tokens = analyzer.analyze(text, base_offset=11)

    assert isinstance(tokens, tuple)
    assert "".join(token.raw_surface for token in tokens) == text
    cursor = 11
    for token in tokens:
        assert token.start_offset == cursor
        assert token.end_offset > token.start_offset
        assert token.raw_surface == text[token.start_offset - 11 : token.end_offset - 11]
        assert len(token.part_of_speech) == 6
        cursor = token.end_offset
    assert cursor == 11 + len(text)


def test_conjugated_occurrence_keeps_dictionary_reading_separate(analyzer):
    past = analyzer.analyze("食べた")[0]
    dictionary = analyzer.analyze("食べる")[0]
    polite = analyzer.analyze("食べます")[0]

    assert past.raw_surface == "食べ"
    assert past.lemma == dictionary.lemma == polite.lemma == "食べる"
    assert past.reading == polite.reading == "たべ"
    assert dictionary.reading == "たべる"
    assert past.dictionary_reading == dictionary.dictionary_reading == polite.dictionary_reading == "たべる"
    assert past.part_of_speech == ("動詞", "一般", "*", "*", "下一段-バ行", "連用形-一般")
    assert past.is_out_of_vocabulary is False


def test_reading_normalization_does_not_normalize_original_surface(analyzer):
    tokens = analyzer.analyze("ﾈｺ ＡＢＣ カタカナ")

    assert [(token.raw_surface, token.reading) for token in tokens] == [
        ("ﾈｺ", "ねこ"), (" ", "きごう"), ("ＡＢＣ", "えーびーしー"),
        (" ", "きごう"), ("カタカナ", "かたかな"),
    ]


def test_split_mode_b_and_metadata_track_pinned_dictionary(analyzer):
    assert [token.raw_surface for token in analyzer.analyze("国家公務員")] == ["国家", "公務員"]
    assert analyzer.metadata.analyzer_name == "SudachiPy"
    assert analyzer.metadata.analyzer_version == version("SudachiPy")
    assert analyzer.metadata.dictionary_name == "SudachiDict-core"
    assert analyzer.metadata.dictionary_version == version("SudachiDict-core")
    assert analyzer.metadata.split_mode == "B"


def test_oov_and_non_bmp_offsets_are_exposed_without_invented_dictionary_readings(analyzer):
    tokens = analyzer.analyze("A𠮷野家", base_offset=5)

    assert [(token.raw_surface, token.start_offset, token.end_offset) for token in tokens] == [
        ("A", 5, 6), ("𠮷", 6, 7), ("野家", 7, 9),
    ]
    assert tokens[1].is_out_of_vocabulary is True
    assert tokens[1].dictionary_reading is None
    unknown = analyzer.analyze("プニョラキュ星")[0]
    assert unknown.is_out_of_vocabulary is True
    assert unknown.reading == "ぷにょらきゅ"
    assert unknown.dictionary_reading is None


def test_shared_analyzer_can_analyze_independent_concurrent_inputs(analyzer):
    texts = ["食べた", "A𠮷野家", "ﾈｺ ＡＢＣ", "猫\n犬"] * 5
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(analyzer.analyze, texts))
    assert ["".join(token.raw_surface for token in tokens) for tokens in results] == texts


def test_ambiguous_dictionary_lookup_does_not_guess_a_homograph_reading(analyzer):
    token = analyzer.analyze("行った")[0]
    assert token.lemma == "行く"
    assert token.reading == "いっ"
    assert token.dictionary_reading is None


@pytest.mark.parametrize("available", [True, False])
def test_dictionary_form_morpheme_capability_is_authoritative(analyzer, monkeypatch, available):
    # Pinned 0.6.11 lacks this API. A narrow proxy adds only the proposed API
    # while retaining real Sudachi occurrence and dictionary morphemes.
    reference_dictionary = dictionary.Dictionary(dict="core")
    reference_tokenizer = reference_dictionary.create(mode=tokenizer.Tokenizer.SplitMode.B)
    text = "行った" if available else "食べた"
    occurrence = reference_tokenizer.tokenize(text)[0]
    dictionary_morpheme = reference_dictionary.lookup("行く")[0]

    class MorphemeWithDictionaryForm:
        def __getattr__(self, name):
            return getattr(occurrence, name)

        def dictionary_form_morpheme(self):
            return dictionary_morpheme if available else None

    monkeypatch.setattr(
        analyzer, "_tokenizer",
        SimpleNamespace(tokenize=lambda text: [MorphemeWithDictionaryForm()]),
    )
    try:
        token = analyzer.analyze(text)[0]
        assert token.reading == ("いっ" if available else "たべ")
        assert token.dictionary_reading == ("いく" if available else None)
    finally:
        reference_dictionary.close()


def test_lifespan_shares_analyzer_and_releases_it(monkeypatch):
    created = []

    def create_analyzer():
        instance = SudachiMorphologicalAnalyzer()
        created.append(instance)
        return instance

    monkeypatch.setattr(main, "SudachiMorphologicalAnalyzer", create_analyzer)

    async def exercise():
        async with app.router.lifespan_context(app):
            shared = app.state.morphological_analyzer
            assert shared.analyze("食べた")[0].dictionary_reading == "たべる"
            assert shared.analyze("猫")[0].reading == "ねこ"
            assert created == [shared]
        with pytest.raises(RuntimeError, match="closed"):
            shared.analyze("猫")
        assert shared._tokenizer is None
        assert not hasattr(app.state, "morphological_analyzer")

    asyncio.run(exercise())


@pytest.mark.parametrize("text, expected", [
    ("㍿", [("㍿", 13, 14, "かぶしきがいしゃ")]),
    ("𠮷㍿猫", [("𠮷", 13, 14, "𠮷"), ("㍿", 14, 15, "かぶしきがいしゃ"), ("猫", 15, 16, "ねこ")]),
    ("㍿㍿", [("㍿", 13, 14, "かぶしきがいしゃ"), ("㍿", 14, 15, "かぶしきがいしゃ")]),
])
def test_normalization_expansion_keeps_reading_in_positive_source_span(analyzer, text, expected):
    tokens = analyzer.analyze(text, base_offset=13)
    assert [(token.raw_surface, token.start_offset, token.end_offset, token.reading) for token in tokens] == expected
    assert "".join(token.raw_surface for token in tokens) == text
    for token in tokens:
        assert token.end_offset > token.start_offset
        assert token.raw_surface == text[token.start_offset - 13 : token.end_offset - 13]
    expanded = next(token for token in tokens if token.raw_surface == "㍿")
    assert expanded.lemma == "株式会社"
    assert expanded.dictionary_reading is None


@pytest.mark.parametrize("text, reading", [
    ("ヽヾ", "ゝゞ"),
    ("ヷヸヹヺ", "わ\u3099ゐ\u3099ゑ\u3099を\u3099"),
])
def test_iteration_and_voiced_archaic_katakana_readings_become_hiragana(analyzer, text, reading):
    tokens = analyzer.analyze(text)
    assert "".join(token.raw_surface for token in tokens) == text
    assert "".join(token.reading for token in tokens) == reading


@pytest.mark.parametrize("has_unrelated_previous_token", [False, True])
def test_unanchored_expansion_cannot_attach_reading_to_unrelated_source(analyzer, monkeypatch, has_unrelated_previous_token):
    real_tokenizer = analyzer._tokenizer
    zero_width = real_tokenizer.tokenize("A㍿")[-1]
    morphemes = [zero_width]
    if has_unrelated_previous_token:
        morphemes.insert(0, real_tokenizer.tokenize("猫")[0])
    monkeypatch.setattr(analyzer, "_tokenizer", SimpleNamespace(tokenize=lambda text: morphemes))
    with pytest.raises(ValueError, match="source boundary"):
        analyzer.analyze("A㍿")
