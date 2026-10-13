from datetime import datetime
from dataclasses import dataclass


@dataclass(frozen=True)
class ReadingException:
    lemma: str
    reading: str
    deleted_at: datetime | None = None
