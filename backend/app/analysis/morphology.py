from dataclasses import replace
from importlib.metadata import version
from threading import Lock
from typing import Protocol
from unicodedata import normalize

from sudachipy import dictionary, tokenizer
from sudachipy.morpheme import Morpheme

from backend.app.analysis.models import AnalyzerMetadata, RawToken


class MorphologicalAnalyzer(Protocol):
    @property
    def metadata(self) -> AnalyzerMetadata: ...

    def analyze(self, text: str, base_offset: int = 0) -> tuple[RawToken, ...]: ...


def _hiragana(reading: str) -> str | None:
    if not reading:
        return None
    # Decomposition exposes voiced archaic kana's base letters (ヷ -> ワ + ゙).
    return normalize(
        "NFC",
        "".join(
            chr(ord(char) - 0x60)
            if "ァ" <= char <= "ヶ" or char in "ヽヾ"
            else char
            for char in normalize("NFD", reading)
        ),
    )


class SudachiMorphologicalAnalyzer:
    """Own one Core dictionary and Mode B tokenizer for the application lifespan."""

    def __init__(self) -> None:
        self._dictionary = dictionary.Dictionary(dict="core")
        self._tokenizer = self._dictionary.create(mode=tokenizer.Tokenizer.SplitMode.B)
        self._lock = Lock()
        self._closed = False
        self._metadata = AnalyzerMetadata(
            analyzer_name="SudachiPy",
            analyzer_version=version("SudachiPy"),
            dictionary_name="SudachiDict-core",
            dictionary_version=version("SudachiDict-core"),
            split_mode="B",
        )

    @property
    def metadata(self) -> AnalyzerMetadata:
        return self._metadata

    def analyze(self, text: str, base_offset: int = 0) -> tuple[RawToken, ...]:
        # Sudachi's tokenizer owns mutable buffers; concurrent API workers share it.
        with self._lock:
            if self._closed:
                raise RuntimeError("Morphological analyzer is closed")
            tokens: list[RawToken] = []
            for morpheme in self._tokenizer.tokenize(text):
                token = RawToken(
                    raw_surface=morpheme.raw_surface(),
                    start_offset=base_offset + morpheme.begin(),
                    end_offset=base_offset + morpheme.end(),
                    lemma=morpheme.dictionary_form(),
                    reading=_hiragana(morpheme.reading_form()),
                    dictionary_reading=self._dictionary_reading(morpheme),
                    part_of_speech=morpheme.part_of_speech(),
                    is_out_of_vocabulary=morpheme.is_oov(),
                )
                if token.start_offset == token.end_offset:
                    if token.raw_surface or not tokens or tokens[-1].end_offset != token.start_offset:
                        raise ValueError("Normalization expansion has no matching source boundary")
                    # One source character can expand into several morphemes (㍿).
                    # Keep one selectable source span and its complete occurrence
                    # reading. A partial dictionary reading must not become a key.
                    previous = tokens[-1]
                    tokens[-1] = replace(
                        previous,
                        lemma=previous.lemma + token.lemma,
                        reading=((previous.reading or "") + (token.reading or "")) or None,
                        dictionary_reading=(
                            previous.dictionary_reading + token.dictionary_reading
                            if previous.dictionary_reading and token.dictionary_reading
                            else None
                        ),
                        is_out_of_vocabulary=(
                            previous.is_out_of_vocabulary or token.is_out_of_vocabulary
                        ),
                    )
                else:
                    tokens.append(token)
            return tuple(tokens)

    def _dictionary_reading(self, morpheme: Morpheme) -> str | None:
        if morpheme.is_oov():
            return None
        dictionary_form_morpheme = getattr(morpheme, "dictionary_form_morpheme", None)
        if dictionary_form_morpheme is not None:
            dictionary_morpheme = dictionary_form_morpheme()
            if dictionary_morpheme is not None:
                return _hiragana(dictionary_morpheme.reading_form())
            return None

        # SudachiPy 0.6.11 has no dictionary_form_morpheme API. Lookup avoids
        # reanalyzing a lemma in a new context and guessing among homograph readings.
        readings = {
            _hiragana(candidate.reading_form())
            for candidate in self._dictionary.lookup(morpheme.dictionary_form())
            if candidate.dictionary_id() == morpheme.dictionary_id()
            and candidate.part_of_speech()[:5] == morpheme.part_of_speech()[:5]
        }
        return next(iter(readings)) if len(readings) == 1 else None

    def close(self) -> None:
        with self._lock:
            if not self._closed:
                # Tokenizer holds its own shared dictionary reference in Sudachi.
                self._tokenizer = None
                self._dictionary.close()
                self._closed = True
