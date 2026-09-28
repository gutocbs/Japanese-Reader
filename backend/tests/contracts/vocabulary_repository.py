from uuid import UUID

from backend.app.vocabulary.models import (
    FuriganaVisibility,
    VocabularyDisplayPreference,
    VocabularyKey,
)
from backend.app.vocabulary.repository import (
    VocabularyDisplayPreferenceRepository,
    VocabularySelectionRepository,
)


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


class VocabularyDisplayPreferenceRepositoryContract:
    """Shared behavior required from memory and later SQLite adapters."""

    def test_missing_key_inherits_and_set_upserts_one_document_key(
        self, display_repository: VocabularyDisplayPreferenceRepository
    ):
        document_id = UUID("00000000-0000-0000-0000-000000000001")

        assert (
            display_repository.get_display_preference(document_id, CAT)
            is FuriganaVisibility.INHERIT
        )

        display_repository.set_display_preference(
            document_id, CAT, FuriganaVisibility.SHOW
        )
        display_repository.set_display_preference(
            document_id, CAT, FuriganaVisibility.HIDE
        )

        assert display_repository.list_display_preferences(document_id) == (
            VocabularyDisplayPreference(CAT, FuriganaVisibility.HIDE),
        )
        assert (
            display_repository.get_display_preference(document_id, CAT)
            is FuriganaVisibility.HIDE
        )

    def test_preferences_are_isolated_by_document_and_key(
        self, display_repository: VocabularyDisplayPreferenceRepository
    ):
        first = UUID("00000000-0000-0000-0000-000000000001")
        second = UUID("00000000-0000-0000-0000-000000000002")

        display_repository.set_display_preference(first, CAT, FuriganaVisibility.SHOW)
        display_repository.set_display_preference(first, DOG, FuriganaVisibility.HIDE)
        display_repository.set_display_preference(second, CAT, FuriganaVisibility.HIDE)

        assert display_repository.list_display_preferences(first) == (
            VocabularyDisplayPreference(DOG, FuriganaVisibility.HIDE),
            VocabularyDisplayPreference(CAT, FuriganaVisibility.SHOW),
        )
        assert display_repository.list_display_preferences(second) == (
            VocabularyDisplayPreference(CAT, FuriganaVisibility.HIDE),
        )
