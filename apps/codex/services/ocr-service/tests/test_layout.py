"""
/layout/s3 and layout_engine with Marker mocked. The fakes below mirror the
marker-pdf 1.10.2 API that layout_engine.py uses.
"""
import io
import json
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src import layout_engine as engine_module
from src.layout_engine import LayoutUnavailable, layout_engine, mark_sidebars, split_markdown, split_pages
from src.main import app
from src.ocr_engine import ocr_engine

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "marker_pages_12_13.json").read_text(encoding="utf-8"))
client = TestClient(app)


def test_split_markdown_uses_marker_page_separator():
    pages = split_markdown(FIXTURE["markdown"])
    assert sorted(pages) == [11, 12]
    assert pages[11].startswith("## Gorgon")
    assert pages[12] == "# Sidebar: Petrification\n\nA creature turned to stone is petrified."


def test_split_pages_maps_blocks_and_normalizes_bboxes():
    pages = split_pages(FIXTURE["markdown"], FIXTURE["json"], {11: "pdftext", 12: "surya"})
    assert [p["pageNumber"] for p in pages] == [12, 13]

    first = pages[0]
    assert first["widthPt"] == 612 and first["heightPt"] == 792
    assert [(b["id"], b["class"], b["markerType"]) for b in first["blocks"]] == [
        ("p12-b0", "furniture", "PageHeader"),
        ("p12-b1", "heading", "SectionHeader"),
        ("p12-b2", "body", "Text"),
        ("p12-b3", "art", "Picture"),
        ("p12-b4", "furniture", "PageFooter"),
    ]
    # Art and furniture carry no text.
    assert "markdown" not in first["blocks"][0] and "markdown" not in first["blocks"][3]
    assert first["blocks"][2]["markdown"] == "**Armor Class** 19 (natural armor)"
    assert first["blocks"][1]["bbox"] == [round(36 / 612, 4), round(60 / 792, 4), round(300 / 612, 4), round(80 / 792, 4)]
    assert first["quality"]["textSource"] == {"embedded": 1.0, "ocr": 0.0}

    second = pages[1]
    # Page bbox origin (10, 20) is subtracted before scaling.
    assert second["blocks"][0]["bbox"] == [round(36 / 612, 4), round(60 / 792, 4), round(306 / 612, 4), round(80 / 792, 4)]
    assert second["blocks"][1]["class"] == "table"
    assert second["blocks"][1]["bbox"][2:] == [1.0, 1.0]
    assert second["quality"]["textSource"]["ocr"] == 1.0


def test_mark_sidebars_detects_tinted_narrow_block():
    image = Image.new("RGB", (1000, 1000), (255, 255, 255))
    image.paste((230, 200, 150), (520, 300, 900, 600))  # parchment-tinted box
    blocks = [
        {"id": "a", "class": "body", "bbox": [0.52, 0.3, 0.9, 0.6]},
        {"id": "b", "class": "body", "bbox": [0.05, 0.3, 0.45, 0.6]},
        {"id": "c", "class": "heading", "bbox": [0.52, 0.3, 0.9, 0.6]},
    ]
    mark_sidebars(image, blocks)
    assert [b["class"] for b in blocks] == ["sidebar", "body", "heading"]


def _install_fake_marker(monkeypatch, calls):
    """Registers fake marker.* modules with the 1.10.2 names layout_engine imports."""

    class FakePage:
        def __init__(self, page_id, method):
            self.page_id = page_id
            self.text_extraction_method = method

        def get_image(self, highres=False):
            calls.setdefault("get_image", []).append(highres)
            return Image.new("RGB", (1224, 1584), (255, 255, 255))

    class FakeDocument:
        pages = [FakePage(11, "pdftext"), FakePage(12, "surya")]

    class ConfigParser:
        def __init__(self, cli_options):
            calls["cli_options"] = cli_options

        def generate_config_dict(self):
            return {"page_range": [11, 12], "paginate_output": True, "extract_images": False}

        def get_processors(self):
            return None

    class PdfConverter:
        def __init__(self, config=None, artifact_dict=None, processor_list=None):
            calls["converter"] = {"config": config, "artifact_dict": artifact_dict, "processor_list": processor_list}

        def build_document(self, path):
            calls["build_document"] = path
            return FakeDocument()

    class MarkdownRenderer:
        def __init__(self, config):
            calls["markdown_config"] = config

        def __call__(self, document):
            return types.SimpleNamespace(markdown=FIXTURE["markdown"])

    class JSONRenderer:
        def __init__(self, config):
            pass

        def __call__(self, document):
            return types.SimpleNamespace(model_dump=lambda: FIXTURE["json"])

    modules = {
        "marker": types.ModuleType("marker"),
        "marker.config": types.ModuleType("marker.config"),
        "marker.config.parser": types.SimpleNamespace(ConfigParser=ConfigParser),
        "marker.converters": types.ModuleType("marker.converters"),
        "marker.converters.pdf": types.SimpleNamespace(PdfConverter=PdfConverter),
        "marker.renderers": types.ModuleType("marker.renderers"),
        "marker.renderers.markdown": types.SimpleNamespace(MarkdownRenderer=MarkdownRenderer),
        "marker.renderers.json": types.SimpleNamespace(JSONRenderer=JSONRenderer),
    }
    for name, module in modules.items():
        monkeypatch.setitem(sys.modules, name, module)


def test_convert_range_drives_marker_with_zero_based_page_range(monkeypatch):
    calls = {}
    _install_fake_marker(monkeypatch, calls)
    monkeypatch.setattr(layout_engine, "_artifacts", {"layout_model": "fake"})

    pages, images = layout_engine.convert_range("/tmp/book.pdf", 12, 13)

    assert calls["cli_options"] == {"page_range": "11-12", "paginate_output": True, "disable_image_extraction": True}
    assert calls["converter"]["artifact_dict"] == {"layout_model": "fake"}
    assert calls["converter"]["processor_list"] is None
    assert calls["build_document"] == "/tmp/book.pdf"
    assert calls["get_image"] == [True, True]
    assert [p["pageNumber"] for p in pages] == [12, 13]
    assert sorted(images) == [12, 13]


def test_load_raises_when_marker_missing(monkeypatch):
    monkeypatch.setattr(layout_engine, "_artifacts", None)
    monkeypatch.setattr(engine_module.LayoutEngine, "installed", staticmethod(lambda: False))
    with pytest.raises(LayoutUnavailable):
        layout_engine.load()


class FakeS3:
    def __init__(self):
        self.puts = []

    def put_object(self, **kwargs):
        self.puts.append(kwargs)


@pytest.fixture
def fake_layout(monkeypatch):
    s3 = FakeS3()
    seen = {}

    def convert_range(path, start, end, lexicon):
        seen.update(path=path, start=start, end=end, lexicon=lexicon)
        pages = split_pages(FIXTURE["markdown"], FIXTURE["json"], {11: "pdftext", 12: "surya"}, lexicon)
        images = {12: Image.new("RGB", (2448, 3168), "white"), 13: Image.new("RGB", (2448, 3168), "white")}
        return pages, images

    monkeypatch.setattr(ocr_engine, "fetch_s3_bytes", lambda bucket, key: b"%PDF-1.7")
    monkeypatch.setattr(ocr_engine, "s3_client", s3)
    monkeypatch.setattr(layout_engine, "convert_range", convert_range)
    return s3, seen


def test_layout_s3_returns_pages_and_uploads_previews(fake_layout):
    s3, seen = fake_layout
    res = client.post("/layout/s3", json={
        "bucket": "documents",
        "key": "uploads/book.pdf",
        "pageStart": 12,
        "pageEnd": 13,
        "renderPreviews": True,
        "previewPrefix": "page-previews/doc-1/",
        "lexicon": ["Zyzzlethorp"],
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["engine"].startswith("marker@")
    assert [p["pageNumber"] for p in data["pages"]] == [12, 13]
    heading = data["pages"][0]["blocks"][1]
    assert {k: heading[k] for k in ("id", "class", "markerType", "markdown")} == {
        "id": "p12-b1", "class": "heading", "markerType": "SectionHeader", "markdown": "## Gorgon",
    }
    assert [p["previewKey"] for p in data["pages"]] == ["page-previews/doc-1/page-12.webp", "page-previews/doc-1/page-13.webp"]
    assert [put["ContentType"] for put in s3.puts] == ["image/webp", "image/webp"]
    assert Image.open(io.BytesIO(s3.puts[0]["Body"])).width == 1200
    assert seen["start"] == 12 and seen["end"] == 13 and seen["lexicon"] == ["Zyzzlethorp"]
    assert not Path(seen["path"]).exists()  # temp PDF removed


def test_layout_s3_without_previews(fake_layout):
    s3, _ = fake_layout
    res = client.post("/layout/s3", json={"bucket": "b", "key": "k.pdf", "pageStart": 12, "pageEnd": 13})
    assert res.status_code == 200
    assert all(p["previewKey"] is None for p in res.json()["pages"])
    assert s3.puts == []


def test_layout_s3_rejects_inverted_range():
    res = client.post("/layout/s3", json={"bucket": "b", "key": "k.pdf", "pageStart": 5, "pageEnd": 4})
    assert res.status_code == 400


def test_layout_s3_returns_503_when_marker_unavailable(monkeypatch):
    def unavailable(*args):
        raise LayoutUnavailable("marker-pdf is not installed in this image")

    monkeypatch.setattr(ocr_engine, "fetch_s3_bytes", lambda bucket, key: b"%PDF")
    monkeypatch.setattr(layout_engine, "convert_range", unavailable)
    res = client.post("/layout/s3", json={"bucket": "b", "key": "k.pdf", "pageStart": 1, "pageEnd": 1})
    assert res.status_code == 503


def test_health_reports_layout_engine():
    layout = client.get("/health").json()["layout"]
    assert layout["engine"] == "marker"
    assert layout["version"]
    assert isinstance(layout["modelsLoaded"], bool)
    assert "device" in layout


def test_layout_unload_releases_models(monkeypatch):
    monkeypatch.setattr(layout_engine, "_artifacts", {"layout_model": "fake"})
    res = client.post("/layout/unload")
    assert res.status_code == 200
    assert res.json()["unloaded"] is True
    assert res.json()["layout"]["modelsLoaded"] is False
    assert client.post("/layout/unload").json()["unloaded"] is False
