import json
from dataclasses import replace

import pytest

from backend.app.analysis.models import RawToken
from backend.app.analysis.morphology import SudachiMorphologicalAnalyzer
from backend.app.vocabulary.models import VocabularyKey


def token(**changes):
    return replace(RawToken(
        raw_surface="食べた", start_offset=0, end_offset=3,
        lemma="食べる", reading="たべた", dictionary_reading="たべる",
        part_of_speech=("動詞", "一般", "*", "*", "*", "*"),
        is_out_of_vocabulary=False,
    ), **changes)


def test_conjugations_share_dictionary_identity_with_real_morphology():
    analyzer = SudachiMorphologicalAnalyzer()
    try:
        keys = [VocabularyKey.from_token(analyzer.analyze(text)[0])
                for text in ("食べる", "食べた", "食べます")]
    finally:
        analyzer.close()
    assert keys == [VocabularyKey("食べる", "たべる")] * 3
    assert len(set(keys)) == 1


def test_distinct_dictionary_readings_are_distinct_identities():
    first = VocabularyKey.from_token(token(lemma="生", dictionary_reading="なま"))
    second = VocabularyKey.from_token(token(lemma="生", dictionary_reading="せい"))
    assert first != second


@pytest.mark.parametrize("missing", [None, ""])
def test_missing_dictionary_reading_falls_back_to_occurrence(missing):
    assert VocabularyKey.from_token(token(dictionary_reading=missing)) == VocabularyKey("食べる", "たべた")


def test_pos_and_oov_do_not_change_identity():
    assert VocabularyKey.from_token(token()) == VocabularyKey.from_token(token(
        part_of_speech=("名詞", "普通名詞", "一般", "*", "*", "*"),
        is_out_of_vocabulary=True,
    ))


@pytest.mark.parametrize("surface, pos", [("。", "補助記号"), ("★", "記号"), (" \t", "空白")])
def test_nonlexical_tokens_have_no_key(surface, pos):
    assert VocabularyKey.from_token(token(
        raw_surface=surface, part_of_speech=(pos, "*", "*", "*", "*", "*"),
    )) is None


def test_lexical_oov_without_reading_retains_explicit_null_identity():
    assert VocabularyKey.from_token(token(
        lemma="Qzv", reading=None, dictionary_reading=None, is_out_of_vocabulary=True,
    )) == VocabularyKey("Qzv", None)


def test_encoding_preserves_both_components_without_delimiter_collisions():
    keys = [VocabularyKey("a|b", "c"), VocabularyKey("a", "b|c"),
            VocabularyKey('a"\\\n', "猫"), VocabularyKey("a", None), VocabularyKey("a", "null")]
    assert len({key.encode() for key in keys}) == len(keys)
    assert [json.loads(key.encode()) for key in keys] == [
        ["a|b", "c"], ["a", "b|c"], ['a"\\\n', "猫"], ["a", None], ["a", "null"],
    ]
