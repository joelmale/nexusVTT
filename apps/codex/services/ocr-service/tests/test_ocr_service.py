import pytest
from fastapi.testclient import TestClient
from src.layout_ordering import get_bbox_bounds, reorder_blocks_for_reading
from src.main import app

client = TestClient(app)


def test_get_bbox_bounds():
    bbox = [[10.0, 20.0], [50.0, 20.0], [50.0, 60.0], [10.0, 60.0]]
    min_x, min_y, max_x, max_y, cx, cy = get_bbox_bounds(bbox)
    assert min_x == 10.0
    assert max_x == 50.0
    assert min_y == 20.0
    assert max_y == 60.0
    assert cx == 30.0
    assert cy == 40.0


def test_reorder_blocks_two_columns():
    page_width = 800.0
    page_height = 1000.0

    # Simulate 2-column layout:
    # Left column items: (cx ~ 200, y = 100, 200, 300)
    # Right column items: (cx ~ 600, y = 110, 210, 310)
    blocks = [
        {"text": "Right Line 1", "bbox": [[500, 110], [700, 110], [700, 130], [500, 130]]},
        {"text": "Left Line 1", "bbox": [[100, 100], [300, 100], [300, 120], [100, 120]]},
        {"text": "Right Line 2", "bbox": [[500, 210], [700, 210], [700, 230], [500, 230]]},
        {"text": "Left Line 2", "bbox": [[100, 200], [300, 200], [300, 220], [100, 220]]},
        {"text": "Left Line 3", "bbox": [[100, 300], [300, 300], [300, 320], [100, 320]]},
        {"text": "Right Line 3", "bbox": [[500, 310], [700, 310], [700, 330], [500, 330]]},
    ]

    reordered = reorder_blocks_for_reading(blocks, page_width, page_height)
    texts = [b["text"] for b in reordered]

    # Should read all of Left column first, then all of Right column
    assert texts == [
        "Left Line 1",
        "Left Line 2",
        "Left Line 3",
        "Right Line 1",
        "Right Line 2",
        "Right Line 3",
    ]


def test_reorder_blocks_with_header_and_footer():
    page_width = 800.0
    page_height = 1000.0

    blocks = [
        # Full width header at top (y = 50)
        {"text": "CHAPTER 1: SPELLS", "bbox": [[100, 50], [700, 50], [700, 80], [100, 80]]},
        {"text": "Right 1", "bbox": [[500, 200], [700, 200], [700, 220], [500, 220]]},
        {"text": "Left 1", "bbox": [[100, 200], [300, 200], [300, 220], [100, 220]]},
        {"text": "Right 2", "bbox": [[500, 300], [700, 300], [700, 320], [500, 320]]},
        {"text": "Left 2", "bbox": [[100, 300], [300, 300], [300, 320], [100, 320]]},
        # Full width footer at bottom (y = 950)
        {"text": "Page 42", "bbox": [[100, 950], [700, 950], [700, 970], [100, 970]]},
    ]

    reordered = reorder_blocks_for_reading(blocks, page_width, page_height)
    texts = [b["text"] for b in reordered]

    assert texts[0] == "CHAPTER 1: SPELLS"
    assert texts[-1] == "Page 42"
    assert texts[1:3] == ["Left 1", "Left 2"]
    assert texts[3:5] == ["Right 1", "Right 2"]


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "gpu" in data
    assert "onnx_providers" in data


def test_metrics_endpoint():
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "codex_ocr_requests_total" in res.text


def test_embed_endpoint():
    res = client.post("/embed", json={"texts": ["Fireball 3rd level evocation", "Magic Missile 1st level"]})
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert len(data["embeddings"]) == 2
    assert data["dimension"] == 384
