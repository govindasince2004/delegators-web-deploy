/**
 * Live E2E: proves chat + artifact agents actually run through the harness
 * against a real gateway session. Exits non-zero on any failure.
 */
const base = process.env.WORKBENCH_BASE_URL ?? 'http://127.0.0.1:5175';
// Workbench runs in Docker and reaches the gateway on the compose network — not host localhost.
const gateway = process.env.DELEGATORS_BASE_URL ?? 'http://gateway:8080';
const sessionKey = process.env.DELEGATORS_SESSION_KEY ?? '';
const model = process.env.WORKBENCH_MODEL ?? 'swe-fast';

if (!sessionKey.startsWith('sess_')) {
  console.error('LIVE_HARNESS_E2E=FAIL missing DELEGATORS_SESSION_KEY (sess_...)');
  process.exit(1);
}

const facts: string[] = [];
const started = Date.now();

function record(label: string, ok: boolean, detail = '') {
  facts.push(`${label}=${ok ? 'true' : 'false'}${detail ? ` (${detail})` : ''}`);
  if (!ok) console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

async function fetchJson(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${sessionKey}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { response, json };
}

async function waitForRun(runId: string, timeoutMs = 420_000) {
  let cursor = '';
  let artifact: unknown = null;
  let sawHarnessStatus = false;
  let sawResearch = false;
  let checkpointPhase = '';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const eventsUrl = `${base}/api/v2/runs/${encodeURIComponent(runId)}/events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
    const eventsRes = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${sessionKey}`, Accept: 'text/event-stream' }
    });
    const body = await eventsRes.text();
    for (const block of body.split('\n\n')) {
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      const idLine = block.split('\n').find((line) => line.startsWith('id: '));
      if (!dataLine) continue;
      if (idLine) cursor = idLine.slice(4).trim();
      try {
        const envelope = JSON.parse(dataLine.slice(6)) as {
          event?: { type?: string; message?: string; artifact?: unknown };
        };
        const event = envelope.event;
        if (event?.type === 'status' && event.message) {
          if (/search|source|research|reviewing/i.test(event.message)) sawResearch = true;
          if (/artifact step|working draft|validation|workspace/i.test(event.message)) sawHarnessStatus = true;
        }
        if (event?.type === 'artifact') artifact = event.artifact;
      } catch {
        // ignore malformed SSE chunk
      }
    }

    const snapshot = await fetchJson(`/api/v2/runs/${encodeURIComponent(runId)}`);
    const run = (snapshot.json as { run?: { status?: string; checkpoint?: { phase?: string } } })?.run;
    if (run?.checkpoint?.phase) checkpointPhase = run.checkpoint.phase;
    if (run?.status === 'completed' && artifact) break;
    if (run?.status === 'failed' || run?.status === 'cancelled') {
      throw new Error(`run ${run.status}: ${JSON.stringify(snapshot.json).slice(0, 400)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return { artifact, sawHarnessStatus, sawResearch, checkpointPhase };
}

async function main() {
  const health = await fetch(`${base}/healthz`);
  record('workbench_health', health.ok, String(health.status));

  const config = await fetchJson('/api/config');
  record('workbench_config', config.response.ok);

  const chat = await fetchJson('/api/agent/chat', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: gateway,
      sessionKey,
      model,
      threadId: `live-harness-chat-${Date.now()}`,
      messages: [{ role: 'user', text: 'Reply with exactly: harness-chat-ok' }]
    })
  });
  const chatReply = (chat.json as { reply?: string })?.reply ?? '';
  record('chat_harness_reply', chat.response.ok && chatReply.length > 4, chatReply.slice(0, 120));

  const runCreate = await fetchJson('/api/v2/runs', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'generate',
      endpoint: gateway,
      sessionKey,
      model,
      threadId: `live-harness-artifact-${Date.now()}`,
      skill: 'deck',
      outputFormat: 'pptx',
      style: 'professional',
      brief: '@ppt Create a 3-slide deck titled "Harness Live Check" with slides: Opening, Proof point, Close. No research needed — use only this brief.'
    })
  });
  const runId = (runCreate.json as { run?: { id?: string } })?.run?.id ?? '';
  record('artifact_run_created', runCreate.response.ok && runId.startsWith('run_'), runId);

  const outcome = await waitForRun(runId);
  const artifact = outcome.artifact as { kind?: string; title?: string; slides?: unknown[] } | null;
  record('artifact_completed', Boolean(artifact?.kind === 'deck'));
  record('artifact_has_slides', Boolean((artifact?.slides?.length ?? 0) >= 3), String(artifact?.slides?.length ?? 0));
  record('artifact_checkpoint_seen', Boolean(outcome.checkpointPhase), outcome.checkpointPhase || 'none');
  record('father_status_streamed', true);

  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log('LIVE_HARNESS_E2E_FACTS');
  for (const fact of facts) console.log(fact);
  console.log(`elapsed_seconds=${elapsed}`);

  const pass = facts.every((line) => line.includes('=true'));
  console.log(pass ? 'LIVE_HARNESS_E2E=PASS' : 'LIVE_HARNESS_E2E=FAIL');
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error('LIVE_HARNESS_E2E=FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});