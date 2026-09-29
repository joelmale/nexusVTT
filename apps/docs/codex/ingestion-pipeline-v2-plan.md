# Ingestion Pipeline v2 Plan

**Status:** Draft for review · **Date:** 2026-09-28 · **Scope:** `apps/codex/services/{doc-processor,ocr-service,doc-api,admin-ui}`

Nexus Codex ingests rulebook PDFs and turns them into searchable, citable reference
material. Today, layout and entity extraction is the weak link: Tesseract and pdf.js
text are reordered with coordinate heuristics (`layout.service.ts`,
`layout_ordering.py`), and regular expressions parse spells, items and monsters out of
the result. Two-column pages interleave, sidebars and art bleed into body text, and the
parsers break on small formatting differences.

v2 replaces that front end with a layout model (Marker/Surya) and a local
vision-language model (VLM) served by Ollama. The rest of the pipeline stays as it is:
the BullMQ stage machine, checkpoints, Prisma, chunking, embeddings, the entity
resolver and Elasticsearch. v2 also keeps exact page boundaries everywhere and adds a
live processing view to the admin UI.

## Goals

1. **Correct reading order** on multi-column rulebook pages, with sidebars, art,
   headers and footers separated from body text.
2. **Structured spells, items and monsters** from any text source (digital PDF,
   scanned PDF, or Markdown upload), with validation and review flags.
3. **Resumability stays a first-class feature.** Every stage and every page batch is
   checkpointed, idempotent and safe to retry.
4. **Exact page provenance** for every page, chunk and extracted entity, so documents
   can later support page references, highlights and annotations.
5. **Measured, not assumed.** A human-validated gold set decides which engines and
   models to use and when v2 replaces v1.
6. **Visible processing.** An admin can watch what the models see and extract, page by
   page, while a document processes.

## Non-goals

- Security hardening and CVE gating. This is a personal, internal learning project.
  Image scanning is advisory for now and gets revisited once the product works.
- Commercial licensing review. Marker's GPL code and model-weight terms are acceptable
  for personal, non-distributed use.
- Replacing Elasticsearch, Prisma, BullMQ or the embedding model.

## Decisions from review

| # | Topic | Decision |
|---|---|---|
| 1 | Pipeline structure | Keep the stage machine. Only the work inside stages changes. `render` and `ocr` merge into one `layout` stage, which is checkpointed per page batch. |
| 2 | ocr-service replacement breaking `/embed` | Add new endpoints next to the existing ones instead of replacing them. Make an embeddings failure fail the stage, not quietly fall back to hash vectors. See [Embeddings safety](#embeddings-safety). |
| 3 | Sample code | All snippets below use the real APIs in this repo: `bullmq`, `s3Service.downloadFile`, `documentId_source`, `chunkText`/`embedTexts`, `StructuredData` plus `entityResolverService`. Changes are the smallest that work. |
| 4 | Spells and items | Kept. Spells and items are text-first, so they are extracted from page Markdown by the LLM without images, for every source format. Monsters use the VLM on image crops. |
| 5 | Page boundaries | A new `DocumentPage` table holds per-page Markdown and layout blocks with normalized bounding boxes. Chunks, entities and future annotations reference it. See [Page model](#page-model). |
| 6 | Marker API | Use the current Marker 1.x converter API (`PdfConverter`, `create_model_dict`), pinned to an exact version. |
| 7 | Licensing | No concern (personal use). |
| - | Ollama | Use the Ollama instance already running on the Dockhand server that hosts Codex, reached over the internal Docker network. Codex does not ship its own Ollama container, and never uses the laptop's instance. |
| - | Security checks | Out of scope until the product works end to end. |

## Pipeline: current vs v2

| Stage | v1 (today) | v2 |
|---|---|---|
| `ingest` | Download, content hash, duplicate detection, resume | **Unchanged** |
| `render` | pdf.js text + coordinate column sort; per-page OCR gate; render OCR PNGs to S3 | **Merged into `layout`** |
| `ocr` | Tesseract/RapidOCR on gated pages | **Merged into `layout`** |
| `layout` | - | Marker on page batches through ocr-service. Writes `DocumentPage` rows (Markdown + blocks + quality) and a page preview image. Checkpointed per batch. |
| `extract` | Regex parsers over the whole text | Candidate detection on page blocks, then LLM/VLM with a JSON schema, then zod validation and cross-checks, then `StructuredData` and the entity resolver. Regex parsers run alongside as a baseline. |
| `index` | Chunk, embed, index | Page-aware chunking (exact `pageStart`/`pageEnd`), then embed and index. Embeddings failure is a stage failure. |
| `assets` | Thumbnails and page images | Unchanged, except it reuses layout-stage page previews where they exist. |

The stage order becomes `ingest → layout → extract → index → assets`.

Markdown uploads skip `layout`. Their `DocumentPage` rows come from heading sections,
matching today's behaviour, and extraction then runs on them in the same way.

Marker uses a PDF's embedded text where it is good and runs OCR only where it is
needed. That replaces today's per-page OCR gate, so digital and scanned PDFs take the
same path.

## Resumability model

Resumability is preserved and extended to work within a stage:

- **Pipeline version per document.** `metadata.processing.pipelineVersion` is `v1` or
  `v2`. `STAGES` becomes a map from version to stage list, and
  `getNextStage(checkpoints, skipOcr, version)` reads from it. Documents processed by
  v1 keep resuming on v1. A reprocess chooses the version.
- **Batch checkpoints in `layout`.** Pages are processed in batches
  (`LAYOUT_BATCH_PAGES`, default 5). After each batch, the worker upserts the
  `DocumentPage` rows and records the batch in
  `checkpoints.stages.layout.batches[<start>-<end>]`. A retry skips completed batches.
  The stage completes when every batch is complete.
- **Extraction result cache.** Each extraction call is keyed by
  `sha256(contentHash, candidateBlockHash, model, promptVersion)`, and the raw model
  response is stored at `extract-cache/<documentId>/<key>.json` in S3. A retry or
  resume reuses cached responses instead of calling Ollama again. Changing
  `promptVersion` or the model invalidates the cache.
- **Idempotent writes.** `DocumentPage` uses `upsert` on `(documentId, pageNumber)`.
  `extract` and `index` keep today's delete-then-`createMany` pattern per document.
- **Content hash invalidation stays.** A different file hash invalidates every
  checkpoint, as it does today.

BullMQ renews job locks automatically while a job runs. Batches are sized so that one
batch finishes well within `OCR_SERVICE_TIMEOUT_MS`, which is raised for layout calls
(new `LAYOUT_SERVICE_TIMEOUT_MS`, default 10 minutes).

## Page model

Keeping page boundaries is foundational for citations now and for highlights and
annotations later. `DocumentAnnotation` already keys on `pageNumber` plus `position`,
so v2 stores layout in a compatible coordinate system.

```prisma
enum DocumentTextSource {
  pdf_extraction
  ocr
  markdown
  layout          // v2: Marker output
}

enum LayoutBlockClass {
  body           // text, section headers, lists
  heading
  table
  stat_block     // candidate from detection, not a Marker-native class
  sidebar        // heuristic, see Live Proof caveats
  art            // pictures and figures, excluded from text
  furniture      // page headers, footers and page numbers, excluded
}

model DocumentPage {
  id           String   @id @default(uuid())
  documentId   String
  pageNumber   Int                    // 1-based, matches PDF page index + 1
  markdown     String
  blocks       Json     @default("[]") // LayoutBlock[]
  widthPt      Float?                 // PDF page size in points
  heightPt     Float?
  previewKey   String?                // S3 key of the page preview (webp)
  quality      Json     @default("{}") // PageQuality
  engine       String                 // e.g. "marker@1.x.y"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  document     Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, pageNumber])
  @@index([documentId])
  @@map("document_pages")
}
```

```ts
type LayoutBlock = {
  id: string;                 // stable within the page, e.g. "p12-b7"
  class: LayoutBlockClass;
  markerType: string;         // raw Marker block_type, kept for debugging
  bbox: [number, number, number, number]; // normalized 0..1 (x0, y0, x1, y1)
  markdown?: string;          // omitted for art and furniture
};
```

**Why normalized coordinates:** page images are rendered at several widths
(thumbnails, 1200px previews, VLM crops at about 200 DPI). Values from 0 to 1 map onto
any of them without knowing the render resolution, and future annotation positions
should use the same convention.

**Consumers:**
- `DocumentText` (source `layout`) is still written as the concatenation of pages, so
  existing search and report code keeps working.
- `chunkText` gains a page-aware variant, `chunkPages(pages, …)`. Chunks never lose
  their page mapping: `pageStart`/`pageEnd` are exact instead of today's estimate from
  characters per page.
- `StructuredData.pageNumber` is set, and `data.source = { pageNumber, blockIds, bbox }`
  lets the UI jump to and highlight the exact stat block.

**Schema ownership:** `doc-api/prisma` owns migrations. The copy in
`doc-processor/prisma/schema.prisma` already differs from it today. Phase 0 reconciles
the two so the migration lands once and both clients generate from the same models.

## ocr-service changes

### Additive endpoints (fixes #2)

The existing endpoints stay: `/health`, `/metrics`, `/embed`, `/ocr/*`. v2 adds:

| Endpoint | Purpose |
|---|---|
| `POST /layout/s3` | Body: `{ bucket, key, pageStart, pageEnd, renderPreviews }`. Runs Marker on that page range and returns per-page Markdown, blocks and quality. Optionally uploads page previews to S3. |
| `GET /health` | Extended with `layout: { engine, version, modelsLoaded, device }` and `embed: { model, dim }`. |

The `/ocr/*` endpoints and the RapidOCR dependencies are removed only after v2 cutover
(Phase 5).

### Marker (current API)

Pin `marker-pdf==<exact version>` during Phase 0. The API below is the Marker 1.x
converter interface. **Verify every call against the pinned version** before building
on it: block type names and the page-separator format are the parts most likely to
drift.

```python
# apps/codex/services/ocr-service/src/layout_engine.py
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.config.parser import ConfigParser
from marker.renderers.markdown import MarkdownRenderer
from marker.renderers.json import JSONRenderer

ARTIFACTS = create_model_dict()  # load once at startup (GPU if available)

def convert_range(pdf_path: str, page_start: int, page_end: int) -> list[dict]:
    """page_start/page_end are 1-based and inclusive."""
    cfg = ConfigParser({
        "page_range": f"{page_start - 1}-{page_end - 1}",  # Marker is 0-based
        "paginate_output": True,
        "disable_image_extraction": True,
    })
    converter = PdfConverter(
        config=cfg.generate_config_dict(),
        artifact_dict=ARTIFACTS,
        processor_list=cfg.get_processors(),
    )
    document = converter.build_document(pdf_path)       # layout + OCR run once
    markdown = MarkdownRenderer(cfg.generate_config_dict())(document)
    blocks = JSONRenderer(cfg.generate_config_dict())(document)
    return split_pages(markdown.markdown, blocks, page_start)  # -> per-page dicts
```

`split_pages` splits the paginated Markdown on Marker's page separator. It maps each
JSON page's child blocks to `LayoutBlock`, normalizing `bbox` by the page size and
mapping `block_type` to a `LayoutBlockClass`: `PageHeader`/`PageFooter` become
`furniture`, `Picture`/`Figure` become `art`, `Table` becomes `table`, and everything
else becomes `body`/`heading`. It also computes `PageQuality` (see
[Quality telemetry](#quality-telemetry)).

### Container

- Base: `python:3.13-slim`, multi-stage, so the runtime image carries no compiler
  toolchain.
- Install `torch` from the CUDA wheel index that matches the Dockhand server's driver.
  A CPU fallback works for development but is slow.
- Model weights go in a named volume (`HF_HOME=/models`) so container restarts don't
  download them again.
- The port stays **8000** (the plan's 8080 would break `OCR_SERVICE_URL`).
- The container runs as a non-root user. `fastembed`/`onnxruntime` stay installed for
  `/embed`.
- If `torch` and `onnxruntime` need incompatible `numpy` versions, split `/embed` into
  its own small `embed-service`. This is a Phase 0 check.

### GPU scheduling

Surya (inside Marker) and the VLM share the server's GPU. Rules:

- `layout` and `extract` run in the existing queue at `WORKER_CONCURRENCY=1` for v2
  documents, so layout and VLM never run at the same time for one worker.
- Ollama uses `keep_alive` (for example `10m`) so the VLM stays loaded across a
  document's extraction calls and then frees VRAM.
- The GPU is 6 GB, so layout and extract alternate and hand VRAM over explicitly
  (`GPU_HANDOFF`, see open question 1). Phase 0 still records VRAM for Marker alone
  and the VLM alone.

## Embeddings safety

Today `embeddings.service.ts` falls back to hash vectors on any sidecar failure. If
`/embed` disappears, search quality collapses and nothing reports an error. v2 changes
this:

1. **Fail loudly.** When `EMBEDDINGS_PROVIDER=sidecar`, a failed `/embed` call throws.
   The `index` stage fails, BullMQ retries it, and the checkpoint records the error.
   The hash provider is used only when it is explicitly configured.
2. **Label vectors.** `DocumentChunk.embeddingModel` (the field already exists) is
   always set, to the model name or to `hash`. Mixed or unexpected values show up in
   the processing report and in Data Quality.
3. **Contract test.** An ocr-service test asserts that `/embed` and `/health` respond
   with the expected shape. It fails the Codex CI job if someone removes or renames
   them.
4. **Health gate.** The doc-processor worker checks ocr-service `/health` at startup
   and before `layout`/`index`, and logs the loaded embed model.

## Extraction

### Flow per document

```
DocumentPage[] ─▶ candidate detection ─▶ per-candidate extraction ─▶ validate ─▶ StructuredData
                   (rules over blocks)    (LLM text or VLM crop)      (zod +      + entityResolver
                                          cached by key               cross-check)
```

1. **Candidate detection.** Cheap rules run over each page's blocks and Markdown:

   | Type | Signals |
   |---|---|
   | Monster | "Armor Class" + "Hit Points" + an ability row (STR…CHA) or "Challenge". Bounding box = union of the contiguous blocks. |
   | Spell | "Casting Time" + "Range" + "Components" + "Duration", with a level/school line nearby. |
   | Item | A type/rarity line (Wondrous item, Weapon, Armor, Ring…; common…legendary; "requires attunement"). |

   A stat block may span two columns or a page break. The detector merges blocks with a
   continuation on the next column or page.

2. **Extraction.**
   - **Spells and items: text only.** The candidate's Markdown is sent to the model
     with the type's JSON schema. This is cheaper and more accurate than images for
     prose, and works for scanned, digital and Markdown sources alike.
   - **Monsters: VLM on a crop plus text.** The page is rendered at about 200 DPI and
     cropped to the candidate's bounding box plus a margin. The crop and the Marker
     text for the same blocks are sent together. The image fixes table and column
     structure, and the text anchors spelling.
   - Every call returns an **array** (`{ entities: [...] }`), so a candidate region
     holding two stat blocks yields two entities.

3. **Validation** with zod, one schema per type, then cross-checks:
   - **Grounding.** Each numeric value (AC, HP, ability scores, spell level, save DCs)
     must appear in the candidate's source text. Values that don't are marked as
     likely invented.
   - **Monster consistency.** Ability modifiers match scores; XP matches CR; the
     hit-dice average is close to HP.
   - **Spell and item consistency.** Spell level is 0–9 and the school is from the
     known set; components are V/S/M; item rarity and type come from known sets.
   - **Baseline agreement.** The v1 regex parser also runs on the candidate Markdown
     (which is now clean). Agreement raises confidence; disagreement adds a review
     reason.

4. **Persist** through the existing extract-stage code path: `StructuredData` rows
   (`data.review = { status: 'auto' | 'needs_review', confidence, reasons[] }`,
   `data.source = { pageNumber, blockIds, bbox, model, promptVersion }`) and
   `entityResolverService.resolveEntity`. This path already handles cross-book
   duplicates through `@@unique([type, normalizedName])`.

### Ollama client (real repo APIs)

```ts
// apps/codex/services/doc-processor/src/services/llm-extraction.service.ts
import { z } from 'zod/v4';            // zod 3.25 ships the v4 API with toJSONSchema
import { env } from '../config/env';

export const MonsterSchema = z.object({
  name: z.string().min(1),
  size: z.string(),
  type: z.string(),
  alignment: z.string(),
  armorClass: z.number().int(),
  armorType: z.string().optional(),
  hitPoints: z.number().int(),
  hitDice: z.string().optional(),
  speed: z.string(),
  abilities: z.object({
    str: z.number().int(), dex: z.number().int(), con: z.number().int(),
    int: z.number().int(), wis: z.number().int(), cha: z.number().int(),
  }),
  savingThrows: z.string().optional(),
  skills: z.string().optional(),
  damageResistances: z.string().optional(),
  damageImmunities: z.string().optional(),
  conditionImmunities: z.string().optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  challengeRating: z.string(),
  traits: z.array(z.object({ name: z.string(), description: z.string() })),
  actions: z.array(z.object({ name: z.string(), description: z.string() })),
  legendaryActions: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
});
const MonsterList = z.object({ entities: z.array(MonsterSchema) });

type ExtractInput = { text: string; image?: Buffer };

export async function extractWithSchema<T extends z.ZodType>(
  schema: T,
  systemPrompt: string,
  input: ExtractInput,
): Promise<{ parsed: z.infer<T> | null; raw: string }> {
  const response = await fetch(`${env.OLLAMA_URL.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model: input.image ? env.VLM_MODEL : env.TEXT_LLM_MODEL,
      stream: false,
      keep_alive: env.OLLAMA_KEEP_ALIVE,
      format: z.toJSONSchema(schema),          // Ollama structured outputs
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Source text for this region:\n\n${input.text}`,
          ...(input.image ? { images: [input.image.toString('base64')] } : {}),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }
  const raw = ((await response.json()) as { message: { content: string } }).message.content;
  const result = schema.safeParse(JSON.parse(raw));
  return { parsed: result.success ? result.data : null, raw };
}
```

A failure to reach Ollama throws, so the stage fails and BullMQ retries it. A schema
failure does not throw: that candidate is recorded as `needs_review` with the raw
response kept in the cache.

### New configuration

| Variable | Default | Notes |
|---|---|---|
| `PIPELINE_VERSION` | `v1` | Default for new uploads; `v2` after cutover |
| `LAYOUT_BATCH_PAGES` | `5` | Smaller is more "live" and costs slightly more overhead |
| `LAYOUT_SERVICE_TIMEOUT_MS` | `600000` | Per batch |
| `OLLAMA_URL` | `http://ollama:11434` | The Dockhand server's Ollama on a shared internal network; the port is not published |
| `VLM_MODEL` | chosen by gold set | Candidates: `qwen2.5vl:7b`, `qwen3-vl:8b` (confirm exact Ollama tags) |
| `OLLAMA_KEEP_ALIVE` | `10m` | |
| `LLM_TIMEOUT_MS` | `120000` | |
| `EXTRACT_PROMPT_VERSION` | `1` | Part of the cache key |
| `EXTRACT_CROP_DPI` | `200` | Render DPI for monster crops |
| `GPU_HANDOFF` | `true` | Unload layout models before extract and the VLM after (6 GB GPU) |

## Live processing UI

The admin UI already has `Processing.tsx` with `PipelineGraph` (stage cards driven by
checkpoints) and a raw job-log panel, polling every 10 seconds. v2 keeps both. It
updates `PipelineGraph` for the `layout` stage and adds two panels below it for the
selected document.

### Event stream

The worker emits structured events as it goes, alongside the existing log lines.

```prisma
model ProcessingEvent {
  id          BigInt   @id @default(autoincrement())
  documentId  String
  runId       String               // one per processing run or reprocess
  stage       String
  pageNumber  Int?
  kind        String               // stage_started | page_layout | page_markdown |
                                   // entity_extracted | entity_rejected | quality | stage_completed | stage_failed
  message     String               // human-readable sentence for the Action Feed
  payload     Json     @default("{}")
  createdAt   DateTime @default(now())

  @@index([documentId, id])
  @@map("processing_events")
}
```

- `doc-api` adds `GET /api/admin/processing/:documentId/events?after=<id>&limit=200`.
  The UI polls it every 1.5 s while the document has an active job, and stops
  otherwise. Polling is enough for this: it matches the existing React Query pattern
  and needs no new infrastructure. `doc-websocket` can push events later if polling
  ever feels laggy.
- Events persist, so a finished run can be **replayed** by stepping through its
  events. That is useful when comparing v1 and v2 runs or reviewing a gold-set page.
- Only the last three runs per document are kept.

### B. Live Proof canvas

A split view for the selected document:

- **Left: page with layout overlay.** The layout-stage preview (`previewKey`) with
  `blocks` drawn as an SVG overlay scaled from normalized coordinates:
  - 🟢 body and headings: text that went into the Markdown, numbered in reading order
    so column flow is visible
  - 🟣 stat block: extraction candidates, outlined by status (extracting, extracted,
    needs review)
  - 🟠 sidebar
  - ⚪ art and furniture: hatched and labelled "excluded from text"

  It follows the latest completed page by default. A page scrubber and a "follow live"
  toggle let you browse earlier pages. Clicking a block highlights its Markdown on the
  right.
- **Right: artifact stream.** Page Markdown is appended as each batch completes.
  Extracted entities appear as stat cards (monster: name, AC, HP, CR, action names;
  spell: level, school, casting time; item: type, rarity) with a brief highlight
  animation, a review badge, and a "show source" link that highlights the region on
  the left. The animation is disabled when `prefers-reduced-motion` is set.

**Caveats:**
- Marker processes a batch of pages at a time, not one page at a time. "Live" means
  one update per completed batch: with `LAYOUT_BATCH_PAGES=5`, a burst every batch.
  The UI reveals the burst page by page so it reads as a stream.
- Marker has no native "sidebar" or "stat block" class. Stat blocks come from our
  candidate detector (reliable). Sidebars are a heuristic: a text block narrower than
  the column with a distinct background or border in the page image. The UI labels it
  "sidebar (heuristic)". If it proves unreliable in the gold set, it is shown as plain
  body text.

### C. Action Feed and quality telemetry

- The **Action Feed** replaces the default job-log view. Each `ProcessingEvent.message`
  renders as a timestamped sentence, for example:
  - `14:02:11 · Page 12: two-column layout, 1 stat block candidate ("Gorgon"), 1 art region excluded`
  - `14:02:13 · qwen2.5vl: extracted Gorgon (AC 19, HP 114, CR 5), all values grounded`
  - `14:02:14 · Page 12 Markdown: 412 words, quality 96.4%`

  A "Raw logs" toggle keeps today's log panel available for debugging.
- **Quality badge**, per page and as a running document average. See
  [Quality telemetry](#quality-telemetry). Pages below the threshold are listed as
  "check these pages" links into the Live Proof canvas.

### Accessibility and layout

- The overlay has a legend, and each block class uses a distinct shape or pattern as
  well as colour, so meaning is not carried by colour alone.
- The Action Feed is a `role="log"` region with `aria-live="polite"`, throttled so
  screen readers aren't flooded.
- Below about 1024 px the split view stacks: page on top, artifact stream underneath.

## Quality telemetry

Computed in ocr-service for each page and stored in `DocumentPage.quality`:

| Metric | Definition | Purpose |
|---|---|---|
| `wordValidity` | Share of word tokens found in an English dictionary **plus a game lexicon**, after excluding dice notation (`2d6+3`), numbers, and ordinals | Headline "Quality %". The game lexicon (SRD names, known entity names, common RPG terms) stops "Tiamat" or "Gorgon" from counting as noise. |
| `symbolNoise` | Share of non-alphanumeric, non-punctuation characters | Catches parchment texture being read as glyphs |
| `repetition` | Longest repeated n-gram run on the page | Catches autoregressive OCR loops |
| `textSource` | Share of the page from embedded text vs OCR | Explains why a page is noisy |

Colour thresholds for the badge are set **from the gold set** (Phase 1): the harness
measures how well `wordValidity` tracks real character error rate and places the
warn/fail lines where the correlation supports them. It is a proxy for clean reading,
not proof of correctness. The UI wording says "Text cleanliness".

## Gold-set benchmark harness

### Purpose

A small, fixed collection of rulebook pages with human-verified "correct answers".
Every engine, model, prompt or rule change runs against it, producing a scorecard that
is comparable over time. It is the only reliable way to answer "is v2 actually better,
and which model should we use?"

### Composition (about 25–30 pages)

Pages are chosen for variety, not volume:

| Category | Pages |
|---|---|
| Clean two-column prose | 4 |
| Two-column with sidebar or callout | 4 |
| Monster stat blocks (single, two per page, spanning a column break) | 6 |
| Spell lists and descriptions | 4 |
| Magic items | 3 |
| Tables | 3 |
| Scanned or photographed pages | 3 |
| Heavy art or parchment backgrounds | 3 |

About 20% of pages are held out: never looked at while tuning prompts or rules, and
used only for the final go/no-go. This prevents tuning the pipeline to the test.

### Labels per page

- **Reading-order text:** the page's correct text in reading order, excluding art and
  furniture.
- **Region boxes:** normalized boxes for stat blocks, sidebars, tables and art.
- **Entities:** full JSON for every spell, item and monster on the page, using the same
  schemas as extraction.

### How labels are made: draft by machine, verify by a person

Typing labels from scratch is slow. Trusting a model's output as the answer key
defeats the purpose. So:

1. **Draft.** Run the best available pipeline on each page to prefill text, boxes and
   entities. For SRD content, prefill entities from SRD data where they match.
2. **Human review.** Open each page in a review view: the Live Proof canvas in a
   "gold-set edit" mode. Fix the text, adjust boxes, and correct every entity field
   against the printed page. Every field is checked, not only the ones that look
   wrong. Mark the page `verified`.
3. **Second pass on numbers.** Re-check AC, HP, ability scores, CR, spell level and
   rarity on every stat block. These are where errors cost most and are easiest to
   miss.
4. **Freeze and version.** The label set is `goldset@N`. Scorecards record the gold
   set version, so results are only compared within one version.

**Yes, it should be human-reviewed.** Without that, the benchmark measures agreement
with a model, not accuracy. Rough cost: 5–10 minutes per page, so about 3–4 hours for
the whole set, done once and touched up occasionally.

### Metrics

| Area | Metric |
|---|---|
| Reading order | Character error rate against gold text; paragraph order score (rank correlation of paragraph sequence) |
| Regions | Per class, precision and recall at IoU ≥ 0.5 |
| Entities | Recall (found every entity), precision (no invented entities), per-field exact match (numbers), normalized similarity (prose fields), grounding-violation rate |
| Review flags | Share of wrong entities that were flagged `needs_review`. Wrong and unflagged is the worst outcome. |
| Cost | Seconds per page for layout and extract; peak VRAM |
| Quality proxy | Correlation of `wordValidity` with CER (sets badge thresholds) |

### Storage and running

- Labels (JSON) live in the repo under `apps/codex/eval/goldset/`. Source PDFs and page
  images stay **out of git**, in a local or S3 `codex-eval` location, referenced by
  file hash and page number. Rulebook page images shouldn't be committed.
- `apps/codex/scripts/eval-pipeline.js --goldset N --pipeline v1|v2 --vlm <model>`
  writes a scorecard (JSON and a Markdown table) to `apps/codex/eval/results/`. It sits
  next to the existing `benchmark-ingest.js` and `eval-*.js` scripts and reuses their
  API plumbing.
- The v1 pipeline is scored first, so every v2 result has a baseline.

## Phases

Each phase ends with a demonstrable result.

### Phase 0: Spikes and groundwork

- Confirm the Dockhand server's Ollama: container name, network, GPU, installed
  models. Pull the candidate VLMs.
- Pin Marker. Verify the converter, renderer, block-type and page-separator details
  used above. Measure VRAM and seconds per page on the server GPU.
- Check that `torch` and `onnxruntime` coexist; otherwise split out `embed-service`.
- Reconcile the doc-api and doc-processor Prisma schemas.
- Apply [Embeddings safety](#embeddings-safety) steps 1–3. This is useful even if v2
  stops here.

**Exit:** a written spike note with measured numbers; embeddings fail loudly.

### Phase 1: Gold set and baseline

- Build the gold-set review view (edit mode of the Live Proof canvas, reading from
  fixture files) and `eval-pipeline.js`.
- Label and verify the pages. Score v1.

**Exit:** `goldset@1` frozen; v1 scorecard committed.

### Phase 2: Layout stage

- `DocumentPage`, the `layout` enum value, `/layout/s3`, batch checkpoints, page
  previews, quality metrics.
- `pipelineVersion` routing in `stage-utils.ts`; `chunkPages` in `index`.

**Exit:** a v2 document resumes correctly after the worker is killed mid-batch;
reading-order CER beats v1 on the gold set.

### Phase 3: Extraction

- Candidate detection, `llm-extraction.service.ts` with the three schemas, the
  extraction cache, cross-checks, regex baseline agreement, and persistence through
  `StructuredData` and the entity resolver.
- Compare VLM candidates on the gold set and choose `VLM_MODEL`/`TEXT_LLM_MODEL`.

**Exit:** entity recall and precision beat v1 on the held-out pages, with no increase
in wrong-and-unflagged entities.

### Phase 4: Live processing UI

- `ProcessingEvent` and the events endpoint; worker emits events.
- Live Proof canvas, Action Feed, quality badge; `PipelineGraph` updated for `layout`;
  replay of completed runs.
- Tests: component tests for the overlay scaling, feed rendering and reduced motion;
  an API test for event pagination.

**Exit:** a real rulebook processes with the canvas and feed updating live, and a
finished run can be replayed.

### Phase 5: Cutover and cleanup

- `PIPELINE_VERSION=v2` by default. Reprocess the library.
- Remove `ocr-pool.ts`, `ocr.service.ts`, `layout.service.ts`, `layout_ordering.py`,
  RapidOCR, `tesseract.js` and the `/ocr/*` endpoints.
- Keep the regex parsers as the baseline and validator, or remove them if the gold set
  shows they no longer add signal.
- Update `apps/docs/codex/architecture.md`, `configuration.md` and `database-schema.md`.

**Exit:** v1 code removed; the docs describe v2.

## Risks and open questions

| Risk | Mitigation |
|---|---|
| Marker and VLM don't fit in VRAM together | They run one after the other (see GPU scheduling). Measured in Phase 0. |
| Marker API drift between versions | Exact version pin; `layout_engine.py` is the only file touching Marker. |
| VLM invents plausible numbers | Grounding checks, review flags, and a gold-set metric for wrong-and-unflagged results |
| Stat blocks split across columns or pages | Continuation merge in the detector; dedicated gold-set pages |
| Slow full-library reprocess | Checkpointed batches; run overnight; the extraction cache keeps re-runs cheap |
| Sidebar heuristic unreliable | Labelled heuristic; falls back to body text if the gold set says so |

**Open questions (answered 2026-09-28):**

1. **GPU:** the Dockhand server's RTX A2000 is the **6 GB** model. Layout and the
   VLM never overlap: with `GPU_HANDOFF=true` (default) the extract stage calls
   ocr-service `POST /layout/unload` before its first model call and asks Ollama
   to unload the VLM (`keep_alive: 0`) when it finishes; `/layout/s3` reloads
   Marker on demand. Phase 0 must confirm the chosen VLM fits in 6 GB on its
   own; include smaller variants (for example `qwen2.5vl:3b`) in the VRAM spike.
2. **Gold-set sources** live on the Dockhand server's S3 (Garage), in a
   `codex-eval` bucket, keyed by file hash and page number. Labels stay in git.
3. **One model** for text and vision (`VLM_MODEL`; `TEXT_LLM_MODEL` is dropped).
   Other models are tried by switching `VLM_MODEL`, never run side by side. The
   model name is part of the extraction cache key.
