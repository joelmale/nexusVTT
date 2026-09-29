"""
Marker (Surya) layout engine for ingestion v2.

This is the only module that imports Marker, so an upgrade touches one file.
The calls below were checked against the marker-pdf 1.10.2 source (the version
pinned in requirements-layout.txt): PdfConverter(config, artifact_dict,
processor_list), ConfigParser.generate_config_dict() parsing "page_range" as
0-based "a-b", MarkdownRenderer's paginated separator "\\n\\n{page_id}" + "-" * 48,
JSONRenderer's Page -> block tree (block_type, bbox in page points, html),
BlockTypes names, PageGroup.page_id (absolute 0-based index),
PageGroup.text_extraction_method ("pdftext" | "surya") and
PageGroup.get_image(highres=True). Re-verify all of them when changing the pin.

Marker is imported lazily: the service (and its tests) run without it, and
/layout/s3 answers 503 until it is installed.
"""
import importlib.metadata
import importlib.util
import os
import re
import threading
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .quality import page_quality

MARKER_VERSION = "1.10.2"  # keep in sync with requirements-layout.txt

PAGE_SEPARATOR = re.compile(r"\n*\{(\d+)\}-{48}\n*")
BLOCK_ID_PAGE = re.compile(r"/page/(\d+)/")

# Marker BlockTypes -> LayoutBlockClass. Anything unlisted is body text.
BLOCK_CLASS = {
    "PageHeader": "furniture",
    "PageFooter": "furniture",
    "Picture": "art",
    "Figure": "art",
    "PictureGroup": "art",
    "FigureGroup": "art",
    "Table": "table",
    "TableGroup": "table",
    "TableOfContents": "table",
    "SectionHeader": "heading",
}
TEXT_EXCLUDED = {"art", "furniture"}


class LayoutUnavailable(RuntimeError):
    """Marker is not installed or its models failed to load."""


def _as_dict(value: Any) -> Any:
    return value.model_dump() if hasattr(value, "model_dump") else value


def _html_to_markdown(html: str) -> str:
    try:
        from markdownify import markdownify

        return markdownify(html or "", heading_style="ATX", bullets="-").strip()
    except ImportError:  # pragma: no cover - markdownify is in requirements.txt
        return re.sub(r"<[^>]+>", " ", html or "").strip()


def _normalize_bbox(bbox: List[float], page_bbox: List[float]) -> List[float]:
    """Block bbox in page points -> 0..1 relative to the page (Marker fits blocks to the page polygon)."""
    def clamp(value: float) -> float:
        return round(min(1.0, max(0.0, value)), 4)

    px0, py0, px1, py1 = page_bbox
    width, height = (px1 - px0) or 1.0, (py1 - py0) or 1.0
    x0, y0, x1, y1 = bbox
    return [
        clamp((x0 - px0) / width),
        clamp((y0 - py0) / height),
        clamp((x1 - px0) / width),
        clamp((y1 - py0) / height),
    ]


def split_markdown(markdown: str) -> Dict[int, str]:
    """Paginated Marker markdown -> {0-based page_id: page markdown}."""
    # TODO(verify-marker): confirm Marker still emits a separator for a page
    # that renders no text (blank or art-only). A missing separator leaves that
    # page's markdown empty here, which is the intended result either way.
    parts = PAGE_SEPARATOR.split(markdown)
    # parts = [preamble, id, text, id, text, ...]
    return {int(parts[i]): parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}


def split_pages(
    markdown: str,
    json_output: Any,
    text_methods: Optional[Dict[int, str]] = None,
    extra_lexicon: Optional[Iterable[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Marker's paginated markdown + JSON tree -> per-page LayoutPage dicts
    (pageNumber is 1-based). Blocks keep Marker's reading order; bboxes are
    normalized by the page size.
    """
    page_markdown = split_markdown(markdown)
    lexicon = list(extra_lexicon or [])
    pages = []

    for page in _as_dict(json_output)["children"]:
        match = BLOCK_ID_PAGE.search(page["id"])
        page_id = int(match.group(1)) if match else len(pages)
        page_number = page_id + 1
        x0, y0, x1, y1 = page["bbox"]
        width, height = (x1 - x0) or 1.0, (y1 - y0) or 1.0

        blocks = []
        for index, child in enumerate(page.get("children") or []):
            block_class = BLOCK_CLASS.get(child["block_type"], "body")
            block = {
                "id": f"p{page_number}-b{index}",
                "class": block_class,
                "markerType": child["block_type"],
                "bbox": _normalize_bbox(child["bbox"], page["bbox"]),
            }
            if block_class not in TEXT_EXCLUDED:
                block["markdown"] = _html_to_markdown(child.get("html", ""))
            blocks.append(block)

        text = page_markdown.get(page_id, "")
        pages.append({
            "pageNumber": page_number,
            "markdown": text,
            "blocks": blocks,
            "widthPt": round(width, 2),
            "heightPt": round(height, 2),
            "quality": page_quality(text, (text_methods or {}).get(page_id), lexicon),
        })

    return pages


def mark_sidebars(image: Any, blocks: List[Dict[str, Any]], threshold: float = 18.0) -> None:
    """
    Heuristic (plan: "Live Proof caveats"): a body block narrower than half the
    page whose edge band is tinted differently from the page margin is a
    sidebar. Marker has no sidebar class; the UI labels this "heuristic".
    """
    # TODO(verify-marker): calibrate `threshold` and the width/height cut-offs on
    # gold-set sidebar pages; this assumes get_image(highres=True) has the same
    # aspect ratio as the page bbox (it is rendered from that page).
    if image is None:
        return
    from PIL import ImageStat

    width, height = image.size
    margin = image.crop((0, 0, width, max(1, int(height * 0.02))))
    page_bg = ImageStat.Stat(margin.convert("RGB")).median

    for block in blocks:
        if block["class"] != "body":
            continue
        bx0, by0, bx1, by1 = block["bbox"]
        if (bx1 - bx0) > 0.5 or (by1 - by0) < 0.05:
            continue
        left, top, right, bottom = int(bx0 * width), int(by0 * height), int(bx1 * width), int(by1 * height)
        band = max(2, int((right - left) * 0.03))
        edge = image.crop((left, top, min(width, left + band), bottom)).convert("RGB")
        if edge.size[0] == 0 or edge.size[1] == 0:
            continue
        tint = ImageStat.Stat(edge).median
        distance = sum((a - b) ** 2 for a, b in zip(tint, page_bg)) ** 0.5
        if distance > threshold:
            block["class"] = "sidebar"


class LayoutEngine:
    def __init__(self):
        self._artifacts = None
        # One conversion at a time: Surya shares the GPU with the VLM (plan: GPU scheduling).
        self._lock = threading.Lock()
        self.device: Optional[str] = None
        self.load_error: Optional[str] = None

    @staticmethod
    def installed() -> bool:
        return importlib.util.find_spec("marker") is not None

    @staticmethod
    def version() -> Optional[str]:
        try:
            return importlib.metadata.version("marker-pdf")
        except importlib.metadata.PackageNotFoundError:
            return None

    @property
    def models_loaded(self) -> bool:
        return self._artifacts is not None

    def load(self) -> None:
        """Load Surya models once (GPU if available). Safe to call repeatedly."""
        if self._artifacts is not None:
            return
        if not self.installed():
            raise LayoutUnavailable("marker-pdf is not installed in this image")
        try:
            import torch
            from marker.models import create_model_dict

            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self._artifacts = create_model_dict()
            self.load_error = None
        except Exception as error:  # surface in /health instead of crashing startup
            self.load_error = str(error)
            raise LayoutUnavailable(f"Marker models failed to load: {error}") from error

    def health(self) -> Dict[str, Any]:
        return {
            "engine": "marker",
            "version": self.version() or MARKER_VERSION,
            "installed": self.installed(),
            "modelsLoaded": self.models_loaded,
            "device": self.device or "unloaded",
            "error": self.load_error,
        }

    def convert_range(
        self,
        pdf_path: str,
        page_start: int,
        page_end: int,
        extra_lexicon: Optional[Iterable[str]] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[int, Any]]:
        """
        page_start/page_end are 1-based and inclusive. Returns the per-page
        dicts and {pageNumber: PIL image at Marker's high-res DPI} for previews.
        """
        with self._lock:
            return self._convert_range(pdf_path, page_start, page_end, extra_lexicon)

    def _convert_range(self, pdf_path, page_start, page_end, extra_lexicon):
        self.load()
        from marker.config.parser import ConfigParser
        from marker.converters.pdf import PdfConverter
        from marker.renderers.json import JSONRenderer
        from marker.renderers.markdown import MarkdownRenderer

        parser = ConfigParser({
            "page_range": f"{page_start - 1}-{page_end - 1}",  # Marker is 0-based
            "paginate_output": True,
            "disable_image_extraction": True,
        })
        config = parser.generate_config_dict()
        converter = PdfConverter(
            config=config,
            artifact_dict=self._artifacts,
            processor_list=parser.get_processors(),
        )
        document = converter.build_document(pdf_path)  # layout + OCR run once
        markdown = MarkdownRenderer(config)(document).markdown
        blocks = JSONRenderer(config)(document)

        text_methods = {page.page_id: page.text_extraction_method for page in document.pages}
        images = {page.page_id + 1: page.get_image(highres=True) for page in document.pages}
        pages = split_pages(markdown, blocks, text_methods, extra_lexicon)
        for page in pages:
            mark_sidebars(images.get(page["pageNumber"]), page["blocks"])
        return pages, images


def render_preview(image: Any, width: int = int(os.getenv("LAYOUT_PREVIEW_WIDTH", "1200"))) -> bytes:
    """Page image -> webp bytes at `width` px (the admin UI's Live Proof size)."""
    import io

    image = image.convert("RGB")
    if image.width > width:
        image = image.resize((width, round(image.height * width / image.width)))
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=int(os.getenv("LAYOUT_PREVIEW_QUALITY", "80")))
    return buffer.getvalue()


layout_engine = LayoutEngine()
