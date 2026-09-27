from uuid import UUID

from backend.app.vocabulary.models import VocabularyKey
from backend.app.vocabulary.repository import VocabularySelectionRepository


CAT = VocabularyKey("猫", "ねこ")
DOG = VocabularyKey("犬", "いぬ")


class VocabularySelectionRepositoryContract:
    """Adapters supply an isolated repository fixture for this shared contract."""

    def test_replace_uses_set_semantics_and_is_idempotent(
        self, repository: VocabularySelectionRepository
    ):
        document_id = UUID("00000000-0000-0000-0000-000000000001")
        assert repository.list_selections(document_id) == frozenset()

        repository.replace_selections(document_id, [CAT, DOG, CAT])
        assert repository.list_selections(document_id) == frozenset({CAT, DOG})

        repository.replace_selections(document_id, [DOG, CAT])
        assert repository.list_selections(document_id) == frozenset({CAT, DOG})

    def test_documents_are_isolated_and_empty_replacement_clears_only_target(
        self, repository: VocabularySelectionRepository
    ):
        first = UUID("00000000-0000-0000-0000-000000000001")
        second = UUID("00000000-0000-0000-0000-000000000002")
        repository.replace_selections(first, [CAT])
        repository.replace_selections(second, [DOG])

        repository.replace_selections(first, [])

        assert repository.list_selections(first) == frozenset()
        assert repository.list_selections(second) == frozenset({DOG})
