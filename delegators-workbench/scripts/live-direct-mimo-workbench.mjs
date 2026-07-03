#!/usr/bin/env node

const endpoint = process.env.WORKBENCH_LIVE_ENDPOINT || 'http://127.0.0.1:4199';
const mimoKey = process.env.MIMO_API_KEY;
const model = process.env.MIMO_MODEL || 'mimo-v2.5-pro';

if (!mimoKey || !mimoKey.startsWith('sk-')) {
  console.error('MIMO_API_KEY must be set in the environment and start with sk-.');
  process.exit(2);
}

const brief = [
  '@ppt Create a polished 6-slide executive deck for a fictional operations review using only these facts:',
  'Q1 revenue 120, Q2 revenue 148, support tickets reduced from 61 to 35,',
  'deployment frequency improved from 4 to 11 per month, and customer satisfaction moved from 7.8 to 8.6.',
  'Include exactly one metrics table with columns Metric, Before, After, Change.',
  'Include concise speaker notes and next questions for missing business context.',
  'Use available calculation and validation capabilities before final output.',
  'Do not mention implementation details in the final artifact.'
].join(' ');

const artifact = await postJson('/api/agent/artifact', {
  endpoint: 'https://api.xiaomimimo.com',
  sessionKey: mimoKey,
  model,
  skill: 'deck',
  style: 'executive',
  brief
});

const tableSection = artifact.sections?.find((section) => section.table);
const summary = {
  ok: true,
  title: artifact.title,
  kind: artifact.kind,
  sections: artifact.sections?.length ?? 0,
  slides: artifact.slides?.length ?? 0,
  nextQuestions: artifact.nextQuestions?.length ?? 0,
  hasMetricsTable: Boolean(tableSection),
  tableColumns: tableSection?.table?.columns ?? [],
  tableRows: tableSection?.table?.rows?.length ?? 0,
  containsBackendLeak: /\b(terminal|harness|workspace|artifact_validate|workspace_|terminal_run|web_fetch|web_search|tool call|tool result)\b/i.test(
    JSON.stringify(artifact)
  )
};

for (const format of ['pptx', 'pdf']) {
  const exported = await postBinary('/api/artifacts/export', { format, artifact });
  summary[`${format}Status`] = exported.status;
  summary[`${format}Bytes`] = exported.body.byteLength;
  summary[`${format}Signature`] = format === 'pdf'
    ? exported.body.subarray(0, 5).toString('utf8')
    : exported.body.subarray(0, 2).toString('hex');
}

console.log(JSON.stringify(summary, null, 2));

if (
  summary.kind !== 'deck' ||
  summary.slides !== 6 ||
  !summary.hasMetricsTable ||
  summary.tableRows < 4 ||
  summary.containsBackendLeak ||
  summary.pptxStatus !== 200 ||
  summary.pptxSignature !== '504b' ||
  summary.pdfStatus !== 200 ||
  summary.pdfSignature !== '%PDF-'
) {
  process.exit(1);
}

async function postJson(path, body) {
  const res = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed with HTTP ${res.status}: ${redact(text).slice(0, 1000)}`);
  }
  return JSON.parse(text);
}

async function postBinary(path, body) {
  const res = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return {
    status: res.status,
    body: Buffer.from(await res.arrayBuffer())
  };
}

function redact(value) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sess_[A-Za-z0-9]+/g, 'sess_[redacted]')
    .replace(/sk-[A-Za-z0-9]+/g, 'sk-[redacted]');
}
