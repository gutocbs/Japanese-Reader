# Linguistic regression corpus

`tests/fixtures/japanese_cases.json` is the named `japanese-linguistic-regressions`
corpus. Its current schema/corpus version is `1`, and its `pinnedAnalyzer` section
identifies the SudachiPy/Core dictionary build against which version-dependent
expectations are evaluated.

The integration suite sends every non-empty case through the document-analysis
endpoint. It protects the application contract rather than treating Sudachi's
segmentation as application-owned behavior:

- every returned surface is the exact Unicode code-point slice of the submitted
  source;
- token gaps, spaces, tabs, paragraphs, and line endings are retained from that
  source;
- concatenated furigana segment text is the unchanged token surface;
- a token that contains kanji and has a reading always has at least one ruby
  segment with a reading.

## Covered cases

The corpus covers kana, kanji plus okurigana and conjugation, dictionary and
polite forms, ordinary numerals/Latin/punctuation, whitespace and paragraphs,
likely OOV text, non-BMP kanji, half/full-width source text, Split Mode B,
full-width numerals, iteration marks, and ambiguous jukujikun. The latter two
include hand-checked whole-token readings (`時々`, `人々`, `昨日`, and `大人`):
without a reliable kana anchor, one ruby over the whole lexical unit is the
required result. It deliberately does not invent a per-kanji split.

## CRLF policy

The source is never normalized. Analysis blocks use `splitlines(keepends=True)`,
so `"猫\\r\\n犬\\r\\n"` produces original code-point ranges `[0, 3)` and `[3, 6)`.
The CRLF terminator belongs to the preceding block; its internal Sudachi token
segmentation is not a UI contract. The reader reconstructs the original gaps
from the source text, preserving CRLF exactly.

## Fallback and dictionary updates

The aligner reports `furigana_fallback` only when an attempted partial alignment
is unsafe. A pure-kanji lexical unit with no kana anchor is already represented
as one whole-token ruby and does not need that diagnostic. Both paths satisfy the
mandatory rule: kanji plus a reading must keep ruby, while a missing reading is
the only reason to emit plain text.

Sudachi token boundaries, lemma, occurrence reading, dictionary reading, and
OOV classification are dictionary-version dependent. The fixture therefore pins
SudachiPy `0.6.11` and SudachiDict-core `20250825`. When either package changes,
run this suite first, review every changed linguistic outcome against the source
and the language requirement, and intentionally update the pin/corpus version
only after that review. Do not change expected readings or offsets merely to
mirror a new tokenizer output.
