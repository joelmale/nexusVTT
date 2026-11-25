#!/usr/bin/env node
/**
 * Dumps pipeline output for the gold-set pages as one JSON document on stdout,
 * so a run can be scored somewhere that cannot reach doc-api.
 *
 * It is self-contained (no repo files, no dependencies) so it can be piped into
 * the doc-api container, which can reach itself on localhost:
 *
 *   docker exec -i <doc-api container> node - <MM_DOC_ID> <PHB_DOC_ID> > predictions.json
 *
 * Then split and score locally from apps/codex:
 *
 *   node scripts/split-goldset-predictions.js predictions.json eval/runs/baseline
 *   node scripts/eval-pipeline.js --goldset 1 --pipeline v2 --vlm <model> --predictions eval/runs/baseline
 *
 * Document ids are in the Admin UI URL for each book. The prediction shape is the
 * same as `fetchPrediction` in eval-pipeline.js.
 */

const API = (process.env.DOC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Source book (by file hash, as in the labels) -> its gold pages. Regenerate when labels change.
const SOURCES = [
  { name: 'Monster Manual', sha256: '6514c87c6c040c86b996acb2e4a5663b5e0065084842280f6b0a94b4c964ac3e', pages: { 'mm-p078': 79, 'mm-p3': 3, 'mm-p004': 4, 'mm-p10': 10, 'mm-p12': 12 } },
  { name: 'Players Handbook', sha256: 'ccd242684b0c', pages: { 'tph-p065': 65, 'phb-p077': 77, 'phb-p083': 83 } },
];

const [mmId, phbId] = process.argv.slice(2);
if (!mmId || !phbId) {
  console.error('usage: node - <MONSTER_MANUAL_DOCUMENT_ID> <PLAYERS_HANDBOOK_DOCUMENT_ID>');
  process.exit(2);
}

const getJson = async (path) => {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error || response.statusText} (${path})`);
  return payload;
};

const predict = async (documentId, pageNumber, doc) => {
  const page = await getJson(`/api/admin/processing/${documentId}/pages/${pageNumber}`);
  const { structured, report } = doc;
  const onPage = (row) =>
    row.pageNumber === pageNumber || (row.data?.source?.regions || []).some((region) => region.pageNumber === pageNumber);
  const entities = structured.filter(onPage).map((row) => {
    const { review, source, confidence, needsReview, rawSnippet, ...data } = row.data || {};
    return { type: row.type, data: { ...data, name: row.name }, review };
  });
  const statBlocks = structured
    .filter(onPage)
    .flatMap((row) => (row.data?.source?.regions || []).filter((region) => region.pageNumber === pageNumber))
    .map((region) => ({ class: 'stat_block', bbox: region.bbox }));
  const regions = [
    ...(page.blocks || []).filter((block) => ['sidebar', 'table', 'art'].includes(block.class)).map((block) => ({ class: block.class, bbox: block.bbox })),
    ...statBlocks,
  ];
  const stages = report.processing?.checkpoints?.stages || {};
  const pageCount = report.document?.pageCount || 1;
  return {
    text: page.markdown,
    quality: page.quality,
    regions,
    entities,
    // Kept for diagnosis: the raw blocks (class, order, text) behind this page.
    blocks: (page.blocks || []).map((block) => ({ id: block.id, class: block.class, bbox: block.bbox, markdown: block.markdown })),
    timing: {
      layoutMsPerPage: stages.layout?.durationMs ? stages.layout.durationMs / pageCount : undefined,
      extractMsPerPage: stages.extract?.durationMs ? stages.extract.durationMs / pageCount : undefined,
    },
  };
};

(async () => {
  const out = {};
  for (const [source, documentId] of [[SOURCES[0], mmId], [SOURCES[1], phbId]]) {
    const [structured, report] = await Promise.all([
      getJson(`/api/documents/${documentId}/structured-data`),
      getJson(`/api/admin/processing/report/${documentId}`),
    ]);
    const title = report.document?.title;
    if (title) console.error(`[fetch] ${source.name}: document ${documentId} is titled "${title}"`);
    for (const [pageId, pageNumber] of Object.entries(source.pages)) {
      try {
        out[pageId] = { pageId, ...(await predict(documentId, pageNumber, { structured, report })) };
      } catch (error) {
        console.error(`[fetch] ${pageId} (page ${pageNumber}) failed: ${error.message}`);
      }
    }
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
})().catch((error) => {
  console.error(`[fetch] failed: ${error.message}`);
  process.exit(1);
});
