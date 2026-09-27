import json
from pathlib import Path
from unicodedata import name

import pytest
from fastapi.testclient import TestClient

from backend.app.documents.service import DocumentService
from backend.app.main import app
from backend.app.persistence.memory.documents import InMemoryDocumentRepository


CORPUS = json.loads(
    (Path(__file__).parents[3] / "tests/fixtures/japanese_cases.json").read_text(
        encoding="utf-8"
    )
)
CASES = CORPUS["cases"]


@pytest.fixture
def client(monkeypatch):
    repository = InMemoryDocumentRepository()
    monkeypatch.setattr(app.state, "document_repository", repository, raising=False)
    monkeypatch.setattr(app.state, "document_service", DocumentService(repository))
    with TestClient(app) as instance:
        yield instance


def _contains_kanji(text: str) -> bool:
    return any(
        char in "々〇〆"
        or name(char, "").startswith(("CJK UNIFIED IDEOGRAPH-", "CJK COMPATIBILITY IDEOGRAPH-"))
        for char in text
    )


def _analyze(client: TestClient, text: str) -> dict:
    created = client.post("/api/documents", json={"title": "linguistic regression", "content": text})
    assert created.status_code == 201
    response = client.post(f"/api/documents/{created.json()['id']}/analysis")
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_regression_corpus_preserves_source_offsets_and_ruby_contract(client, case):
    text = case["text"]
    if not text.strip():
        pytest.skip("The empty-document problem response is covered by the analysis API suite.")

    analysis = _analyze(client, text)
    assert CORPUS["name"] == "japanese-linguistic-regressions"
    assert CORPUS["version"] == 1
    assert analysis["metadata"] == CORPUS["pinnedAnalyzer"]
    if "expectedBlockRanges" in case:
        assert [
            [block["startOffset"], block["endOffset"]] for block in analysis["blocks"]
        ] == case["expectedBlockRanges"]

    tokens = [token for block in analysis["blocks"] for token in block["tokens"]]
    cursor = 0
    reconstructed = ""
    for token in tokens:
        start = token["startOffset"]
        end = token["endOffset"]
        assert 0 <= cursor <= start < end <= len(text)
        assert text[start:end] == token["surface"]
        assert "".join(segment["text"] for segment in token["furiganaSegments"]) == token["surface"]
        if _contains_kanji(token["surface"]) and token["reading"]:
            assert any(segment["reading"] for segment in token["furiganaSegments"])
        reconstructed += text[cursor:start] + token["surface"]
        cursor = end
    assert reconstructed + text[cursor:] == text

    for expected in case.get("wholeTokenRuby", []):
        token = next(token for token in tokens if token["surface"] == expected["surface"])
        assert token["reading"] == expected["reading"]
        assert token["furiganaSegments"] == [{"text": expected["surface"], "reading": expected["reading"]}]
