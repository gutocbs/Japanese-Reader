from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.readings.models import ReadingOverrideKey


@pytest.fixture
def client():
    with TestClient(create_app(":memory:")) as test_client:
        yield test_client


def create_document(client, content="昨日、昨日"):
    response = client.post("/api/documents", json={"title": "原文", "content": content})
    assert response.status_code == 201
    return response.json()


def tokens(client, document_id):
    response = client.post(f"/api/documents/{document_id}/analysis")
    assert response.status_code == 200
    return [token for block in response.json()["blocks"] for token in block["tokens"]]


def test_put_updates_only_one_occurrence_and_delete_restores_analyzer(client):
    document = create_document(client)
    occurrences = [
        token for token in tokens(client, document["id"]) if token["surface"] == "昨日"
    ]
    target = occurrences[1]
    path = f"/api/documents/{document['id']}/reading-overrides"
    key = {
        "documentRevision": document["revision"],
        "startOffset": target["startOffset"],
        "endOffset": target["endOffset"],
    }

    saved = client.put(path, json={**key, "reading": "サクジツ"})

    assert saved.status_code == 200
    assert saved.json() == {
        "affectedOccurrenceCount": 1,
        "overrides": [{
            "documentId": document["id"],
            **key,
            "reading": "さくじつ",
        }],
    }
    changed = [
        token for token in tokens(client, document["id"]) if token["surface"] == "昨日"
    ]
    assert [(token["reading"], token["hasReadingOverride"]) for token in changed] == [
        ("きのう", False),
        ("さくじつ", True),
    ]

    removed = client.request("DELETE", path, json=key)

    assert removed.status_code == 200
    assert removed.json() == {"affectedOccurrenceCount": 1, "overrides": []}
    restored = [
        token for token in tokens(client, document["id"]) if token["surface"] == "昨日"
    ]
    assert [(token["reading"], token["hasReadingOverride"]) for token in restored] == [
        ("きのう", False),
        ("きのう", False),
    ]


def test_vocabulary_scope_updates_and_removes_only_tokens_with_the_selected_key(client):
    document = create_document(client, "昨日、昨日、今日")
    path = f"/api/documents/{document['id']}/reading-overrides"
    analyzed_tokens = tokens(client, document["id"])
    yesterday = [token for token in analyzed_tokens if token["surface"] == "昨日"]
    today = next(token for token in analyzed_tokens if token["surface"] == "今日")
    assert len(yesterday) == 2
    target = yesterday[0]
    request = {
        "documentRevision": document["revision"],
        "startOffset": target["startOffset"],
        "endOffset": target["endOffset"],
        "scope": "vocabulary",
        "vocabularyKey": target["vocabularyKey"],
    }

    saved = client.put(path, json={**request, "reading": "さくじつ"})

    assert saved.status_code == 200
    assert saved.json()["affectedOccurrenceCount"] == 2
    assert [override["startOffset"] for override in saved.json()["overrides"]] == [
        yesterday[0]["startOffset"], yesterday[1]["startOffset"],
    ]
    changed = tokens(client, document["id"])
    assert [
        (token["surface"], token["reading"], token["hasReadingOverride"])
        for token in changed if token["surface"] in {"昨日", "今日"}
    ] == [
        ("昨日", "さくじつ", True),
        ("昨日", "さくじつ", True),
        ("今日", today["reading"], False),
    ]

    removed = client.request("DELETE", path, json=request)

    assert removed.status_code == 200
    assert removed.json() == {"affectedOccurrenceCount": 2, "overrides": []}


def test_vocabulary_scope_rejects_a_key_that_is_not_the_selected_token_key(client):
    document = create_document(client, "昨日")
    token = tokens(client, document["id"])[0]
    path = f"/api/documents/{document['id']}/reading-overrides"

    response = client.put(path, json={
        "documentRevision": document["revision"],
        "startOffset": token["startOffset"],
        "endOffset": token["endOffset"],
        "scope": "vocabulary",
        "vocabularyKey": '["今日","きょう"]',
        "reading": "さくじつ",
    })

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


def test_stale_revision_and_invalid_target_return_problem_details(client):
    document = create_document(client, "猫")
    path = f"/api/documents/{document['id']}/reading-overrides"

    stale = client.put(path, json={
        "documentRevision": 0, "startOffset": 0, "endOffset": 1, "reading": "ねこ",
    })
    stale_with_invalid_reading = client.put(path, json={
        "documentRevision": 0, "startOffset": 0, "endOffset": 1, "reading": "cat",
    })
    stale_delete = client.request("DELETE", path, json={
        "documentRevision": 0, "startOffset": 0, "endOffset": 1,
    })
    invalid = client.put(path, json={
        "documentRevision": 1, "startOffset": 0, "endOffset": 2, "reading": "ねこ",
    })
    invalid_reading = client.put(path, json={
        "documentRevision": 1, "startOffset": 0, "endOffset": 1, "reading": "cat",
    })

    assert stale.status_code == 409
    assert stale.headers["content-type"] == "application/problem+json"
    assert stale.json()["status"] == 409
    assert stale_with_invalid_reading.status_code == 409
    assert stale_delete.status_code == 409
    assert invalid.status_code == 422
    assert invalid.headers["content-type"] == "application/problem+json"
    assert invalid_reading.status_code == 422


def test_content_edit_invalidates_analysis_and_overrides_but_preserves_study_state(client):
    document = create_document(client, "猫")
    document_id = document["id"]
    analysis_before = client.post(f"/api/documents/{document_id}/analysis").json()
    key = {"lemma": "猫", "reading": "ねこ"}
    assert client.put(
        f"/api/documents/{document_id}/vocabulary-selections",
        json={"selections": [key]},
    ).status_code == 204
    assert client.put(
        f"/api/documents/{document_id}/vocabulary-display-preferences",
        json={"key": key, "visibility": "hide"},
    ).status_code == 204
    assert client.put(
        f"/api/documents/{document_id}/reading-overrides",
        json={
            "documentRevision": 1,
            "startOffset": 0,
            "endOffset": 1,
            "reading": "びょう",
        },
    ).status_code == 200

    confirmation_required = client.put(
        f"/api/documents/{document_id}", json={"content": "犬"}
    )

    assert confirmation_required.status_code == 409
    assert confirmation_required.headers["content-type"] == "application/problem+json"
    assert confirmation_required.json()["type"] == (
        "urn:japanese-reader:reading-overrides-confirmation-required"
    )
    assert client.get(f"/api/documents/{document_id}").json()["content"] == "猫"
    assert client.app.state.reading_override_repository.get(
        ReadingOverrideKey(UUID(document_id), 1, 0, 1)
    ) is not None

    edited = client.put(
        f"/api/documents/{document_id}",
        json={"content": "犬", "confirmReadingOverrideRemoval": True},
    )

    assert edited.status_code == 200
    assert edited.json()["revision"] == 2
    assert client.app.state.reading_override_repository.get(
        ReadingOverrideKey(UUID(document_id), 1, 0, 1)
    ) is None
    assert client.get(
        f"/api/documents/{document_id}/vocabulary-selections"
    ).json() == {"selections": [key]}
    assert client.get(
        f"/api/documents/{document_id}/vocabulary-display-preferences"
    ).json() == {"preferences": [{"key": key, "visibility": "hide"}]}
    analysis_after = client.post(f"/api/documents/{document_id}/analysis").json()
    assert analysis_after["documentRevision"] == 2
    assert analysis_after["contentHash"] != analysis_before["contentHash"]
    assert analysis_after["blocks"][0]["tokens"][0]["surface"] == "犬"


def test_reading_override_openapi_documents_success_conflict_and_validation():
    operations = create_app(":memory:").openapi()["paths"][
        "/api/documents/{document_id}/reading-overrides"
    ]
    assert operations["put"]["operationId"] == "setReadingOverride"
    assert operations["delete"]["operationId"] == "deleteReadingOverride"
    assert operations["put"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("ReadingOverrideOperationResponse")
    assert operations["delete"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("ReadingOverrideOperationResponse")
    assert set(operations["put"]["responses"]["409"]["content"]) == {
        "application/problem+json"
    }
    assert set(operations["put"]["responses"]["422"]["content"]) == {
        "application/problem+json"
    }
