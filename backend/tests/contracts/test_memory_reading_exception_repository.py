import pytest

from backend.app.persistence.memory.reading_exceptions import (
    InMemoryReadingExceptionRepository,
)
from backend.app.reading_exceptions.models import ReadingException
from backend.tests.contracts.reading_exception_repository import (
    ReadingExceptionRepositoryContract,
)


class TestInMemoryReadingExceptionRepository(ReadingExceptionRepositoryContract):
    @pytest.fixture
    def repository(self):
        return InMemoryReadingExceptionRepository(
            (ReadingException("私", "わたし"), ReadingException("猫", "ねこ"))
        )

    def test_replaced_snapshot_is_reflected(self, repository):
        repository.replace(
            (ReadingException("彼", "かれ"), ReadingException("私", "わたし"))
        )

        assert repository.list_active() == (
            ReadingException("彼", "かれ"),
            ReadingException("私", "わたし"),
        )
