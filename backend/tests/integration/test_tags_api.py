from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_tag_catalog_is_persisted_and_rename_remove_update_all_documents():
    with TestClient(create_app(":memory:")) as client:
        created = client.post("/api/tags", json={"name": "Grammar", "color": "#0F766E"})
        assert created.status_code == 201
        assert client.get("/api/tags").json() == [{"name": "Grammar", "color": "#0F766E"}]
        document = client.post("/api/documents", json={"title": "A", "content": "文"}).json()
        client.put(f"/api/documents/{document['id']}", json={"tags": [{"name": "Grammar", "color": "#0F766E"}]})
        assert client.put("/api/tags/Grammar", json={"name": "Grammar notes"}).status_code == 204
        assert client.get(f"/api/documents/{document['id']}").json()["tags"] == [{"name": "Grammar notes", "color": "#0F766E"}]
        assert client.delete("/api/tags/Grammar%20notes").status_code == 204
        assert client.get(f"/api/documents/{document['id']}").json()["tags"] == []


def test_tag_api_rejects_non_palette_colors_and_blank_renames():
    with TestClient(create_app(":memory:")) as client:
        assert client.post("/api/tags", json={"name": "Bad", "color": "#ffffff"}).status_code == 422
        client.post("/api/tags", json={"name": "Good", "color": "#0F766E"})
        assert client.put("/api/tags/Good", json={"name": " "}).status_code == 422
