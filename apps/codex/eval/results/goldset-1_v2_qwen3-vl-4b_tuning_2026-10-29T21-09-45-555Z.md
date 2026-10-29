# Gold-set scorecard: goldset@1 · v2 · qwen3-vl:4b

Run 2026-10-29T21:09:45.555Z · split `tuning` · 9 pages · source `eval\goldset\predictions-example`

| Area | Metric | Value |
|---|---|---|
| Reading order | CER (lower is better) | 0.8949 |
| Reading order | Paragraph order score | 0.1099 |
| Regions | stat_block precision / recall (IoU >= 0.5) | 1 / 0.5 (2 gold) |
| Regions | sidebar precision / recall (IoU >= 0.5) | n/a / 0 (1 gold) |
| Regions | table precision / recall (IoU >= 0.5) | 0 / 0 (2 gold) |
| Regions | art precision / recall (IoU >= 0.5) | 1 / 0.1429 (7 gold) |
| Entities | Recall / precision | 0.6667 / 0.6667 |
| Entities | Numeric fields exact | 0.875 |
| Entities | Short fields exact / prose similarity | 1 / 1 |
| Entities | Grounding-violation rate | 0.3333 |
| Review flags | Wrong entities flagged | 0.5 of 2 |
| Review flags | **Wrong and unflagged** | 1 (spell:Smoke Step) |
| Cost | Layout / extract seconds per page | 4.1 / 6.2 |
| Quality proxy | Pearson(wordValidity, CER) over 1 pages | n/a |

## Thresholds (provisional)

| Check | Value | Limit | Result |
|---|---|---|---|
| readingOrder.cer | 0.8949 | 0.03 | **FAIL** |
| readingOrder.orderScore | 0.1099 | 0.9 | **FAIL** |
| regions.stat_block.recall | 0.5 | 0.9 | **FAIL** |
| regions.stat_block.precision | 1 | 0.9 | pass |
| regions.table.recall | 0 | 0.8 | **FAIL** |
| regions.table.precision | 0 | 0.8 | **FAIL** |
| regions.art.recall | 0.1429 | 0.8 | **FAIL** |
| regions.art.precision | 1 | 0.8 | pass |
| entities.recall | 0.6667 | 0.9 | **FAIL** |
| entities.precision | 0.6667 | 0.95 | **FAIL** |
| entities.numericExact | 0.875 | 0.98 | **FAIL** |
| reviewFlags.wrongUnflagged | 1 | 0 | **FAIL** |

## Pages

| Page | Category | CER | Order | Entities (matched/gold/pred) | Wrong & unflagged |
|---|---|---|---|---|---|
| synthetic-001 | monster_stat_block | 0.0543 | 0.989 | 2/2/3 | spell:Smoke Step |
| mm-p078 | monster_stat_block | 1 | 0 | 0/1/0 | - |
| tph-p065 | heavy_art | 1 | 0 | 0/0/0 | - |
| phb-p077 | heavy_art | 1 | 0 | 0/0/0 | - |
| phb-p083 | heavy_art | 1 | 0 | 0/0/0 | - |
| mm-p3 | two_column_sidebar | 1 | 0 | 0/0/0 | - |
| mm-p004 | tables | 1 | 0 | 0/0/0 | - |
| mm-p10 | two_column_sidebar | 1 | 0 | 0/0/0 | - |
| mm-p12 | two_column_sidebar | 1 | 0 | 0/0/0 | - |
