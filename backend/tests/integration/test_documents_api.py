import asyncio
from dataclasses import replace
from datetime import datetime, timezone
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.documents.models import CreateDocument
from backend.app.documents.service import DocumentService
from backend.app.main import app
from backend.app.persistence.memory.documents import InMemoryDocumentRepository


@pytest.fixture
def client():
    previous_service = app.state.document_service
    app.state.document_service = DocumentService(InMemoryDocumentRepository())
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.state.document_service = previous_service


def test_crud_preserves_exact_unicode_and_camel_case(client):
    async def exercise():
        async with client:
            content = "𠮷野家\n日本語  text\r\n😀"
            response = await client.post("/api/documents", json={"title": "原文", "content": content})
            assert response.status_code == 201
            document = response.json()
            assert set(document) == {
                "id", "title", "content", "description", "source", "tags", "revision",
                "createdAt", "updatedAt", "lastReadAt",
            }
            assert document["content"] == content
            assert document["description"] is None
            assert document["source"] == "Local"
            assert document["tags"] == []
            assert document["revision"] == 1
            assert document["lastReadAt"] is None
            UUID(document["id"])
            assert datetime.fromisoformat(document["createdAt"].replace("Z", "+00:00")).utcoffset().total_seconds() == 0
            path = f"/api/documents/{document['id']}"
            assert (await client.get(path)).json() == document
            renamed = await client.put(path, json={"title": "新題"})
            assert renamed.status_code == 200
            assert renamed.json()["title"] == "新題"
            assert renamed.json()["content"] == content
            assert renamed.json()["revision"] == 1
            edited = await client.put(path, json={"content": ""})
            assert edited.json()["content"] == ""
            assert edited.json()["revision"] == 2
            assert (await client.get("/api/documents")).json() == [edited.json()]
            deleted = await client.delete(path)
            assert deleted.status_code == 204
            assert deleted.content == b""
            assert (await client.get("/api/documents")).json() == []
    asyncio.run(exercise())


def test_metadata_update_persists_tag_names_and_colors_without_changing_content_revision(client):
    async def exercise():
        async with client:
            created = (
                await client.post(
                    "/api/documents", json={"title": "原文", "content": "日本語"}
                )
            ).json()
            path = f"/api/documents/{created['id']}"
            response = await client.put(
                path,
                json={
                    "description": "JLPT reading notes",
                    "tags": [
                        {"name": "Grammar", "color": "#7C3AED"},
                        {"name": "News", "color": "#0F766E"},
                    ],
                },
            )

            assert response.status_code == 200
            updated = response.json()
            assert updated["description"] == "JLPT reading notes"
            assert updated["tags"] == [
                {"name": "Grammar", "color": "#7C3AED"},
                {"name": "News", "color": "#0F766E"},
            ]
            assert updated["revision"] == created["revision"]
            assert updated["content"] == created["content"]
            assert updated["createdAt"] == created["createdAt"]
            assert updated["updatedAt"] != created["updatedAt"]
            assert (await client.get(path)).json() == updated

            cleared = await client.put(path, json={"description": None, "tags": []})
            assert cleared.status_code == 200
            assert cleared.json()["description"] is None
            assert cleared.json()["tags"] == []
            assert cleared.json()["revision"] == created["revision"]

    asyncio.run(exercise())


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_missing_document_returns_problem_details(client, method):
    async def exercise():
        async with client:
            kwargs = {"json": {"title": "new"}} if method == "put" else {}
            response = await client.request(method, "/api/documents/00000000-0000-0000-0000-000000000001", **kwargs)
            assert response.status_code == 404
            assert response.headers["content-type"] == "application/problem+json"
            assert response.json() == {
                "type": "about:blank", "title": "Not Found", "status": 404,
                "detail": "Document 00000000-0000-0000-0000-000000000001 was not found",
            }
    asyncio.run(exercise())


def test_list_orders_last_read_descending_with_unread_last(client):
    repository = InMemoryDocumentRepository()
    unread = repository.create(CreateDocument("unread", ""))
    older = repository.create(CreateDocument("older", ""))
    newer = repository.create(CreateDocument("newer", ""))
    documents = (
        unread,
        replace(older, last_read_at=datetime(2026, 9, 25, tzinfo=timezone.utc)),
        replace(newer, last_read_at=datetime(2026, 9, 26, tzinfo=timezone.utc)),
    )

    class ListingRepository:
        def list(self):
            return documents

    app.state.document_service = DocumentService(ListingRepository())

    async def exercise():
        async with client:
            response = await client.get("/api/documents")
            assert response.status_code == 200
            assert [item["title"] for item in response.json()] == ["newer", "older", "unread"]
    asyncio.run(exercise())


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"title": None},
        {"content": None},
        {"confirmReadingOverrideRemoval": True},
        {"title": "new", "confirmReadingOverrideRemoval": None},
        {"tags": None},
        {"tags": [{"name": "", "color": "#7C3AED"}]},
        {"tags": [{"name": "Grammar", "color": " "}]},
        {
            "tags": [
                {"name": "Grammar", "color": "#7C3AED"},
                {"name": "grammar", "color": "#0F766E"},
            ]
        },
        {"createdAt": "2026-09-29T00:00:00Z"},
        {"updatedAt": "2026-09-29T00:00:00Z"},
        {"unknown": "value"},
    ],
)
def test_invalid_update_returns_validation_problem(client, payload):
    async def exercise():
        async with client:
            response = await client.put("/api/documents/00000000-0000-0000-0000-000000000001", json=payload)
            assert response.status_code == 422
            assert response.headers["content-type"] == "application/problem+json"
            assert response.json()["status"] == 422
            assert response.json()["title"] == "Unprocessable Entity"
            assert response.json()["detail"]
    asyncio.run(exercise())


def test_openapi_matches_update_and_problem_payloads():
    schema = app.openapi()
    update = schema["components"]["schemas"]["UpdateDocumentRequest"]
    assert update["minProperties"] == 1
    assert update["not"] == {
        "maxProperties": 1,
        "required": ["confirmReadingOverrideRemoval"],
    }
    for field in ("title", "content"):
        assert update["properties"][field]["type"] == "string"
        assert "default" not in update["properties"][field]
    assert update["properties"]["description"]["anyOf"] == [
        {"type": "string"}, {"type": "null"}
    ]
    assert update["properties"]["tags"]["items"] == {
        "$ref": "#/components/schemas/DocumentTagModel"
    }
    assert "default" not in update["properties"]["description"]
    assert "default" not in update["properties"]["tags"]
    assert update["properties"]["confirmReadingOverrideRemoval"]["type"] == "boolean"
    assert "default" not in update["properties"]["confirmReadingOverrideRemoval"]
    for operation in ("get", "put", "delete"):
        responses = schema["paths"]["/api/documents/{document_id}"][operation]["responses"]
        assert set(responses["404"]["content"]) == {"application/problem+json"}
        assert set(responses["422"]["content"]) == {"application/problem+json"}
    assert set(
        schema["paths"]["/api/documents/{document_id}"]["put"]["responses"]["409"]["content"]
    ) == {"application/problem+json"}
    response = schema["components"]["schemas"]["DocumentResponse"]
    assert {"description", "tags", "createdAt", "updatedAt"} <= set(response["required"])
    assert response["properties"]["source"] == {
        "type": "string",
        "title": "Source",
        "default": "Local",
    }
