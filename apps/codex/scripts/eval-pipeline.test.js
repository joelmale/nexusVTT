// node --test apps/codex/scripts/eval-pipeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  characterErrorRate,
  paragraphOrderScore,
  iou,
  regionCounts,
  entityCounts,
  pearson,
  scoreGoldset,
  checkThresholds,
  loadGoldset,
  GOLDSET_DIR,
} = require('./eval-pipeline');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));
const label = read(path.join(GOLDSET_DIR, 'pages', 'synthetic-001.json'));
const prediction = read(path.join(GOLDSET_DIR, 'predictions-example', 'synthetic-001.json'));

test('the synthetic label matches the label schema shape', () => {
  const schema = read(path.join(GOLDSET_DIR, 'label.schema.json'));
  for (const key of schema.required) assert.ok(key in label, `missing ${key}`);
  assert.deepEqual(Object.keys(label).filter((key) => !(key in schema.properties)), []);
  for (const region of label.regions) assert.ok(schema.properties.regions.items.properties.class.enum.includes(region.class));
  assert.equal(label.source.synthetic, true);
});

test('CER ignores Markdown formatting and counts real character errors', () => {
  assert.equal(characterErrorRate('## Armor **Class** 14', 'Armor Class 14'), 0);
  assert.equal(characterErrorRate('Arrnor Class 14', 'Armor Class 14'), 2 / 14);
  assert.equal(characterErrorRate('', ''), 0);
});

test('paragraph order score is 1 for the same order and drops when paragraphs swap', () => {
  const gold = 'Alpha paragraph here.\n\nBravo paragraph here.\n\nCharlie paragraph here.';
  assert.equal(paragraphOrderScore(gold, gold).score, 1);
  const swapped = paragraphOrderScore('Bravo paragraph here.\n\nAlpha paragraph here.\n\nCharlie paragraph here.', gold);
  assert.ok(swapped.score < 1 && swapped.score > 0.5);
  assert.equal(paragraphOrderScore('Charlie paragraph here.\n\nBravo paragraph here.\n\nAlpha paragraph here.', gold).score, 0);
});

test('regions match per class at IoU >= 0.5', () => {
  assert.equal(iou([0, 0, 1, 1], [0, 0, 1, 1]), 1);
  assert.equal(iou([0, 0, 0.5, 1], [0.5, 0, 1, 1]), 0);
  const counts = regionCounts(prediction.regions, label.regions);
  assert.deepEqual(counts.stat_block, { tp: 1, gold: 1, predicted: 1 });
  assert.deepEqual(counts.art, { tp: 1, gold: 1, predicted: 1 });
  assert.deepEqual(counts.sidebar, { tp: 0, gold: 1, predicted: 0 }); // missed
  assert.deepEqual(counts.table, { tp: 0, gold: 0, predicted: 1 }); // spurious
});

test('entity scoring: recall, precision, numeric exactness, and wrong-and-unflagged', () => {
  const counts = entityCounts(prediction.entities, label.entities);
  assert.equal(counts.matched, 2);
  assert.equal(counts.gold, 2);
  assert.equal(counts.predicted, 3);
  assert.equal(counts.numericFields - counts.numericExact, 1); // HP 34 vs 32
  assert.equal(counts.wrong, 2); // misread HP + invented spell
  assert.equal(counts.wrongFlagged, 1); // the HP misread was flagged
  assert.deepEqual(counts.wrongUnflagged, ['spell:Smoke Step']);
  assert.equal(counts.groundingViolations, 1);
});

test('scoreGoldset aggregates the plan metrics for the synthetic example', () => {
  const scores = scoreGoldset([{ label, prediction }]);
  assert.ok(scores.readingOrder.cer > 0.01 && scores.readingOrder.cer < 0.1); // typo + swapped paragraphs
  assert.ok(scores.readingOrder.orderScore < 1);
  assert.equal(scores.entities.recall, 1);
  assert.equal(scores.entities.precision, 0.6667);
  assert.equal(scores.reviewFlags.flaggedShare, 0.5);
  assert.equal(scores.reviewFlags.wrongUnflagged, 1);
  assert.equal(scores.regions.sidebar.recall, 0);
  assert.equal(scores.cost.layoutSecondsPerPage, 4.1);

  const checks = checkThresholds(scores, read(path.join(GOLDSET_DIR, 'thresholds.json')));
  assert.equal(checks.find((c) => c.name === 'reviewFlags.wrongUnflagged').pass, false);
  assert.equal(checks.find((c) => c.name === 'entities.recall').pass, true);
});

test('a perfect prediction scores perfectly', () => {
  const perfect = {
    text: label.text,
    regions: label.regions,
    entities: label.entities.map((e) => ({ ...e, review: { status: 'auto', reasons: [] } })),
  };
  const scores = scoreGoldset([{ label, prediction: perfect }]);
  assert.equal(scores.readingOrder.cer, 0);
  assert.equal(scores.readingOrder.orderScore, 1);
  assert.equal(scores.entities.numericExact, 1);
  assert.equal(scores.reviewFlags.wrong, 0);
});

test('pearson correlation', () => {
  assert.equal(pearson([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(pearson([1, 2], [1, 2]), null);
});

test('held-out and draft pages are excluded unless asked for', () => {
  assert.equal(loadGoldset(GOLDSET_DIR, { goldset: 1, split: 'tuning', includeDrafts: false }).labels.length, 1);
  assert.equal(loadGoldset(GOLDSET_DIR, { goldset: 1, split: 'heldout', includeDrafts: false }).labels.length, 0);
  assert.throws(() => loadGoldset(GOLDSET_DIR, { goldset: 2, split: 'all' }), /version 1, not 2/);
});

test('CLI scores saved predictions and writes JSON + Markdown scorecards', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'goldset-'));
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'eval-pipeline.js'), '--goldset', '1', '--pipeline', 'v2', '--vlm', 'qwen2.5vl:7b', '--predictions', path.join(GOLDSET_DIR, 'predictions-example'), '--out', out, '--enforce'],
    { encoding: 'utf-8' }
  );
  assert.equal(result.status, 1, result.stderr); // --enforce: the example has a wrong-and-unflagged entity
  const files = fs.readdirSync(out).sort();
  assert.equal(files.length, 2);
  assert.match(files[0], /^goldset-1_v2_qwen2\.5vl-7b_tuning_.*\.json$/);
  const card = read(path.join(out, files[0]));
  assert.equal(card.pageCount, 1);
  assert.match(fs.readFileSync(path.join(out, files[1]), 'utf-8'), /\*\*Wrong and unflagged\*\* \| 1 \(spell:Smoke Step\)/);
});
