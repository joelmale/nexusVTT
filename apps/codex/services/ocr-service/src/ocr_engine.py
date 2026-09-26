"""
OCR engine wrapper leveraging RapidOCR with ONNX Runtime GPU / CUDA acceleration.
Falls back smoothly to CPU execution when CUDA is not present.
"""
import io
import time
import subprocess
from typing import Dict, Any, List, Optional
from PIL import Image

try:
    import onnxruntime as ort
    AVAILABLE_PROVIDERS = ort.get_available_providers()
except Exception:
    AVAILABLE_PROVIDERS = ["CPUExecutionProvider"]

from rapidocr_onnxruntime import RapidOCR
from .layout_ordering import reorder_blocks_for_reading


class OCREngine:
    def __init__(self):
        self.has_cuda = "CUDAExecutionProvider" in AVAILABLE_PROVIDERS
        self.engine = None
        self._init_engine()

    def _init_engine(self):
        print(f"[OCREngine] Initializing RapidOCR. Available ONNX providers: {AVAILABLE_PROVIDERS}")
        try:
            # RapidOCR accepts params for provider
            if self.has_cuda:
                print("[OCREngine] Attempting to initialize with CUDAExecutionProvider...")
                # RapidOCR internally passes Det/Cls/Rec params to onnxruntime
                self.engine = RapidOCR()
            else:
                print("[OCREngine] Using CPUExecutionProvider.")
                self.engine = RapidOCR()
        except Exception as e:
            print(f"[OCREngine] Error initializing RapidOCR with preferred provider: {e}. Falling back to default CPU.")
            self.has_cuda = False
            self.engine = RapidOCR()

    def get_gpu_telemetry(self) -> Dict[str, Any]:
        """
        Gathers GPU telemetry if available via nvidia-smi.
        """
        telemetry = {
            "cuda_available": self.has_cuda,
            "onnx_providers": AVAILABLE_PROVIDERS,
            "device_name": None,
            "vram_total_mb": None,
            "vram_used_mb": None,
            "vram_free_mb": None,
            "gpu_utilization_pct": None,
        }

        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu",
                    "--format=csv,noheader,nounits"
                ],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0 and result.stdout.strip():
                parts = [p.strip() for p in result.stdout.strip().split(",")]
                if len(parts) >= 5:
                    telemetry["device_name"] = parts[0]
                    telemetry["vram_total_mb"] = float(parts[1])
                    telemetry["vram_used_mb"] = float(parts[2])
                    telemetry["vram_free_mb"] = float(parts[3])
                    telemetry["gpu_utilization_pct"] = float(parts[4])
        except Exception:
            # nvidia-smi might not be installed or accessible in CPU/mock dev environments
            pass

        return telemetry

    def process_image(
        self,
        image_bytes: bytes,
        reorder_columns: bool = True
    ) -> Dict[str, Any]:
        """
        Process an image buffer and extract text blocks with bounding boxes and confidence.
        """
        start_time = time.time()
        
        # Load image to determine dimensions
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            width, height = pil_img.size
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            # Convert to numpy bytes for RapidOCR
            img_format = pil_img.format or "PNG"

        # RapidOCR can take raw bytes or numpy array
        result, elapse_list = self.engine(image_bytes)

        blocks: List[Dict[str, Any]] = []
        confidences: List[float] = []

        if result:
            for item in result:
                # item format: [dt_boxes, text, score]
                # dt_boxes is 4-point list of [x, y] coordinates
                bbox = item[0]
                text = str(item[1]).strip()
                score = float(item[2])

                if text:
                    blocks.append({
                        "bbox": bbox,
                        "text": text,
                        "confidence": round(score, 4)
                    })
                    confidences.append(score)

        if reorder_columns and blocks:
            blocks = reorder_blocks_for_reading(blocks, width, height)

        combined_text = "\n".join(b["text"] for b in blocks)
        avg_confidence = round(sum(confidences) / len(confidences), 4) if confidences else 0.0
        duration_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "text": combined_text,
            "blocks": blocks,
            "confidence": avg_confidence,
            "page_width": width,
            "page_height": height,
            "line_count": len(blocks),
            "duration_ms": duration_ms,
            "elapse_detail": elapse_list if elapse_list else []
        }


ocr_engine = OCREngine()
