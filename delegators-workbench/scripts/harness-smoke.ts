import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { coalesceCompletionTurn, parseEmbeddedToolCalls } from '../server/embeddedToolCalls.js';
import { runWorkbenchHarness } from '../server/harnessOrchestrator.js';
import { sanitizeChatReply } from '../src/lib/artifactContinuation.js';
import { policyForModel } from '../server/workbenchTools.js';
import { createWorkspace, readWorkspaceText } from '../server/workspace.js';

const leaked = [
  'I have strong research data from the searches already completed. Let me build the deck now.',
  '<tool_call>',
  '<function=bash>',
  '<parameter=command>mkdir -p drafts && echo deck-ready > drafts/status.txt</parameter>',
  '<parameter=timeout>60</parameter>',
  '</function>',
  '</tool_call>'
].join(' ');

const finalArtifact = JSON.stringify({
  kind: 'deck',
  title: 'Harness Smoke Deck',
  audience: 'Board',
  tone: 'professional',
  slides: [{ title: 'Opening', bullets: ['Smoke test passed'] }],
  citations: [],
  nextQuestions: []
});

async function main() {
  const facts: string[] = [];
  const parsed = parseEmbeddedToolCalls(leaked);
  facts.push(`embedded_tool_calls=${parsed.toolCalls.length}`);
  facts.push(`embedded_tool_name=${parsed.toolCalls[0]?.function.name ?? 'none'}`);
  facts.push(`content_stripped=${!parsed.cleanedContent.includes('<tool_call')}`);
  facts.push(`sanitize_keeps_prose=${sanitizeChatReply(leaked).includes('Let me build the deck now.')}`);
  facts.push(`sanitize_strips_xml=${!sanitizeChatReply(leaked).includes('<tool_call')}`);

  const coalesced = coalesceCompletionTurn({ content: leaked, toolCalls: [] });
  facts.push(`coalesce_populates_tools=${coalesced.toolCalls.length === 1}`);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-harness-smoke-'));
  try {
    const workspace = await createWorkspace({
      sessionKey: 'sess_harness_smoke_1234567890',
      baseRoot: tempRoot
    });
    const turns = [
      { content: leaked, toolCalls: [] as never[] },
      { content: finalArtifact, toolCalls: [] as never[] }
    ];
    const output = await runWorkbenchHarness({
      messages: [{ role: 'user', content: 'Create a short board deck.' }],
      workspace,
      budget: policyForModel('swe-pro'),
      initialTemperature: 0.25,
      completeTurn: async () => {
        const next = turns.shift();
        if (!next) throw new Error('No mock turn left.');
        return next;
      }
    });

    const artifact = JSON.parse(output) as { kind?: string; title?: string };
    const status = (await readWorkspaceText(workspace, 'drafts/status.txt')).trim();
    facts.push(`harness_returns_artifact=${artifact.kind === 'deck'}`);
    facts.push(`harness_executed_bash=${status === 'deck-ready'}`);
    facts.push(`harness_output_has_no_xml=${!output.includes('<tool_call')}`);
    facts.push(`artifact_title=${artifact.title ?? 'missing'}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const failed = facts.filter((line) => line.endsWith('=false') || line.endsWith('=0') && !line.startsWith('embedded_tool_calls=1'));
  const pass = facts.every((line) => {
    if (line.startsWith('embedded_tool_calls=')) return line === 'embedded_tool_calls=1';
    if (line.startsWith('artifact_title=')) return !line.endsWith('=missing');
    return !line.endsWith('=false') && !(line.endsWith('=0') && line.includes('='));
  });

  console.log('HARNESS_SMOKE_FACTS');
  for (const fact of facts) console.log(fact);
  console.log(pass ? 'HARNESS_SMOKE_VERDICT=PASS' : 'HARNESS_SMOKE_VERDICT=FAIL');
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error('HARNESS_SMOKE_VERDICT=FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});