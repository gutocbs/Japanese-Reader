import pytest

from backend.app.persistence.memory.vocabulary import InMemoryVocabularySelectionRepository
from backend.tests.contracts.vocabulary_repository import (
    VocabularySelectionRepositoryContract,
)


@pytest.fixture
def repository():
    return InMemoryVocabularySelectionRepository()


class TestInMemoryVocabularySelectionRepository(VocabularySelectionRepositoryContract):
    pass
