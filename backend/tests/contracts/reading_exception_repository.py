from backend.app.reading_exceptions.models import ReadingException
from backend.app.reading_exceptions.repository import ReadingExceptionRepository

class ReadingExceptionRepositoryContract:
    def test_lists_active_exceptions_in_lemma_order(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.list_active() == (
            ReadingException("猫", "ねこ"),
            ReadingException("私", "わたし"),
        )

