"""
Layout-aware reading order reconstruction for multi-column documents
(such as TTRPG sourcebooks, stat blocks, and adventure modules).
"""
from typing import List, Dict, Any, Tuple


def get_bbox_bounds(bbox: List[List[float]]) -> Tuple[float, float, float, float, float, float]:
    """
    Given a 4-point polygon [[x1, y1], [x2, y2], [x3, y3], [x4, y4]],
    returns (min_x, min_y, max_x, max_y, center_x, center_y).
    """
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    return min_x, min_y, max_x, max_y, center_x, center_y


def reorder_blocks_for_reading(
    blocks: List[Dict[str, Any]],
    page_width: float,
    page_height: float,
    column_count: int = 2
) -> List[Dict[str, Any]]:
    """
    Reorders extracted OCR blocks to prevent reading across columns.
    
    If page appears to be two-column:
    - Identifies full-width blocks (span > 60% of page width across center).
    - Divides column-specific blocks into left column and right column.
    - Orders: Full-width headers -> Left column (top-to-bottom) -> Right column (top-to-bottom) -> Full-width footers.
    """
    if not blocks:
        return []

    if len(blocks) < 4 or column_count <= 1:
        # For single column or very few items, sort top-to-bottom
        return sorted(blocks, key=lambda b: get_bbox_bounds(b["bbox"])[1])

    mid_x = page_width / 2.0
    span_threshold = page_width * 0.55  # spans more than 55% of width

    top_full_width: List[Dict[str, Any]] = []
    bottom_full_width: List[Dict[str, Any]] = []
    left_column: List[Dict[str, Any]] = []
    right_column: List[Dict[str, Any]] = []

    # First pass: check if there is an actual two-column distribution
    left_count = 0
    right_count = 0

    block_data = []
    for block in blocks:
        min_x, min_y, max_x, max_y, cx, cy = get_bbox_bounds(block["bbox"])
        width = max_x - min_x
        block_data.append((block, min_x, min_y, max_x, max_y, cx, cy, width))
        if width < span_threshold:
            if cx < mid_x:
                left_count += 1
            else:
                right_count += 1

    # If distribution is clearly single-column, just sort top-to-bottom
    if left_count < 3 or right_count < 3:
        return sorted(blocks, key=lambda b: get_bbox_bounds(b["bbox"])[1])

    # Classify blocks
    for item in block_data:
        block, min_x, min_y, max_x, max_y, cx, cy, width = item
        
        # Check if full width
        if width >= span_threshold and min_x < mid_x and max_x > mid_x:
            if cy < page_height * 0.25:
                top_full_width.append((cy, block))
            elif cy > page_height * 0.85:
                bottom_full_width.append((cy, block))
            else:
                # Middle full-width header (e.g., section header across columns)
                # Treat as a breakpoint: assign to left or right based on center Y
                left_column.append((cy, block))
        elif cx < mid_x:
            left_column.append((cy, block))
        else:
            right_column.append((cy, block))

    # Sort each group top-to-bottom
    top_full_width.sort(key=lambda x: x[0])
    left_column.sort(key=lambda x: x[0])
    right_column.sort(key=lambda x: x[0])
    bottom_full_width.sort(key=lambda x: x[0])

    ordered = [b for _, b in top_full_width]
    ordered.extend([b for _, b in left_column])
    ordered.extend([b for _, b in right_column])
    ordered.extend([b for _, b in bottom_full_width])

    return ordered
