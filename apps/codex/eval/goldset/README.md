# Codex ingestion gold set

Human-verified answer keys for rulebook pages, used to score the ingestion pipeline.
How to label, verify, freeze and score: [`apps/docs/codex/goldset-review.md`](../../../docs/codex/goldset-review.md).

- `goldset.json`: version, status (`draft` or `frozen`), sources (by file hash) and pages.
- `label.schema.json`: the label format.
- `pages/<id>.json`: one label per page. `synthetic-001` is a hand-made example.
- `thresholds.json`: provisional go/no-go lines for `scripts/eval-pipeline.js --enforce`.
- `predictions-example/`: sample pipeline output for `synthetic-001`, in the format
  `--predictions` reads and `--save-predictions` writes.

Source PDFs and page images are not committed. They live in the server's `codex-eval`
bucket, named by SHA-256.
