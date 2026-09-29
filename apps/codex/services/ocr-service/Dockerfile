# Multi-stage: the builder carries the compiler toolchain, the runtime image
# only the virtualenv. Build context is the repository root.
#
# Python 3.12, not 3.13: rapidocr-onnxruntime (still serving /ocr/* until the
# v2 cutover) publishes no 3.13 wheels, so a 3.13 image cannot install
# requirements.txt. Move to 3.13 when RapidOCR is removed (plan Phase 5).

# ---- builder -------------------------------------------------------------
FROM python:3.12-slim AS builder

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PIP_NO_CACHE_DIR=1

# Ingestion v2 layout engine (Marker). torch comes from the CUDA wheel index
# that matches the Dockhand server's driver; set TORCH_INDEX_URL to
# https://download.pytorch.org/whl/cpu for a (slow) CPU-only build, or
# INSTALL_LAYOUT=false to build the v1 OCR/embeddings image without Marker.
ARG INSTALL_LAYOUT=true
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cu126
ARG TORCH_VERSION=2.8.0

COPY apps/codex/services/ocr-service/requirements.txt apps/codex/services/ocr-service/requirements-layout.txt ./
RUN if [ "$INSTALL_LAYOUT" = "true" ]; then \
      pip install --index-url "$TORCH_INDEX_URL" "torch==${TORCH_VERSION}" && \
      pip install -r requirements.txt -r requirements-layout.txt; \
    else \
      pip install -r requirements.txt; \
    fi

# ---- runtime -------------------------------------------------------------
FROM python:3.12-slim AS runtime

# Runtime libraries for image processing and ONNX Runtime.
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --home-dir /app --shell /usr/sbin/nologin app && \
    mkdir -p /models && chown app:app /models

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app apps/codex/services/ocr-service/src/ ./src/

# Model weights (Surya, fastembed) live in a named volume mounted at /models so
# restarts don't download them again; the directory is created app-owned above
# so a fresh volume inherits that ownership.
ENV PATH="/opt/venv/bin:$PATH" \
    PORT=8000 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    FASTEMBED_CACHE_PATH=/models/fastembed

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.title="Nexus Codex OCR Service" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

USER app

# Port stays 8000: doc-processor's OCR_SERVICE_URL depends on it.
EXPOSE 8000

# start-period covers the Marker model load at startup (LAYOUT_PRELOAD).
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
