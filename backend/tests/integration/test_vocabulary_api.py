import pytest
from fastapi.testclient import TestClient

from backend.app.documents.service import DocumentService
from backend.app.main import app
from backend.app.persistence.memory.documents import InMemoryDocumentRepository
from backend.app.persistence.memory.vocabulary import InMemoryVocabularySelectionRepository


CAT = {"lemma": "猫", "reading": "ねこ"}
DOG = {"lemma": "犬", "reading": "いぬ"}


@pytest.fixture
def client(monkeypatch):
    documents = InMemoryDocumentRepository()
    monkeypatch.setattr(app.state, "document_repository", documents, raising=False)
    monkeypatch.setattr(app.state, "document_service", DocumentService(documents))
    monkeypatch.setattr(
        app.state,
        "vocabulary_repository",
        InMemoryVocabularySelectionRepository(),
        raising=False,
    )
    with TestClient(app) as client:
        yield client


def create_document(client, content="猫 犬 猫"):
    response = client.post("/api/documents", json={"title": "語彙", "content": content})
    assert response.status_code == 201
    return response.json()["id"]


def test_put_has_set_semantics_and_get_orders_by_first_current_occurrence(client):
    document_id = create_document(client)
    path = f"/api/documents/{document_id}/vocabulary-selections"

    response = client.put(path, json={"selections": [DOG, CAT, DOG]})

    assert response.status_code == 204
    assert client.get(path).json() == {"selections": [CAT, DOG]}
    assert client.put(path, json={"selections": [DOG, CAT]}).status_code == 204
    assert client.get(path).json() == {"selections": [CAT, DOG]}


def test_selections_are_document_scoped(client):
    first = create_document(client, "猫")
    second = create_document(client, "犬")
    first_path = f"/api/documents/{first}/vocabulary-selections"
    second_path = f"/api/documents/{second}/vocabulary-selections"

    assert client.put(first_path, json={"selections": [CAT]}).status_code == 204
    assert client.put(second_path, json={"selections": [DOG]}).status_code == 204

    assert client.get(first_path).json() == {"selections": [CAT]}
    assert client.get(second_path).json() == {"selections": [DOG]}


def test_new_document_revision_preserves_keys_and_reorders_current_occurrences(client):
    document_id = create_document(client)
    path = f"/api/documents/{document_id}/vocabulary-selections"
    assert client.put(path, json={"selections": [CAT, DOG]}).status_code == 204

    update = client.put(
        f"/api/documents/{document_id}",
        json={"content": "犬だけになった。"},
    )

    assert update.status_code == 200
    assert update.json()["revision"] == 2
    assert client.get(path).json() == {"selections": [DOG, CAT]}


def test_missing_document_and_invalid_keys_use_problem_details(client):
    missing = "/api/documents/00000000-0000-0000-0000-000000000099/vocabulary-selections"
    get_response = client.get(missing)
    put_response = client.put(missing, json={"selections": [CAT]})
    invalid_response = client.put(missing, json={"selections": [{"lemma": "猫"}]})

    assert get_response.status_code == 404
    assert get_response.headers["content-type"] == "application/problem+json"
    assert put_response.status_code == 404
    assert invalid_response.status_code == 422
    assert invalid_response.headers["content-type"] == "application/problem+json"
