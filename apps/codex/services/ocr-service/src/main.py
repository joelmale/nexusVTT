"""
NexusCodex OCR Sidecar Service
FastAPI-based OCR & Embedding service utilizing RapidOCR, FastEmbed, and ONNX Runtime with NVIDIA CUDA acceleration.
Supports direct S3 object retrieval, Prometheus metrics, and layout-aware reading order.
"""
import os
import time
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Query, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

from .ocr_engine import ocr_engine

MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "8"))

app = FastAPI(
    title="NexusCodex OCR & Embedding Service",
    description="GPU-accelerated layout-aware OCR and semantic embedding sidecar for Nexus Codex",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Metrics
METRIC_REQUESTS_TOTAL = Counter(
    "codex_ocr_requests_total",
    "Total requests processed by the OCR sidecar",
    ["endpoint", "status"]
)
METRIC_DURATION_SECONDS = Histogram(
    "codex_ocr_duration_seconds",
    "Duration of OCR and embedding requests in seconds",
    ["endpoint"],
    buckets=[0.02, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)
METRIC_GPU_VRAM_USED = Gauge(
    "codex_ocr_gpu_vram_used_bytes",
    "Current GPU VRAM used in bytes"
)
METRIC_GPU_VRAM_TOTAL = Gauge(
    "codex_ocr_gpu_vram_total_bytes",
    "Total GPU VRAM in bytes"
)
METRIC_GPU_UTILIZATION = Gauge(
    "codex_ocr_gpu_utilization_percent",
    "Current GPU core utilization percentage"
)


class OCRBlock(BaseModel):
    bbox: List[List[float]] = Field(..., description="4-point polygon of bounding box [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]")
    text: str = Field(..., description="Recognized text for this line/block")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")


class OCRPageResponse(BaseModel):
    page_number: Optional[int] = Field(None, description="Page number if provided")
    text: str = Field(..., description="Full text reconstructed in reading order")
    blocks: List[OCRBlock] = Field(default_factory=list, description="Extracted blocks with coordinates")
    confidence: float = Field(..., description="Average page recognition confidence")
    page_width: int
    page_height: int
    line_count: int
    duration_ms: float


class BatchOCRResponse(BaseModel):
    total_pages: int
    pages: List[OCRPageResponse]
    total_duration_ms: float


class S3OCRRequest(BaseModel):
    bucket: str = Field(..., description="S3/MinIO bucket name (e.g. documents)")
    key: str = Field(..., description="S3 object key (e.g. ocr-temp/.../page-1.png)")
    page_number: Optional[int] = Field(1, description="Page number")
    reorder_columns: Optional[bool] = Field(True, description="Enable multi-column layout reordering")


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., description="List of text chunks to embed")


class EmbedResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="List of dense embedding vectors")
    dimension: int
    count: int
    duration_ms: float


class HealthResponse(BaseModel):
    status: str
    service: str = "nexuscodex-ocr"
    gpu: bool
    tensorrt: bool
    device_name: Optional[str] = None
    vram_total_mb: Optional[float] = None
    vram_used_mb: Optional[float] = None
    vram_free_mb: Optional[float] = None
    gpu_utilization_pct: Optional[float] = None
    onnx_providers: List[str]


def update_gpu_metrics():
    telemetry = ocr_engine.get_gpu_telemetry()
    if telemetry.get("vram_used_mb") is not None:
        METRIC_GPU_VRAM_USED.set(telemetry["vram_used_mb"] * 1024 * 1024)
    if telemetry.get("vram_total_mb") is not None:
        METRIC_GPU_VRAM_TOTAL.set(telemetry["vram_total_mb"] * 1024 * 1024)
    if telemetry.get("gpu_utilization_pct") is not None:
        METRIC_GPU_UTILIZATION.set(telemetry["gpu_utilization_pct"])
    return telemetry


@app.get("/metrics")
async def prometheus_metrics():
    """
    Exposes Prometheus metrics for GPU telemetry, VRAM, and OCR latency.
    """
    update_gpu_metrics()
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health probe returning engine status and GPU/VRAM telemetry.
    """
    telemetry = update_gpu_metrics()
    return HealthResponse(
        status="ok",
        gpu=telemetry["cuda_available"],
        tensorrt=telemetry["tensorrt_available"],
        device_name=telemetry["device_name"],
        vram_total_mb=telemetry["vram_total_mb"],
        vram_used_mb=telemetry["vram_used_mb"],
        vram_free_mb=telemetry["vram_free_mb"],
        gpu_utilization_pct=telemetry["gpu_utilization_pct"],
        onnx_providers=telemetry["onnx_providers"],
    )


@app.post("/ocr/image", response_model=OCRPageResponse)
async def process_single_image(
    file: UploadFile = File(...),
    page_number: Optional[int] = Query(1, description="Page number of the document"),
    reorder_columns: bool = Query(True, description="Enable multi-column layout reading order")
):
    """
    Process a single image file (PNG/JPEG/WebP) and return structured text with bounding boxes.
    """
    start_time = time.time()
    endpoint = "ocr_image"
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty image payload received")

        result = ocr_engine.process_image(content, reorder_columns=reorder_columns)
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="success").inc()
        METRIC_DURATION_SECONDS.labels(endpoint=endpoint).observe(time.time() - start_time)

        return OCRPageResponse(
            page_number=page_number,
            text=result["text"],
            blocks=[OCRBlock(**b) for b in result["blocks"]],
            confidence=result["confidence"],
            page_width=result["page_width"],
            page_height=result["page_height"],
            line_count=result["line_count"],
            duration_ms=result["duration_ms"]
        )
    except Exception as e:
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="error").inc()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.post("/ocr/bytes", response_model=OCRPageResponse)
async def process_raw_bytes(
    request: Request,
    page_number: Optional[int] = Query(1, description="Page number of the document"),
    reorder_columns: bool = Query(True, description="Enable multi-column layout reading order")
):
    """
    Process raw image bytes from HTTP body without multipart form overhead.
    """
    start_time = time.time()
    endpoint = "ocr_bytes"
    try:
        content = await request.body()
        if not content:
            raise HTTPException(status_code=400, detail="Empty request body received")

        result = ocr_engine.process_image(content, reorder_columns=reorder_columns)
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="success").inc()
        METRIC_DURATION_SECONDS.labels(endpoint=endpoint).observe(time.time() - start_time)

        return OCRPageResponse(
            page_number=page_number,
            text=result["text"],
            blocks=[OCRBlock(**b) for b in result["blocks"]],
            confidence=result["confidence"],
            page_width=result["page_width"],
            page_height=result["page_height"],
            line_count=result["line_count"],
            duration_ms=result["duration_ms"]
        )
    except Exception as e:
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="error").inc()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.post("/ocr/s3", response_model=OCRPageResponse)
async def process_s3_object(request: S3OCRRequest):
    """
    Direct S3 Object Handoff: downloads image directly from S3/Garage storage into sidecar
    memory, bypassing Node.js buffer transfer completely.
    """
    start_time = time.time()
    endpoint = "ocr_s3"
    try:
        content = ocr_engine.fetch_s3_bytes(request.bucket, request.key)
        result = ocr_engine.process_image(content, reorder_columns=request.reorder_columns or True)
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="success").inc()
        METRIC_DURATION_SECONDS.labels(endpoint=endpoint).observe(time.time() - start_time)

        return OCRPageResponse(
            page_number=request.page_number,
            text=result["text"],
            blocks=[OCRBlock(**b) for b in result["blocks"]],
            confidence=result["confidence"],
            page_width=result["page_width"],
            page_height=result["page_height"],
            line_count=result["line_count"],
            duration_ms=result["duration_ms"]
        )
    except Exception as e:
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="error").inc()
        raise HTTPException(status_code=500, detail=f"Direct S3 OCR failed: {str(e)}")


@app.post("/ocr/batch", response_model=BatchOCRResponse)
async def process_batch_images(
    files: List[UploadFile] = File(...),
    reorder_columns: bool = Query(True, description="Enable multi-column layout reading order")
):
    """
    Process a bounded batch of images (up to MAX_BATCH_SIZE).
    """
    if len(files) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size {len(files)} exceeds maximum allowable batch size of {MAX_BATCH_SIZE}"
        )

    start_total = time.time()
    page_responses: List[OCRPageResponse] = []

    for index, file in enumerate(files, start=1):
        content = await file.read()
        if not content:
            continue
        result = ocr_engine.process_image(content, reorder_columns=reorder_columns)
        page_responses.append(OCRPageResponse(
            page_number=index,
            text=result["text"],
            blocks=[OCRBlock(**b) for b in result["blocks"]],
            confidence=result["confidence"],
            page_width=result["page_width"],
            page_height=result["page_height"],
            line_count=result["line_count"],
            duration_ms=result["duration_ms"]
        ))

    total_duration_ms = round((time.time() - start_total) * 1000, 2)
    METRIC_REQUESTS_TOTAL.labels(endpoint="ocr_batch", status="success").inc()
    METRIC_DURATION_SECONDS.labels(endpoint="ocr_batch").observe(time.time() - start_total)

    return BatchOCRResponse(
        total_pages=len(page_responses),
        pages=page_responses,
        total_duration_ms=total_duration_ms
    )


@app.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(request: EmbedRequest):
    """
    Dual-Use GPU Acceleration: Generates dense semantic vector embeddings for text chunks
    utilizing the idle GPU/VRAM capacity of the A2000.
    """
    start_time = time.time()
    endpoint = "embed"
    try:
        res = ocr_engine.generate_embeddings(request.texts)
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="success").inc()
        METRIC_DURATION_SECONDS.labels(endpoint=endpoint).observe(time.time() - start_time)

        return EmbedResponse(
            embeddings=res["embeddings"],
            dimension=res["dimension"],
            count=len(res["embeddings"]),
            duration_ms=res["duration_ms"]
        )
    except Exception as e:
        METRIC_REQUESTS_TOTAL.labels(endpoint=endpoint, status="error").inc()
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
