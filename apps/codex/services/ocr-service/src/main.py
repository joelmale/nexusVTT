"""
NexusCodex OCR Sidecar Service
FastAPI-based OCR service utilizing RapidOCR / ONNX Runtime with NVIDIA CUDA acceleration.
"""
import os
import time
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .ocr_engine import ocr_engine

MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "8"))

app = FastAPI(
    title="NexusCodex OCR Service",
    description="GPU-accelerated layout-aware OCR sidecar for Nexus Codex documents",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class HealthResponse(BaseModel):
    status: str
    service: str = "nexuscodex-ocr"
    gpu: bool
    device_name: Optional[str] = None
    vram_total_mb: Optional[float] = None
    vram_used_mb: Optional[float] = None
    vram_free_mb: Optional[float] = None
    gpu_utilization_pct: Optional[float] = None
    onnx_providers: List[str]


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health probe returning engine status and GPU/VRAM telemetry.
    """
    telemetry = ocr_engine.get_gpu_telemetry()
    return HealthResponse(
        status="ok",
        gpu=telemetry["cuda_available"],
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
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty image payload received")

        result = ocr_engine.process_image(content, reorder_columns=reorder_columns)
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
    try:
        content = await request.body()
        if not content:
            raise HTTPException(status_code=400, detail="Empty request body received")

        result = ocr_engine.process_image(content, reorder_columns=reorder_columns)
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
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


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
    return BatchOCRResponse(
        total_pages=len(page_responses),
        pages=page_responses,
        total_duration_ms=total_duration_ms
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
