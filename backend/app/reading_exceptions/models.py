from dataclasses import dataclass


@dataclass(frozen=True)
class ReadingException:
    lemma: str
    reading: str
