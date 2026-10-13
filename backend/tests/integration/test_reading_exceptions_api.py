import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.reading_exceptions.service import ReadingExceptionService


@pytest.fixture
def client():
    with TestClient(create_app(":memory:")) as test_client:
        yield test_client


def test_list_returns_only_active_exceptions_by_default_and_deleted_when_requested(client):
    assert client.put("/api/reading-exceptions/犬", json={"reading": "いぬ"}).status_code == 201
    assert client.put("/api/reading-exceptions/猫", json={"reading": "ねこ"}).status_code == 201
    assert client.delete("/api/reading-exceptions/猫").status_code == 200

    assert client.get("/api/reading-exceptions").json() == [
        {"lemma": "犬", "reading": "いぬ", "deletedAt": None},
        {"lemma": "私", "reading": "わたし", "deletedAt": None},
    ]
    all_exceptions = client.get("/api/reading-exceptions?includeDeleted=true")

    assert all_exceptions.status_code == 200
    assert all_exceptions.json()[0] == {"lemma": "犬", "reading": "いぬ", "deletedAt": None}
    assert all_exceptions.json()[1]["lemma"] == "猫"
    assert all_exceptions.json()[1]["reading"] == "ねこ"
    assert all_exceptions.json()[1]["deletedAt"].endswith(("+00:00", "Z"))
    assert all_exceptions.json()[2] == {"lemma": "私", "reading": "わたし", "deletedAt": None}


def test_put_creates_updates_and_reactivates_without_an_explicit_restore(client):
    path = "/api/reading-exceptions/猫"

    created = client.put(path, json={"reading": "ネコ"})
    updated = client.put(path, json={"reading": "ねこ"})
    assert client.delete(path).status_code == 200
    reactivated = client.put(path, json={"reading": "びょう"})

    assert created.status_code == 201
    assert created.json() == {"lemma": "猫", "reading": "ねこ", "deletedAt": None}
    assert updated.status_code == 200
    assert updated.json() == {"lemma": "猫", "reading": "ねこ", "deletedAt": None}
    assert reactivated.status_code == 200
    assert reactivated.json() == {"lemma": "猫", "reading": "びょう", "deletedAt": None}
    assert client.get("/api/reading-exceptions").json() == [
        reactivated.json(),
        {"lemma": "私", "reading": "わたし", "deletedAt": None},
    ]


def test_delete_returns_utc_timestamp_and_restore_is_explicit_and_idempotent(client):
    path = "/api/reading-exceptions/猫"
    assert client.put(path, json={"reading": "ねこ"}).status_code == 201

    deleted = client.delete(path)
    restored = client.put(f"{path}/restore")
    restored_again = client.put(f"{path}/restore")

    assert deleted.status_code == 200
    assert deleted.json()["lemma"] == "猫"
    assert deleted.json()["reading"] == "ねこ"
    assert deleted.json()["deletedAt"].endswith(("+00:00", "Z"))
    assert restored.status_code == 200
    assert restored.json() == {"lemma": "猫", "reading": "ねこ", "deletedAt": None}
    assert restored_again.status_code == 200
    assert restored_again.json() == restored.json()


def test_missing_and_inactive_lifecycle_targets_return_problem_details(client):
    missing = "/api/reading-exceptions/不存在"

    missing_delete = client.delete(missing)
    missing_restore = client.put(f"{missing}/restore")
    assert client.put("/api/reading-exceptions/猫", json={"reading": "ねこ"}).status_code == 201
    assert client.delete("/api/reading-exceptions/猫").status_code == 200
    inactive_delete = client.delete("/api/reading-exceptions/猫")

    for response in (missing_delete, missing_restore, inactive_delete):
        assert response.status_code == 404
        assert response.headers["content-type"] == "application/problem+json"
        assert response.json()["status"] == 404


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/reading-exceptions/%20", {"reading": "ねこ"}),
        ("/api/reading-exceptions/猫", {"reading": "cat"}),
    ],
)
def test_empty_lemma_and_invalid_reading_return_problem_details(client, path, payload):
    response = client.put(path, json=payload)

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["status"] == 422


def test_sqlite_errors_from_the_reading_exception_service_map_to_503(client):
    class FailingRepository:
        def list(self, *, include_deleted=False):
            raise sqlite3.OperationalError("database is locked")

        def list_active(self):
            raise AssertionError("The API list route must call list")

        def put(self, lemma, reading):
            raise AssertionError("Not used by this test")

        def soft_delete(self, lemma):
            raise AssertionError("Not used by this test")

        def restore(self, lemma):
            raise AssertionError("Not used by this test")

    client.app.state.reading_exception_service = ReadingExceptionService(FailingRepository())

    response = client.get("/api/reading-exceptions")

    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json() == {
        "type": "about:blank",
        "title": "Service Unavailable",
        "status": 503,
        "detail": "The local database operation failed; changes were not saved",
    }
