#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DEFAULT_API_BASE = 'http://localhost:3005';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    file: '',
    api: DEFAULT_API_BASE,
    title: '',
    type: 'rulebook',
    uploadedBy: 'benchmark-user',
    pollMs: 3000,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file') options.file = args[i + 1];
    if (arg === '--api') options.api = args[i + 1];
    if (arg === '--title') options.title = args[i + 1];
    if (arg === '--type') options.type = args[i + 1];
    if (arg === '--uploadedBy') options.uploadedBy = args[i + 1];
    if (arg === '--pollMs') options.pollMs = Number(args[i + 1]);
  }

  return options;
};

const getFormat = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  return 'pdf';
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = payload.error || payload.details || response.statusText;
    throw new Error(`${response.status} ${details}`);
  }
  return payload;
};

const findLog = (logs, pattern) => logs.find((log) => pattern.test(log.message));

const stageDuration = (start, end) => {
  if (!start || !end) return null;
  const startTs = new Date(start.timestamp).getTime();
  const endTs = new Date(end.timestamp).getTime();
  return endTs - startTs;
};

const main = async () => {
  const options = parseArgs();

  if (!options.file) {
    console.error('Usage: node scripts/benchmark-ingest.js --file /path/to/doc.pdf [--api http://localhost:3005]');
    process.exit(1);
  }

  const filePath = path.resolve(options.file);
  const stat = fs.statSync(filePath);
  const format = getFormat(filePath);
  const title = options.title || path.basename(filePath, path.extname(filePath));

  console.log(`[benchmark] api=${options.api}`);
  console.log(`[benchmark] file=${filePath} size=${stat.size} format=${format}`);

  const createStart = Date.now();
  const createPayload = await requestJson(`${options.api}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description: 'Benchmark ingest',
      type: options.type,
      format,
      author: '',
      uploadedBy: options.uploadedBy,
      tags: [],
      campaigns: [],
      collections: [],
      isPublic: false,
      metadata: {},
      fileSize: stat.size,
      fileName: path.basename(filePath),
    }),
  });
  const createDuration = Date.now() - createStart;

  console.log(`[benchmark] created document id=${createPayload.document.id} in ${createDuration}ms`);

  const uploadStart = Date.now();
  const fileBuffer = fs.readFileSync(filePath);
  const uploadResponse = await fetch(createPayload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': format === 'markdown' ? 'text/markdown' : 'application/pdf' },
    body: fileBuffer,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
  const uploadDuration = Date.now() - uploadStart;
  console.log(`[benchmark] uploaded file in ${uploadDuration}ms`);

  const processStart = Date.now();
  const processPayload = await requestJson(`${options.api}/api/documents/${createPayload.document.id}/process`, {
    method: 'POST',
  });
  const processQueueDuration = Date.now() - processStart;
  const jobId = processPayload.jobId;
  console.log(`[benchmark] queued job id=${jobId} in ${processQueueDuration}ms`);

  let status = 'processing';
  let statusPayload = null;
  while (status === 'processing') {
    await sleep(options.pollMs);
    statusPayload = await requestJson(`${options.api}/api/documents/${createPayload.document.id}/processing-status`);
    status = statusPayload.status;
    console.log(`[benchmark] status=${status}`);
  }

  const totalDuration = Date.now() - processStart;

  const logsPayload = await requestJson(`${options.api}/api/admin/queue/jobs/${jobId}/logs`);
  const logs = logsPayload.logs || [];

  const contentHashLog = findLog(logs, /Content hash calculated/i);
  const contentHash = contentHashLog ? contentHashLog.message.split(':').pop().trim() : 'n/a';

  const extractStart = findLog(logs, /Extracting text from/i);
  const extractEnd = findLog(logs, /Extracted text:/i);

  const ocrStart = findLog(logs, /Running OCR/i);
  const ocrEnd = findLog(logs, /OCR completed|OCR failed/i);

  const renderStart = findLog(logs, /Rendering page images/i);
  const renderEnd = findLog(logs, /Uploaded \d+ page images|Page image rendering failed/i);

  const thumbnailStart = findLog(logs, /Generating thumbnail/i);
  const thumbnailEnd = findLog(logs, /Thumbnail uploaded successfully|Thumbnail generation failed/i);

  const indexStart = findLog(logs, /Indexing document in ElasticSearch/i);
  const indexEnd = findLog(logs, /Document indexed with ID/i);

  const extractStructuredStart = findLog(logs, /Extracting structured data/i);
  const extractStructuredEnd = findLog(logs, /Structured data saved successfully|Saving \d+ structured data entries/i);

  const stageTimings = [
    ['extract', stageDuration(extractStart, extractEnd)],
    ['ocr', stageDuration(ocrStart, ocrEnd)],
    ['render_pages', stageDuration(renderStart, renderEnd)],
    ['thumbnail', stageDuration(thumbnailStart, thumbnailEnd)],
    ['index', stageDuration(indexStart, indexEnd)],
    ['structured_extract', stageDuration(extractStructuredStart, extractStructuredEnd)],
  ];

  console.log('\n[benchmark] results');
  console.log(`- documentId: ${createPayload.document.id}`);
  console.log(`- contentHash: ${contentHash}`);
  console.log(`- totalProcessingMs: ${totalDuration}`);
  stageTimings.forEach(([name, duration]) => {
    if (duration !== null) {
      console.log(`- ${name}Ms: ${duration}`);
    } else {
      console.log(`- ${name}Ms: n/a`);
    }
  });
};

main().catch((error) => {
  console.error(`[benchmark] failed: ${error.message}`);
  process.exit(1);
});
