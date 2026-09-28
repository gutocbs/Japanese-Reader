import pytest

from backend.app.persistence.memory.readings import InMemoryReadingOverrideRepository
from backend.tests.contracts.reading_repository import ReadingOverrideRepositoryContract


@pytest.fixture
def repository():
    return InMemoryReadingOverrideRepository()


class TestInMemoryReadingOverrideRepository(ReadingOverrideRepositoryContract):
    pass
