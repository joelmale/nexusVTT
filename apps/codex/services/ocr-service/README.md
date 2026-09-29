# NexusCodex OCR Sidecar (`ocr-service`)

GPU-accelerated, layout-aware OCR sidecar service for Nexus Codex, optimized for NVIDIA GPUs (such as the RTX A2000) using ONNX Runtime with CUDA / TensorRT execution providers.

## Key Features

1. **GPU Acceleration**: Utilizes ONNX Runtime with CUDA (`CUDAExecutionProvider`) to leverage the RTX A2000's Tensor cores, speeding up text extraction by 5–15x compared to CPU WASM Tesseract.
2. **Smooth CPU Fallback**: Automatically falls back to `CPUExecutionProvider` if no NVIDIA GPU is detected.
3. **Multi-Column Layout Ordering**: RPG rulebooks and adventure modules feature two-column text and stat blocks. The layout ordering engine sorts blocks into column-first reading order, preventing jumbled horizontal text.
4. **Bounded Batching**: Accepts single images or bounded batches (2–8 pages) to prevent host RAM and GPU VRAM exhaustion.
5. **Telemetry & Health Probes**: Exposes `GET /health` with live GPU device name, VRAM allocations, and utilization metrics.

## Advanced Features

1. **Dual-Use GPU Semantic Embeddings**: Exposes `POST /embed` powered by `fastembed` (defaulting to `BAAI/bge-small-en-v1.5`), executing inference on CUDA to offload vector generation from the CPU.
2. **Direct S3 Object Handoff**: `POST /ocr/s3` accepts `{ bucket, key }` payloads so the sidecar streams rendered pages directly from S3/Garage, bypassing Node.js buffer transit in memory.
3. **Per-Page OCR Gating**: `doc-processor` inspects layout extraction per page and only renders/transfers images for pages lacking digital text.
4. **FP16 Precision & TensorRT**: Supports `CUDAExecutionProvider` and `TensorrtExecutionProvider` with FP16 precision, cutting VRAM by ~50% and maximizing Tensor Core throughput.
5. **Prometheus Observability**: Exposes `GET /metrics` reporting live GPU VRAM allocations, utilization percentages, OCR processing latencies, and embedding execution latencies.

## API Endpoints

- `GET /health`: Health probe returning status, GPU availability, VRAM telemetry, `embed: { model, dim }` and `layout: { engine, version, installed, modelsLoaded, device, error }`.
- `GET /metrics`: Prometheus metric scrape endpoint.
- `POST /ocr/image`: Process a single image file (`multipart/form-data`).
  - Query params: `page_number` (int), `reorder_columns` (bool, default `true`).
- `POST /ocr/bytes`: Process raw image bytes from HTTP body.
- `POST /ocr/s3`: Process page image directly from S3/Garage by bucket and key.
- `POST /ocr/batch`: Process up to `MAX_BATCH_SIZE` images concurrently.
- `POST /embed`: Generate dense text embeddings using GPU acceleration (`{ "texts": ["..."] }`). The response's `model` names the model that produced the vectors; `fallback-hash-384` means fastembed failed and doc-processor will refuse the vectors. `tests/test_contract.py` pins this contract.

- `POST /layout/s3` (ingestion v2): runs Marker on a page range of a PDF in S3.
  - Body: `{ "bucket", "key", "pageStart", "pageEnd", "renderPreviews", "previewPrefix", "lexicon" }` (pages 1-based, inclusive).
  - Returns `{ engine, pages: [{ pageNumber, markdown, blocks, widthPt, heightPt, previewKey, quality }], duration_ms }`. `blocks` are `{ id, class, markerType, bbox, markdown? }` with `bbox` normalized to 0..1. `quality` holds `wordValidity`, `symbolNoise`, `repetition`, `textSource` and `wordCount` (see `src/quality.py`).
  - Answers 503 when Marker is not installed or its models failed to load.

## Layout engine (ingestion v2)

`src/layout_engine.py` is the only module that imports Marker. `marker-pdf` is pinned exactly in `requirements-layout.txt` (1.10.2) and was verified against that version's source. Re-verify before changing the pin; 2.x is a different API line. `TODO(verify-marker)` comments mark the details that still need a run on real pages.

Build arguments:

| Arg | Default | Purpose |
|---|---|---|
| `INSTALL_LAYOUT` | `true` | `false` builds the v1 OCR/embeddings image without torch or Marker |
| `TORCH_INDEX_URL` | `https://download.pytorch.org/whl/cu126` | CUDA wheel index matching the host driver; `.../whl/cpu` for CPU-only |
| `TORCH_VERSION` | `2.8.0` | Must satisfy Marker's `torch>=2.7,<3` |

Model weights are cached under `HF_HOME=/models`; mount a named volume there. `LAYOUT_PRELOAD=true` (the default) loads the models at startup. The container runs as the non-root `app` user (uid 1001).

The game lexicon (`src/data/game_lexicon.txt`) is generated from the repository's SRD data by `scripts/build_game_lexicon.py`. `tests/` mock Marker, so CI installs only `requirements.txt`.

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
      USE_FP16: "true"
      USE_TENSORRT: "false"
      FAST_EMBED_MODEL: "BAAI/bge-small-en-v1.5"
      S3_ENDPOINT: ${S3_ENDPOINT:-http://nexus-vtt2-garage:3900}
      S3_ACCESS_KEY_ID: ${GARAGE_ACCESS_KEY}
      S3_SECRET_ACCESS_KEY: ${GARAGE_SECRET_KEY}
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
