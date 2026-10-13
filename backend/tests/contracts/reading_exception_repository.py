from datetime import datetime, timezone

from backend.app.reading_exceptions.models import ReadingException
from backend.app.reading_exceptions.repository import ReadingExceptionRepository


DELETED_AT = datetime(2026, 10, 12, 15, 30, tzinfo=timezone.utc)


class ReadingExceptionRepositoryContract:
    def test_lists_active_exceptions_in_lemma_order(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.list_active() == (
            ReadingException("猫", "ねこ"),
            ReadingException("私", "わたし"),
        )

    def test_list_excludes_deleted_entries_by_default_and_includes_them_on_request(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.soft_delete("私") == ReadingException(
            "私", "わたし", DELETED_AT
        )

        assert repository.list() == (ReadingException("猫", "ねこ"),)
        assert repository.list(include_deleted=True) == (
            ReadingException("猫", "ねこ"),
            ReadingException("私", "わたし", DELETED_AT),
        )

    def test_put_creates_an_active_exception(self, repository: ReadingExceptionRepository):
        assert repository.put("犬", "いぬ") == (ReadingException("犬", "いぬ"), True)

        assert repository.list_active() == (
            ReadingException("犬", "いぬ"),
            ReadingException("猫", "ねこ"),
            ReadingException("私", "わたし"),
        )

    def test_put_updates_an_existing_active_exception(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.put("猫", "ネコ") == (ReadingException("猫", "ネコ"), False)

    def test_put_reactivates_an_existing_deleted_exception(
        self, repository: ReadingExceptionRepository
    ):
        repository.soft_delete("猫")

        assert repository.put("猫", "ネコ") == (ReadingException("猫", "ネコ"), False)

    def test_soft_delete_marks_an_active_exception_with_the_utc_clock_time(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.soft_delete("猫") == ReadingException("猫", "ねこ", DELETED_AT)

    def test_soft_delete_returns_none_for_an_already_deleted_exception(
        self, repository: ReadingExceptionRepository
    ):
        repository.soft_delete("猫")

        assert repository.soft_delete("猫") is None

    def test_restore_reactivates_a_deleted_exception_without_changing_its_reading(
        self, repository: ReadingExceptionRepository
    ):
        repository.soft_delete("猫")

        assert repository.restore("猫") == ReadingException("猫", "ねこ")

    def test_restore_returns_the_current_active_exception_unchanged(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.restore("猫") == ReadingException("猫", "ねこ")

    def test_restore_returns_none_for_a_missing_exception(
        self, repository: ReadingExceptionRepository
    ):
        assert repository.restore("犬") is None

