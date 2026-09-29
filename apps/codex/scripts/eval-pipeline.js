#!/usr/bin/env node
/**
 * Gold-set scorecard for the Codex ingestion pipeline
 * (apps/docs/codex/ingestion-pipeline-v2-plan.md#gold-set-benchmark-harness,
 * reviewer guide: apps/docs/codex/goldset-review.md).
 *
 * Usage:
 *   node scripts/eval-pipeline.js --goldset 1 --pipeline v2 --vlm qwen2.5vl:7b [--api http://localhost:3005]
 *   node scripts/eval-pipeline.js --goldset 1 --predictions eval/goldset/predictions-example
 *
 * Options:
 *   --goldset N            gold-set version (must match eval/goldset/goldset.json)
 *   --pipeline v1|v2       label for the scorecard; v2 predictions come from doc-api
 *   --vlm MODEL            label for the scorecard (the model that produced the run)
 *   --api URL              doc-api base URL (default http://localhost:3005), like the other eval scripts
 *   --map FILE             JSON {"<sha256>": "<documentId>"} when goldset.json has no documentId
 *   --predictions DIR      score saved predictions (<pageId>.json) instead of calling doc-api
 *   --save-predictions DIR write the predictions fetched from doc-api, to re-score later
 *   --split tuning|heldout|all   default tuning; held-out pages are only for the final go/no-go
 *   --include-drafts       also score pages whose label is not yet verified
 *   --out DIR              scorecard directory (default eval/results)
 *   --enforce              exit 1 when a threshold in eval/goldset/thresholds.json is missed
 *
 * v1 has no per-page text, so a v1 run needs --predictions. Scoring v1 is optional:
 * v2 runs are judged against the fixed thresholds.
 */
const fs = require('fs');
const path = require('path');

const CODEX_DIR = path.resolve(__dirname, '..');
const GOLDSET_DIR = path.join(CODEX_DIR, 'eval', 'goldset');
const DEFAULT_API_BASE = 'http://localhost:3005';
const IOU_MATCH = 0.5;
const REGION_CLASSES = ['stat_block', 'sidebar', 'table', 'art'];

// ---------------------------------------------------------------- metrics

/** Strip Markdown syntax and collapse whitespace so formatting is not scored as text. */
const normalizeText = (text) =>
  String(text || '')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/^\s*-{3,}\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
};

/** Character error rate of the prediction against the gold reading-order text. */
const characterErrorRate = (predicted, gold) => {
  const g = normalizeText(gold);
  if (!g.length) return normalizeText(predicted).length ? 1 : 0;
  return levenshtein(normalizeText(predicted), g) / g.length;
};

const similarity = (a, b) => {
  const x = normalizeText(a).toLowerCase();
  const y = normalizeText(b).toLowerCase();
  const longest = Math.max(x.length, y.length);
  return longest === 0 ? 1 : 1 - levenshtein(x, y) / longest;
};

const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map(normalizeText).filter(Boolean);

/**
 * Paragraph order score: each gold paragraph is matched to its most similar
 * predicted paragraph (similarity >= 0.6); Kendall's tau between gold order and
 * matched predicted positions, mapped to 0..1 (1 = same order).
 */
const paragraphOrderScore = (predicted, gold) => {
  const goldParas = paragraphs(gold);
  const predParas = paragraphs(predicted);
  const positions = [];
  const used = new Set();
  for (const para of goldParas) {
    let best = -1;
    let bestScore = 0.6;
    predParas.forEach((candidate, index) => {
      if (used.has(index)) return;
      const score = similarity(para, candidate);
      if (score >= bestScore) {
        best = index;
        bestScore = score;
      }
    });
    if (best >= 0) {
      used.add(best);
      positions.push(best);
    }
  }
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      if (positions[j] > positions[i]) concordant += 1;
      else discordant += 1;
    }
  }
  const pairs = concordant + discordant;
  return {
    score: pairs === 0 ? (positions.length ? 1 : 0) : (concordant - discordant) / pairs / 2 + 0.5,
    matched: positions.length,
    total: goldParas.length,
  };
};

const iou = (a, b) => {
  const x0 = Math.max(a[0], b[0]);
  const y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[2], b[2]);
  const y1 = Math.min(a[3], b[3]);
  const intersection = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const area = (box) => Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
  const union = area(a) + area(b) - intersection;
  return union > 0 ? intersection / union : 0;
};

/** Per class: true positives, gold count and predicted count at IoU >= 0.5 (greedy by IoU). */
const regionCounts = (predicted, gold) => {
  const counts = {};
  for (const cls of REGION_CLASSES) {
    const g = gold.filter((r) => r.class === cls);
    const p = predicted.filter((r) => r.class === cls);
    const pairs = [];
    g.forEach((gr, gi) => p.forEach((pr, pi) => pairs.push({ gi, pi, overlap: iou(gr.bbox, pr.bbox) })));
    pairs.sort((a, b) => b.overlap - a.overlap);
    const gUsed = new Set();
    const pUsed = new Set();
    let tp = 0;
    for (const pair of pairs) {
      if (pair.overlap < IOU_MATCH || gUsed.has(pair.gi) || pUsed.has(pair.pi)) continue;
      gUsed.add(pair.gi);
      pUsed.add(pair.pi);
      tp += 1;
    }
    counts[cls] = { tp, gold: g.length, predicted: p.length };
  }
  return counts;
};

const normalizeName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Leaf values by dotted path, e.g. abilities.str -> 20, actions.0.name -> "Bite". */
const flatten = (value, prefix = '', out = {}) => {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  } else if (prefix) {
    out[prefix] = value;
  }
  return out;
};

const PROSE_MIN_LENGTH = 40;

/**
 * Entity scoring for one page. Entities match on type + normalized name.
 * Numbers must match exactly; long strings (prose) score by similarity; short
 * strings must match after normalization. An entity is "wrong" when it is
 * invented (no gold match) or any number differs; wrong-and-unflagged (review
 * status auto) is the worst outcome.
 */
const entityCounts = (predicted, gold) => {
  const result = {
    gold: gold.length,
    predicted: predicted.length,
    matched: 0,
    numericFields: 0,
    numericExact: 0,
    shortFields: 0,
    shortExact: 0,
    proseSimilaritySum: 0,
    proseFields: 0,
    wrong: 0,
    wrongFlagged: 0,
    wrongUnflagged: [],
    groundingViolations: 0,
  };
  const used = new Set();
  for (const entity of predicted) {
    const flagged = entity.review?.status === 'needs_review';
    if ((entity.review?.reasons || []).some((reason) => String(reason).startsWith('ungrounded:'))) result.groundingViolations += 1;
    const goldIndex = gold.findIndex(
      (g, index) => !used.has(index) && g.type === entity.type && normalizeName(g.data?.name) === normalizeName(entity.data?.name)
    );
    let wrong = false;
    if (goldIndex < 0) {
      wrong = true; // invented, or a name the model got wrong
    } else {
      used.add(goldIndex);
      result.matched += 1;
      const goldFields = flatten(gold[goldIndex].data);
      const predFields = flatten(entity.data);
      for (const [field, expected] of Object.entries(goldFields)) {
        const actual = predFields[field];
        if (typeof expected === 'number') {
          result.numericFields += 1;
          if (actual === expected) result.numericExact += 1;
          else wrong = true;
        } else if (typeof expected === 'string' && expected.length >= PROSE_MIN_LENGTH) {
          result.proseFields += 1;
          result.proseSimilaritySum += actual === undefined ? 0 : similarity(String(actual), expected);
        } else if (expected !== null && expected !== undefined) {
          result.shortFields += 1;
          if (normalizeText(String(actual ?? '')).toLowerCase() === normalizeText(String(expected)).toLowerCase()) result.shortExact += 1;
        }
      }
    }
    if (wrong) {
      result.wrong += 1;
      if (flagged) result.wrongFlagged += 1;
      else result.wrongUnflagged.push(`${entity.type}:${entity.data?.name}`);
    }
  }
  return result;
};

const pearson = (xs, ys) => {
  const n = xs.length;
  if (n < 3) return null;
  const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
};

const ratio = (numerator, denominator) => (denominator ? numerator / denominator : null);
const round = (value, digits = 4) => (value === null || value === undefined ? null : Math.round(value * 10 ** digits) / 10 ** digits);

/** Scores every page and aggregates the plan's metric table. */
const scoreGoldset = (pairs) => {
  const pages = [];
  const regionTotals = Object.fromEntries(REGION_CLASSES.map((cls) => [cls, { tp: 0, gold: 0, predicted: 0 }]));
  const entityTotals = entityCounts([], []);
  const cerForCorrelation = [];
  const validityForCorrelation = [];
  const layoutMs = [];
  const extractMs = [];

  for (const { label, prediction } of pairs) {
    const cer = characterErrorRate(prediction.text, label.text);
    const order = paragraphOrderScore(prediction.text, label.text);
    const regions = regionCounts(prediction.regions || [], label.regions || []);
    const entities = entityCounts(prediction.entities || [], label.entities || []);
    for (const cls of REGION_CLASSES) {
      for (const key of ['tp', 'gold', 'predicted']) regionTotals[cls][key] += regions[cls][key];
    }
    for (const [key, value] of Object.entries(entities)) {
      entityTotals[key] = Array.isArray(value) ? [...entityTotals[key], ...value] : entityTotals[key] + value;
    }
    const validity = prediction.quality?.wordValidity;
    if (typeof validity === 'number') {
      cerForCorrelation.push(cer);
      validityForCorrelation.push(validity);
    }
    if (prediction.timing?.layoutMsPerPage) layoutMs.push(prediction.timing.layoutMsPerPage);
    if (prediction.timing?.extractMsPerPage) extractMs.push(prediction.timing.extractMsPerPage);
    pages.push({
      id: label.id,
      category: label.category,
      heldOut: label.heldOut,
      cer: round(cer),
      orderScore: round(order.score),
      paragraphsMatched: `${order.matched}/${order.total}`,
      entities: { gold: entities.gold, predicted: entities.predicted, matched: entities.matched, wrongUnflagged: entities.wrongUnflagged },
      wordValidity: validity ?? null,
    });
  }

  const average = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
  return {
    pages,
    readingOrder: {
      cer: round(average(pages.map((p) => p.cer))),
      orderScore: round(average(pages.map((p) => p.orderScore))),
    },
    regions: Object.fromEntries(
      REGION_CLASSES.map((cls) => [cls, {
        precision: round(ratio(regionTotals[cls].tp, regionTotals[cls].predicted)),
        recall: round(ratio(regionTotals[cls].tp, regionTotals[cls].gold)),
        gold: regionTotals[cls].gold,
      }])
    ),
    entities: {
      recall: round(ratio(entityTotals.matched, entityTotals.gold)),
      precision: round(ratio(entityTotals.matched, entityTotals.predicted)),
      numericExact: round(ratio(entityTotals.numericExact, entityTotals.numericFields)),
      shortFieldExact: round(ratio(entityTotals.shortExact, entityTotals.shortFields)),
      proseSimilarity: round(ratio(entityTotals.proseSimilaritySum, entityTotals.proseFields)),
      groundingViolationRate: round(ratio(entityTotals.groundingViolations, entityTotals.predicted)),
    },
    reviewFlags: {
      wrong: entityTotals.wrong,
      flaggedShare: round(ratio(entityTotals.wrongFlagged, entityTotals.wrong)),
      wrongUnflagged: entityTotals.wrongUnflagged.length,
      wrongUnflaggedEntities: entityTotals.wrongUnflagged,
    },
    cost: {
      layoutSecondsPerPage: round(average(layoutMs) === null ? null : average(layoutMs) / 1000, 2),
      extractSecondsPerPage: round(average(extractMs) === null ? null : average(extractMs) / 1000, 2),
      peakVramMb: null, // measured on the server (Phase 0); not visible to this script
    },
    qualityProxy: {
      wordValidityVsCer: round(pearson(validityForCorrelation, cerForCorrelation)),
      pages: validityForCorrelation.length,
    },
  };
};

/** Pass/fail per threshold line (thresholds.json). */
const checkThresholds = (scores, thresholds) => {
  const checks = [];
  const check = (name, value, limit, kind) => {
    if (value === null || value === undefined || limit === undefined) return;
    checks.push({ name, value, limit, pass: kind === 'max' ? value <= limit : value >= limit });
  };
  check('readingOrder.cer', scores.readingOrder.cer, thresholds.readingOrder?.maxCer, 'max');
  check('readingOrder.orderScore', scores.readingOrder.orderScore, thresholds.readingOrder?.minOrderScore, 'min');
  for (const cls of REGION_CLASSES) {
    if (!scores.regions[cls].gold) continue;
    check(`regions.${cls}.recall`, scores.regions[cls].recall, thresholds.regions?.minRecall?.[cls], 'min');
    check(`regions.${cls}.precision`, scores.regions[cls].precision, thresholds.regions?.minPrecision?.[cls], 'min');
  }
  check('entities.recall', scores.entities.recall, thresholds.entities?.minRecall, 'min');
  check('entities.precision', scores.entities.precision, thresholds.entities?.minPrecision, 'min');
  check('entities.numericExact', scores.entities.numericExact, thresholds.entities?.minNumericExact, 'min');
  check('reviewFlags.wrongUnflagged', scores.reviewFlags.wrongUnflagged, thresholds.entities?.maxWrongUnflagged, 'max');
  return checks;
};

const fmt = (value) => (value === null || value === undefined ? 'n/a' : typeof value === 'number' ? String(value) : value);

const toMarkdown = (card) => {
  const s = card.scores;
  const lines = [
    `# Gold-set scorecard: goldset@${card.goldset} · ${card.pipeline} · ${card.vlm}`,
    '',
    `Run ${card.createdAt} · split \`${card.split}\` · ${card.pageCount} pages · source \`${card.source}\``,
    '',
    '| Area | Metric | Value |',
    '|---|---|---|',
    `| Reading order | CER (lower is better) | ${fmt(s.readingOrder.cer)} |`,
    `| Reading order | Paragraph order score | ${fmt(s.readingOrder.orderScore)} |`,
    ...REGION_CLASSES.map((cls) => `| Regions | ${cls} precision / recall (IoU >= ${IOU_MATCH}) | ${fmt(s.regions[cls].precision)} / ${fmt(s.regions[cls].recall)} (${s.regions[cls].gold} gold) |`),
    `| Entities | Recall / precision | ${fmt(s.entities.recall)} / ${fmt(s.entities.precision)} |`,
    `| Entities | Numeric fields exact | ${fmt(s.entities.numericExact)} |`,
    `| Entities | Short fields exact / prose similarity | ${fmt(s.entities.shortFieldExact)} / ${fmt(s.entities.proseSimilarity)} |`,
    `| Entities | Grounding-violation rate | ${fmt(s.entities.groundingViolationRate)} |`,
    `| Review flags | Wrong entities flagged | ${fmt(s.reviewFlags.flaggedShare)} of ${s.reviewFlags.wrong} |`,
    `| Review flags | **Wrong and unflagged** | ${s.reviewFlags.wrongUnflagged}${s.reviewFlags.wrongUnflaggedEntities.length ? ` (${s.reviewFlags.wrongUnflaggedEntities.join(', ')})` : ''} |`,
    `| Cost | Layout / extract seconds per page | ${fmt(s.cost.layoutSecondsPerPage)} / ${fmt(s.cost.extractSecondsPerPage)} |`,
    `| Quality proxy | Pearson(wordValidity, CER) over ${s.qualityProxy.pages} pages | ${fmt(s.qualityProxy.wordValidityVsCer)} |`,
    '',
  ];
  if (card.thresholds.length) {
    lines.push('## Thresholds (provisional)', '', '| Check | Value | Limit | Result |', '|---|---|---|---|');
    for (const c of card.thresholds) lines.push(`| ${c.name} | ${c.value} | ${c.limit} | ${c.pass ? 'pass' : '**FAIL**'} |`);
    lines.push('');
  }
  lines.push('## Pages', '', '| Page | Category | CER | Order | Entities (matched/gold/pred) | Wrong & unflagged |', '|---|---|---|---|---|---|');
  for (const p of s.pages) {
    lines.push(`| ${p.id}${p.heldOut ? ' (held out)' : ''} | ${p.category} | ${fmt(p.cer)} | ${fmt(p.orderScore)} | ${p.entities.matched}/${p.entities.gold}/${p.entities.predicted} | ${p.entities.wrongUnflagged.join(', ') || '-'} |`);
  }
  return `${lines.join('\n')}\n`;
};

// ---------------------------------------------------------------- inputs

const parseArgs = (argv) => {
  const options = {
    goldset: null,
    pipeline: 'v2',
    vlm: 'unknown',
    api: DEFAULT_API_BASE,
    map: null,
    predictions: null,
    savePredictions: null,
    split: 'tuning',
    includeDrafts: false,
    out: path.join(CODEX_DIR, 'eval', 'results'),
    enforce: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--goldset') options.goldset = Number(next());
    else if (arg === '--pipeline') options.pipeline = next();
    else if (arg === '--vlm') options.vlm = next();
    else if (arg === '--api') options.api = next();
    else if (arg === '--map') options.map = next();
    else if (arg === '--predictions') options.predictions = next();
    else if (arg === '--save-predictions') options.savePredictions = next();
    else if (arg === '--split') options.split = next();
    else if (arg === '--include-drafts') options.includeDrafts = true;
    else if (arg === '--out') options.out = next();
    else if (arg === '--enforce') options.enforce = true;
  }
  return options;
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));

const loadGoldset = (goldsetDir, options) => {
  const manifest = readJson(path.join(goldsetDir, 'goldset.json'));
  if (options.goldset !== null && manifest.version !== options.goldset) {
    throw new Error(`goldset.json is version ${manifest.version}, not ${options.goldset}`);
  }
  const labels = manifest.pages.map((entry) => readJson(path.join(goldsetDir, entry.file)));
  const selected = labels.filter((label) => {
    if (!options.includeDrafts && label.status !== 'verified') return false;
    if (options.split === 'tuning') return !label.heldOut;
    if (options.split === 'heldout') return label.heldOut;
    return true;
  });
  return { manifest, labels: selected };
};

const requestJson = async (url) => {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error || response.statusText} (${url})`);
  return payload;
};

/** Pipeline output for one gold page, fetched from doc-api (v2 DocumentPage + StructuredData). */
const fetchPrediction = async (api, documentId, pageNumber, cache) => {
  const base = api.replace(/\/$/, '');
  const page = await requestJson(`${base}/api/admin/processing/${documentId}/pages/${pageNumber}`);
  if (!cache.has(documentId)) {
    const [structured, report] = await Promise.all([
      requestJson(`${base}/api/documents/${documentId}/structured-data`),
      requestJson(`${base}/api/admin/processing/report/${documentId}`),
    ]);
    cache.set(documentId, { structured, report });
  }
  const { structured, report } = cache.get(documentId);
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
    timing: {
      layoutMsPerPage: stages.layout?.durationMs ? stages.layout.durationMs / pageCount : undefined,
      extractMsPerPage: stages.extract?.durationMs ? stages.extract.durationMs / pageCount : undefined,
    },
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { manifest, labels } = loadGoldset(GOLDSET_DIR, options);
  if (labels.length === 0) {
    console.error(`[eval-pipeline] No ${options.includeDrafts ? '' : 'verified '}pages in split "${options.split}".`);
    process.exit(1);
  }
  if (options.pipeline === 'v1' && !options.predictions) {
    console.error('[eval-pipeline] v1 has no per-page text in doc-api; pass --predictions with exported v1 output.');
    process.exit(1);
  }

  const mapping = options.map ? readJson(options.map) : {};
  const cache = new Map();
  const pairs = [];
  for (const label of labels) {
    let prediction;
    if (options.predictions) {
      const file = path.join(options.predictions, `${label.id}.json`);
      prediction = fs.existsSync(file) ? readJson(file) : { text: '', regions: [], entities: [] };
    } else {
      const documentId = manifest.sources?.[label.source.sha256]?.documentId || mapping[label.source.sha256];
      if (!documentId) throw new Error(`No documentId for source ${label.source.sha256}; add it to goldset.json or --map`);
      prediction = await fetchPrediction(options.api, documentId, label.source.pageNumber, cache);
      if (options.savePredictions) {
        fs.mkdirSync(options.savePredictions, { recursive: true });
        fs.writeFileSync(path.join(options.savePredictions, `${label.id}.json`), `${JSON.stringify({ pageId: label.id, ...prediction }, null, 2)}\n`);
      }
    }
    pairs.push({ label, prediction });
  }

  const scores = scoreGoldset(pairs);
  const thresholds = checkThresholds(scores, readJson(path.join(GOLDSET_DIR, 'thresholds.json')));
  const card = {
    goldset: manifest.version,
    goldsetStatus: manifest.status,
    pipeline: options.pipeline,
    vlm: options.vlm,
    split: options.split,
    source: options.predictions ? path.relative(CODEX_DIR, path.resolve(options.predictions)) : options.api,
    createdAt: new Date().toISOString(),
    pageCount: labels.length,
    scores,
    thresholds,
  };

  fs.mkdirSync(options.out, { recursive: true });
  const stamp = card.createdAt.replace(/[:.]/g, '-');
  const name = `goldset-${card.goldset}_${card.pipeline}_${String(card.vlm).replace(/[^a-z0-9.-]+/gi, '-')}_${card.split}_${stamp}`;
  fs.writeFileSync(path.join(options.out, `${name}.json`), `${JSON.stringify(card, null, 2)}\n`);
  fs.writeFileSync(path.join(options.out, `${name}.md`), toMarkdown(card));
  process.stdout.write(toMarkdown(card));
  console.log(`[eval-pipeline] Wrote ${path.join(options.out, name)}.{json,md}`);

  if (options.enforce && thresholds.some((c) => !c.pass)) process.exit(1);
};

module.exports = {
  normalizeText,
  levenshtein,
  characterErrorRate,
  paragraphOrderScore,
  iou,
  regionCounts,
  entityCounts,
  pearson,
  scoreGoldset,
  checkThresholds,
  toMarkdown,
  parseArgs,
  loadGoldset,
  GOLDSET_DIR,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`[eval-pipeline] ${error.message}`);
    process.exit(1);
  });
}
