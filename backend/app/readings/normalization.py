from unicodedata import normalize


class InvalidReadingError(ValueError):
    def __init__(self) -> None:
        super().__init__("Reading must contain kana only")


def normalize_kana_reading(reading: str) -> str:
    stripped = normalize("NFKC", reading.strip())
    hiragana = normalize(
        "NFC",
        "".join(
            chr(ord(character) - 0x60)
            if "ァ" <= character <= "ヶ" or character in "ヽヾ"
            else character
            for character in normalize("NFD", stripped)
        ),
    )
    if not any("ぁ" <= character <= "ゖ" for character in hiragana) or any(
        not ("ぁ" <= character <= "ゖ" or character in "ゝゞー\u3099\u309a")
        for character in hiragana
    ):
        raise InvalidReadingError()
    return hiragana
