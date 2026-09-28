from dataclasses import replace
from datetime import datetime
from hashlib import sha256

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app, create_app


@pytest.fixture
def client():
    with TestClient(create_app(":memory:")) as client:
        yield client


def create_document(client, content):
    response = client.post("/api/documents", json={"title": "原文", "content": content})
    assert response.status_code == 201
    return response.json()["id"]


def test_analysis_endpoint_returns_camel_case_tokens_segments_and_metadata(client):
    content = "A𠮷野家\n昨日、食べた。"
    document_id = create_document(client, content)
    response = client.post(f"/api/documents/{document_id}/analysis")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"documentId", "documentRevision", "contentHash", "metadata", "analysisOptions", "blocks", "diagnostics"}
    assert body["documentId"] == document_id
    assert body["documentRevision"] == 1
    assert body["contentHash"] == sha256(content.encode("utf-8")).hexdigest()
    assert body["metadata"] == {
        "analyzerName": "SudachiPy", "analyzerVersion": "0.6.11",
        "dictionaryName": "SudachiDict-core", "dictionaryVersion": "20250825", "splitMode": "B",
    }
    assert body["analysisOptions"] == {"splitMode": "B"}
    assert [(block["startOffset"], block["endOffset"]) for block in body["blocks"]] == [(0, 5), (5, 12)]
    tokens = [token for block in body["blocks"] for token in block["tokens"]]
    non_bmp = tokens[1]
    assert (non_bmp["surface"], non_bmp["startOffset"], non_bmp["endOffset"]) == ("𠮷", 1, 2)
    food = next(token for token in tokens if token["surface"] == "食べ")
    assert food == {
        "startOffset": 8, "endOffset": 10, "surface": "食べ", "lemma": "食べる",
        "reading": "たべ", "dictionaryReading": "たべる",
        "partOfSpeech": ["動詞", "一般", "*", "*", "下一段-バ行", "連用形-一般"],
        "isOutOfVocabulary": False, "isLexical": True, "vocabularyKey": '["食べる","たべる"]',
        "furiganaSegments": [{"text": "食", "reading": "た"}, {"text": "べ", "reading": None}],
        "hasReadingOverride": False,
    }
    cursor = 0
    reconstructed = ""
    for token in tokens:
        assert "".join(segment["text"] for segment in token["furiganaSegments"]) == token["surface"]
        assert content[token["startOffset"]:token["endOffset"]] == token["surface"]
        reconstructed += content[cursor:token["startOffset"]] + token["surface"]
        cursor = token["endOffset"]
    assert reconstructed + content[cursor:] == content
    assert client.post(f"/api/documents/{document_id}/analysis").json() == body


def test_missing_document_analysis_returns_404_problem(client):
    response = client.post("/api/documents/00000000-0000-0000-0000-000000000001/analysis")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["status"] == 404
    assert "was not found" in response.json()["detail"]


def test_successful_analysis_marks_the_document_as_read_on_the_backend(client):
    document_id = create_document(client, "猫")

    response = client.post(f"/api/documents/{document_id}/analysis")

    assert response.status_code == 200
    stored = client.get(f"/api/documents/{document_id}").json()
    last_read_at = datetime.fromisoformat(stored["lastReadAt"].replace("Z", "+00:00"))
    assert last_read_at.utcoffset().total_seconds() == 0


@pytest.mark.parametrize("content", ["", " \r\n\t\u3000"])
def test_empty_analysis_returns_422_without_invoking_morphology(client, monkeypatch, content):
    def forbidden(*args, **kwargs):
        raise AssertionError("Empty document must not invoke morphology")

    monkeypatch.setattr(client.app.state.morphological_analyzer, "analyze", forbidden)
    document_id = create_document(client, content)
    response = client.post(f"/api/documents/{document_id}/analysis")
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["status"] == 422


def test_edit_during_analysis_returns_409_problem_and_next_request_uses_new_revision(client, monkeypatch):
    document_id = create_document(client, "猫")
    original = client.app.state.morphological_analyzer.analyze

    def changing_analyze(text, base_offset=0):
        result = original(text, base_offset)
        assert client.put(f"/api/documents/{document_id}", json={"content": "犬"}).status_code == 200
        return result

    monkeypatch.setattr(client.app.state.morphological_analyzer, "analyze", changing_analyze)
    response = client.post(f"/api/documents/{document_id}/analysis")
    assert response.status_code == 409
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["status"] == 409
    monkeypatch.setattr(client.app.state.morphological_analyzer, "analyze", original)
    fresh = client.post(f"/api/documents/{document_id}/analysis")
    assert fresh.status_code == 200
    assert fresh.json()["documentRevision"] == 2
    assert fresh.json()["blocks"][0]["tokens"][0]["surface"] == "犬"


def test_derived_diagnostics_are_serialized_with_code_point_ranges(client, monkeypatch):
    document_id = create_document(client, "猫 食べた")
    original = client.app.state.morphological_analyzer.analyze

    def missing_and_irregular_reading(text, base_offset=0):
        return tuple(
            replace(token, reading=None) if token.raw_surface == "猫"
            else replace(token, reading="くい") if token.raw_surface == "食べ"
            else token
            for token in original(text, base_offset)
        )

    monkeypatch.setattr(
        client.app.state.morphological_analyzer,
        "analyze",
        missing_and_irregular_reading,
    )
    response = client.post(f"/api/documents/{document_id}/analysis")
    assert response.status_code == 200
    assert response.json()["diagnostics"] == [
        {"code": "missing_reading", "startOffset": 0, "endOffset": 1},
        {"code": "furigana_fallback", "startOffset": 2, "endOffset": 4},
    ]


def test_analysis_openapi_documents_success_and_problem_payloads():
    responses = app.openapi()["paths"]["/api/documents/{document_id}/analysis"]["post"]["responses"]
    assert responses["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/DocumentAnalysisResponse",
    }
    for status in ("404", "409", "422"):
        assert set(responses[status]["content"]) == {"application/problem+json"}
