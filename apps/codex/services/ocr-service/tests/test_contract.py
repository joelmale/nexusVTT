"""
Contract tests for the endpoints doc-processor depends on.

doc-processor's embeddings service and health gate parse these responses
(apps/codex/services/doc-processor/src/services/embeddings.service.ts and
ocr-health.service.ts). Removing, renaming or reshaping them must fail CI here
rather than silently degrade search in production.
"""
from fastapi.testclient import TestClient

from src.main import app
from src.ocr_engine import FALLBACK_EMBED_MODEL, ocr_engine

client = TestClient(app)


def test_embed_contract():
    res = client.post("/embed", json={"texts": ["Fireball", "Magic Missile", "Shield"]})
    assert res.status_code == 200
    data = res.json()
    assert set(data) >= {"embeddings", "dimension", "count", "duration_ms", "model"}
    assert data["count"] == 3
    assert len(data["embeddings"]) == 3
    assert all(len(vec) == data["dimension"] for vec in data["embeddings"])
    assert isinstance(data["model"], str) and data["model"]


def test_health_contract():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert isinstance(data["embed"]["model"], str) and data["embed"]["model"]
    assert isinstance(data["embed"]["dim"], int)


def test_embed_reports_fallback_model(monkeypatch):
    class BrokenModel:
        def embed(self, texts):
            raise RuntimeError("model weights missing")

    # monkeypatch restores both attributes after the test.
    monkeypatch.setattr(ocr_engine, "embed_model_name", ocr_engine.embed_model_name)
    monkeypatch.setattr(ocr_engine, "embed_model", BrokenModel())
    res = client.post("/embed", json={"texts": ["Fireball"]})
    assert res.status_code == 200
    assert res.json()["model"] == FALLBACK_EMBED_MODEL
    assert client.get("/health").json()["embed"]["model"] == FALLBACK_EMBED_MODEL
