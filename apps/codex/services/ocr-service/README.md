# NexusCodex OCR Sidecar (`ocr-service`)

GPU-accelerated, layout-aware OCR sidecar service for Nexus Codex, optimized for NVIDIA GPUs (such as the RTX A2000) using ONNX Runtime with CUDA / TensorRT execution providers.

## Key Features

1. **GPU Acceleration**: Utilizes ONNX Runtime with CUDA (`CUDAExecutionProvider`) to leverage the RTX A2000's Tensor cores, speeding up text extraction by 5–15x compared to CPU WASM Tesseract.
2. **Smooth CPU Fallback**: Automatically falls back to `CPUExecutionProvider` if no NVIDIA GPU is detected.
3. **Multi-Column Layout Ordering**: RPG rulebooks and adventure modules feature two-column text and stat blocks. The layout ordering engine sorts blocks into column-first reading order, preventing jumbled horizontal text.
4. **Bounded Batching**: Accepts single images or bounded batches (2–8 pages) to prevent host RAM and GPU VRAM exhaustion.
5. **Telemetry & Health Probes**: Exposes `GET /health` with live GPU device name, VRAM allocations, and utilization metrics.

## API Endpoints

- `GET /health`: Health probe returning status, GPU availability, and VRAM telemetry.
- `POST /ocr/image`: Process a single image file (`multipart/form-data`).
  - Query params: `page_number` (int), `reorder_columns` (bool, default `true`).
- `POST /ocr/bytes`: Process raw image bytes from HTTP body.
- `POST /ocr/batch`: Process up to `MAX_BATCH_SIZE` images concurrently.

## Docker Compose Configuration

```yaml
  codex-ocr:
    image: ${DOC_OCR_IMAGE:-ghcr.io/joelmale/nexuscodex-ocr:main}
    container_name: nexus-vtt2-codex-ocr
    restart: unless-stopped
    environment:
      PORT: 8000
      MAX_BATCH_SIZE: 4
      CUDA_VISIBLE_DEVICES: 0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - nexus-internal-net
```
