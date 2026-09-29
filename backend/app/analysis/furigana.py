from dataclasses import dataclass
from itertools import groupby
from unicodedata import name, normalize


@dataclass(frozen=True)
class FuriganaSegment:
    text: str
    reading: str | None


@dataclass(frozen=True)
class FuriganaAlignment:
    segments: tuple[FuriganaSegment, ...]
    used_fallback: bool = False


def _is_kanji(char: str) -> bool:
    return char in "々〇〆" or name(char, "").startswith(
        ("CJK UNIFIED IDEOGRAPH-", "CJK COMPATIBILITY IDEOGRAPH-")
    )


def _kana_anchor(text: str) -> str | None:
    # Normalize comparison only; emitted segment text remains the original slice.
    decomposed = normalize("NFD", normalize("NFKC", text))
    kana = normalize("NFC", "".join(
        chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" or char in "ヽヾ" else char
        for char in decomposed
    ))
    return kana if all("ぁ" <= char <= "ゖ" or char in "ゝゞ\u3099\u309aー" for char in kana) else None


def _parenthetical_annotations(
    surface: str,
) -> tuple[str, tuple[tuple[int, str], ...]] | None:
    if "（" not in surface and "）" not in surface:
        return None

    plain: list[str] = []
    annotations: list[tuple[int, str]] = []
    index = 0
    while index < len(surface):
        char = surface[index]
        if char == "）":
            return None
        if char != "（":
            plain.append(char)
            index += 1
            continue

        end = surface.find("）", index + 1)
        if end == -1 or "（" in surface[index + 1:end]:
            return None
        annotations.append((len(plain), surface[index:end + 1]))
        index = end + 1

    return "".join(plain), tuple(annotations)


def _restore_parenthetical_annotations(
    surface: str,
    segments: tuple[FuriganaSegment, ...],
    annotations: tuple[tuple[int, str], ...],
) -> tuple[FuriganaSegment, ...] | None:
    restored: list[FuriganaSegment] = []
    annotation_index = 0
    cursor = 0

    def append(text: str, reading: str | None) -> None:
        if not text:
            return
        if reading is None and restored and restored[-1].reading is None:
            previous = restored[-1]
            restored[-1] = FuriganaSegment(previous.text + text, None)
        else:
            restored.append(FuriganaSegment(text, reading))

    for segment in segments:
        end = cursor + len(segment.text)
        if segment.reading is not None:
            while (
                annotation_index < len(annotations)
                and annotations[annotation_index][0] == cursor
            ):
                append(annotations[annotation_index][1], None)
                annotation_index += 1
            if (
                annotation_index < len(annotations)
                and annotations[annotation_index][0] < end
            ):
                return None
            append(segment.text, segment.reading)
        else:
            position = cursor
            while (
                annotation_index < len(annotations)
                and annotations[annotation_index][0] < end
            ):
                annotation_position, annotation = annotations[annotation_index]
                if annotation_position < position:
                    return None
                append(segment.text[position - cursor:annotation_position - cursor], None)
                append(annotation, None)
                position = annotation_position
                annotation_index += 1
            append(segment.text[position - cursor:], None)
        cursor = end

    while (
        annotation_index < len(annotations)
        and annotations[annotation_index][0] == cursor
    ):
        append(annotations[annotation_index][1], None)
        annotation_index += 1

    result = tuple(restored)
    if annotation_index != len(annotations) or "".join(item.text for item in result) != surface:
        return None
    return result


class FuriganaAligner:
    def align(self, surface: str, reading: str | None) -> tuple[FuriganaSegment, ...]:
        return self.align_with_diagnostics(surface, reading).segments

    def align_with_diagnostics(self, surface: str, reading: str | None) -> FuriganaAlignment:
        """Align normalized hiragana reading, accepting only unambiguous kana anchors."""
        if not reading or not any(_is_kanji(char) for char in surface):
            return FuriganaAlignment((FuriganaSegment(surface, None),))

        fallback = FuriganaAlignment((FuriganaSegment(surface, reading),), used_fallback=True)
        parenthetical = _parenthetical_annotations(surface)
        if parenthetical is not None:
            plain_surface, annotations = parenthetical
            if plain_surface and any(_is_kanji(char) for char in plain_surface):
                plain_alignment = self.align_with_diagnostics(plain_surface, reading)
                if not plain_alignment.used_fallback:
                    restored = _restore_parenthetical_annotations(
                        surface, plain_alignment.segments, annotations
                    )
                    if restored is not None:
                        return FuriganaAlignment(restored)

        runs = [(kanji, "".join(chars)) for kanji, chars in groupby(surface, _is_kanji)]
        anchors = [None if kanji else _kana_anchor(text) for kanji, text in runs]
        if any(not kanji and anchor is None for (kanji, _), anchor in zip(runs, anchors)):
            return fallback

        segments: list[FuriganaSegment] = []
        cursor = 0
        for index, (kanji, text) in enumerate(runs):
            if not kanji:
                anchor = anchors[index]
                if not reading.startswith(anchor, cursor):
                    return fallback
                cursor += len(anchor)
                segments.append(FuriganaSegment(text, None))
                continue

            end = len(reading)
            if index + 1 < len(runs):
                anchor = anchors[index + 1]
                if index + 2 == len(runs):
                    if not reading.endswith(anchor):
                        return fallback
                    end -= len(anchor)
                else:
                    end = reading.find(anchor, cursor + 1)
                    # Repeated interior kana may belong to either neighboring
                    # kanji block. Do not guess a split, even if one seems likely.
                    if end == -1 or reading.find(anchor, end + 1) != -1:
                        return fallback
            if end <= cursor:
                return fallback
            segments.append(FuriganaSegment(text, reading[cursor:end]))
            cursor = end

        return FuriganaAlignment(tuple(segments)) if cursor == len(reading) else fallback
