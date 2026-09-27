import pytest

from backend.app.analysis.furigana import FuriganaAligner, FuriganaSegment


@pytest.mark.parametrize("surface, reading", [
    ("かな", "かな"), ("カタカナ", "かたかな"), ("ﾈｺ", "ねこ"),
    ("abc １２３！\r\n", "abc"), ("", None), ("猫", None), ("猫", ""),
])
def test_without_kanji_or_reading_returns_unchanged_plain_text(surface, reading):
    assert FuriganaAligner().align(surface, reading) == (FuriganaSegment(surface, None),)


@pytest.mark.parametrize("surface, reading, expected", [
    ("猫", "ねこ", [("猫", "ねこ")]),
    ("日本語", "にほんご", [("日本語", "にほんご")]),
    ("食べた", "たべた", [("食", "た"), ("べた", None)]),
    ("取り戻す", "とりもどす", [("取", "と"), ("り", None), ("戻", "もど"), ("す", None)]),
    ("お祝い", "おいわい", [("お", None), ("祝", "いわ"), ("い", None)]),
    ("食ベル", "たべる", [("食", "た"), ("ベル", None)]),
    ("食ﾍﾞﾙ", "たべる", [("食", "た"), ("ﾍﾞﾙ", None)]),
    ("食へ\u3099た", "たべた", [("食", "た"), ("へ\u3099た", None)]),
    ("𠮷野", "よしの", [("𠮷野", "よしの")]),
    ("時々", "ときどき", [("時々", "ときどき")]),
])
def test_unique_kana_anchors_preserve_surface_and_assign_reading(surface, reading, expected):
    segments = FuriganaAligner().align(surface, reading)
    assert [(segment.text, segment.reading) for segment in segments] == expected
    assert "".join(segment.text for segment in segments) == surface


@pytest.mark.parametrize("surface, reading", [
    ("昨日", "きのう"),
    ("漢あ字", "かああじ"),  # Two possible interior anchor positions.
    ("漢あ字", "かじ"),  # Anchor absent from irregular reading.
    ("漢あ字", "あじ"),  # Would leave first kanji without a reading.
    ("漢あ字", "かあ"),  # Would leave last kanji without a reading.
    ("食べた", "くった"),  # Irregular override does not match okurigana.
    ("漢A字", "かんえーじ"),  # Non-kana material cannot be used as an anchor.
    ("猫\r\n犬", "ねこいぬ"),
])
def test_uncertain_alignment_keeps_whole_unit_ruby(surface, reading):
    segments = FuriganaAligner().align(surface, reading)
    assert segments == (FuriganaSegment(surface, reading),)
    assert "".join(segment.text for segment in segments) == surface
