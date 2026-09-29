# Gold-Set Review Guide

How to build, verify and use the ingestion v2 gold set: a small, fixed set of rulebook
pages with human-verified answers that every engine, model, prompt or rule change is
scored against. Background: [Ingestion Pipeline v2 Plan](ingestion-pipeline-v2-plan.md#gold-set-benchmark-harness).

The rule that matters most: **labels are drafted by the pipeline and verified by a
person.** A label a model wrote and nobody checked measures agreement with the model,
not accuracy.

## What lives where

| Thing | Location | In git? |
|---|---|---|
| Source PDFs | The Dockhand server's S3 (Garage), bucket `codex-eval`, named `<sha256>.pdf` | No |
| Processed copies | Normal Codex documents, processed with `PIPELINE_VERSION=v2` | No |
| Labels (one JSON per page) | `apps/codex/eval/goldset/pages/<id>.json` | Yes |
| Manifest (version, sources, page list) | `apps/codex/eval/goldset/goldset.json` | Yes |
| Label schema | `apps/codex/eval/goldset/label.schema.json` | Yes |
| Go/no-go lines | `apps/codex/eval/goldset/thresholds.json` (provisional) | Yes |
| Scorecards | `apps/codex/eval/results/` | Yes, when worth keeping |

Never commit rulebook PDFs or page images. A label refers to its page only by the
source file hash and page number. `synthetic-001` is a hand-made example that shows the
format; it is not from a real book.

## 1. Choose the pages (about 25–30)

Pick for variety, not volume:

| Category (`category`) | Pages |
|---|---|
| Clean two-column prose (`two_column_prose`) | 4 |
| Two-column with sidebar or callout (`two_column_sidebar`) | 4 |
| Monster stat blocks: single, two per page, one spanning a column break (`monster_stat_block`) | 6 |
| Spell lists and descriptions (`spells`) | 4 |
| Magic items (`magic_items`) | 3 |
| Tables (`tables`) | 3 |
| Scanned or photographed pages (`scanned`) | 3 |
| Heavy art or parchment backgrounds (`heavy_art`) | 3 |

Mark about one page in five as **held out** before you look at any output for it.
Choose them across categories. Held-out pages are never used while tuning prompts or
rules; they are scored only for the final go/no-go (`--split heldout`).

## 2. Get the pages into Codex

1. Upload each source PDF to the `codex-eval` bucket as `<sha256>.pdf`.
2. Upload the same PDF to Codex with `PIPELINE_VERSION=v2` (or reprocess an existing
   upload on v2) and let it finish.
3. Record the Codex document id for each source in `goldset.json` under
   `sources.<sha256>.documentId`, or pass `--map` to the eval script later. Document
   ids are specific to one Codex instance; the hash is not.

## 3. Label a page in gold-set edit mode

In the admin UI, open **Processing**, choose the document, and in the **Live Proof**
panel click **Gold-set edit**. Pick the page with the page selector.

1. Click **Draft from pipeline**. This fills in the reading-order text, the region boxes
   (stat blocks, sidebars, tables, art) and the extracted entities for this page. It is
   only a starting point: the status is `draft` and nothing is marked checked.
2. Set the **label id**, a short stable name such as `mm-p142`, and the **category**. Tick
   **Held out** if this is one of your held-out pages.
3. **Fix the text.** Compare it with the printed page and correct it until it is the
   page's text in reading order: left column top to bottom, then the right column; a
   sidebar after the paragraph it sits beside. Leave out page headers, footers, page
   numbers and art captions that are part of the art. Put a blank line between
   paragraphs. Markdown symbols are ignored when scoring, so plain text is fine.
4. **Fix the boxes.** Boxes are only needed for stat blocks, sidebars, tables and art.
   - Drag on the page to draw a new box (it starts as `stat_block`; change the class in
     the list).
   - Click a box on the page, or its `#n` in the list, to select it; adjust the four
     numbers (0 to 1, left/top/right/bottom) or delete it.
   - A stat block that continues in the next column gets one box per column.
   - Scores use overlap of at least 50%, so boxes need to be close, not pixel-perfect.
5. **Fix every entity field.** For each spell, item and monster on the page, correct the
   JSON against the printed page. Check every field, not only the ones that look wrong.
   Add entities the pipeline missed (**Add entity**); remove ones it invented. Field
   names follow the extraction schemas: for example `armorClass`, `hitPoints`,
   `hitDice`, `abilities.str`, `challengeRating` (as printed, `"5 (1,800 XP)"`), spell
   `level` (0 for a cantrip), item `rarity` in lower case.
6. **Second pass on numbers.** Go through each stat block again looking only at AC, HP,
   ability scores, CR, spell level and rarity. These are where errors cost most and are
   easiest to miss. Tick **Numbers checked** on each entity and **Second pass on numbers
   done** for the page.
7. Enter your name in **Verified by**, set **Status** to `verified`. The editor refuses
   to call a page verified until the numbers pass is ticked everywhere; the problem list
   says what is missing.
8. Click **Download label JSON** and save it as
   `apps/codex/eval/goldset/pages/<id>.json`. Add the page to `goldset.json`:
   `{ "id": "<id>", "file": "pages/<id>.json" }`.

Drafts are also kept in the browser (per document and page) until you download them,
so you can stop and come back. **Open label JSON** loads a saved label to correct it.

Budget 5–10 minutes a page, about 3–4 hours for the whole set.

## 4. Freeze the version

When every page is verified, set `"status": "frozen"` in `goldset.json` and commit it as
`goldset@N`. From then on, fixes to labels go into a new version (`version: N+1`).
Scorecards record the version, so only compare scores from the same version.

## 5. Score a run

From `apps/codex`:

```bash
# v2 output from a running Codex instance (doc-api), tuning pages only
node scripts/eval-pipeline.js --goldset 1 --pipeline v2 --vlm qwen2.5vl:7b --api http://localhost:3005 --save-predictions eval/runs/qwen2.5vl-7b

# re-score saved output later without re-running anything
node scripts/eval-pipeline.js --goldset 1 --pipeline v2 --vlm qwen2.5vl:7b --predictions eval/runs/qwen2.5vl-7b

# final go/no-go on the held-out pages, failing on any missed threshold
node scripts/eval-pipeline.js --goldset 1 --pipeline v2 --vlm qwen2.5vl:7b --split heldout --enforce
```

The script writes a JSON and a Markdown scorecard to `eval/results/`. v1 scoring is
optional: v1 has no per-page text, so it needs exported predictions (`--predictions`).
The metrics:

| Area | Metric | Good looks like |
|---|---|---|
| Reading order | Character error rate (CER) against the label text | Low; the provisional line is 3% |
| Reading order | Paragraph order score (rank agreement of paragraphs) | Close to 1 |
| Regions | Precision and recall per class at IoU ≥ 0.5 | High for stat blocks especially |
| Entities | Recall (found every entity), precision (none invented) | Both high |
| Entities | Numeric fields exact; short fields exact; prose similarity | Numbers near 100% |
| Entities | Grounding-violation rate | Low, and every violation flagged |
| Review flags | Share of wrong entities flagged `needs_review` | High |
| Review flags | **Wrong and unflagged** | **Zero.** This is the worst outcome |
| Cost | Seconds per page for layout and extract | Fits the overnight reprocess budget |
| Quality proxy | Correlation of `wordValidity` with CER | Strongly negative; sets the badge lines |

To compare models, switch `VLM_MODEL` on the server (one model at a time), reprocess the
gold-set documents, and score each run against the same gold-set version. Changing the
model or `EXTRACT_PROMPT_VERSION` invalidates the extraction cache automatically.

## 6. Update labels and tune OCR, tagging and extraction

- **A label is wrong.** Fix it in edit mode (**Open label JSON**), and bump the gold-set
  version if it was already frozen. Never edit a label to match the pipeline's output
  unless the printed page agrees.
- **Reading order or OCR is wrong** (high CER, low order score). Look at the page in Live
  Proof: numbered blocks show the order Marker produced. Split failures between layout
  (wrong block order or classes: a Marker or config question for ocr-service) and text
  (wrong characters on a scanned page: `textSource` in the page quality shows OCR was
  used).
- **Boxes are wrong** (region precision or recall). Stat-block boxes come from candidate
  detection in doc-processor (`extraction/candidates.ts`); sidebars from the heuristic in
  `layout_engine.py` (`mark_sidebars`, marked `TODO(verify-marker)` for calibration).
- **Entities are wrong.** Check whether the candidate text was right first (it is shown
  in Live Proof). If the text was right, change the prompt or schema, bump
  `EXTRACT_PROMPT_VERSION`, and re-score the tuning split. If a wrong value was not
  flagged, add or tighten a check in `extraction/validation.ts`.
- **Text-cleanliness badge thresholds.** Once the set is labelled, look at the quality
  proxy correlation and pick warn/fail lines where `wordValidity` separates clean pages
  from noisy ones; update `QUALITY_THRESHOLDS` in the admin UI and
  `LOW_QUALITY_THRESHOLD` in doc-processor, and the lines in `thresholds.json`.
