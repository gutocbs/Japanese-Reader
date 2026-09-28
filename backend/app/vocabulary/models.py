import json
from dataclasses import dataclass
from enum import Enum

from backend.app.analysis.models import RawToken


@dataclass(frozen=True)
class VocabularyKey:
    lemma: str
    reading: str | None

    @classmethod
    def from_token(cls, token: RawToken) -> "VocabularyKey | None":
        if not token.raw_surface.strip() or token.part_of_speech[0] in {
            "補助記号", "記号", "空白",
        }:
            return None
        # Dictionary reading groups inflections. Missing dictionary information
        # deliberately falls back to this occurrence, even for ambiguous/OOV words.
        return cls(token.lemma, token.dictionary_reading or token.reading or None)

    def encode(self) -> str:
        """Stable wire/storage identity; JSON preserves boundaries and null."""
        return json.dumps([self.lemma, self.reading], ensure_ascii=False, separators=(",", ":"))


class FuriganaVisibility(str, Enum):
    INHERIT = "inherit"
    SHOW = "show"
    HIDE = "hide"


@dataclass(frozen=True)
class VocabularyDisplayPreference:
    key: VocabularyKey
    visibility: FuriganaVisibility
