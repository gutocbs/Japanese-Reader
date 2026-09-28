import pytest

from backend.app.persistence.memory.vocabulary import InMemoryVocabularySelectionRepository
from backend.tests.contracts.vocabulary_repository import (
    VocabularyDisplayPreferenceRepositoryContract,
    VocabularySelectionRepositoryContract,
)


@pytest.fixture
def repository():
    return InMemoryVocabularySelectionRepository()


class TestInMemoryVocabularySelectionRepository(VocabularySelectionRepositoryContract):
    pass


@pytest.fixture
def display_repository():
    return InMemoryVocabularySelectionRepository()


class TestInMemoryVocabularyDisplayPreferenceRepository(
    VocabularyDisplayPreferenceRepositoryContract
):
    pass
