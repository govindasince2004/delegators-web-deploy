import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  compactToolResult,
  createToolState,
  executeWorkbenchTool,
  policyForArtifact,
  policyForModel,
  safeWebFetch,
  webSearch,
  type ToolBudget,
  type ToolCall
} from '../server/workbenchTools';
import { clearSearchCache } from '../server/searchCache';
import { createWorkspace, listWorkspace, readWorkspaceText } from '../server/workspace';

let tempRoot = '';
let oldNodeEnv: string | undefined;
let oldMode: string | undefined;
let oldUnsafe: string | undefined;

beforeEach(async () => {
  clearSearchCache();
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-tools-test-'));
  oldNodeEnv = process.env.NODE_ENV;
  oldMode = process.env.WORKBENCH_TERMINAL_MODE;
  oldUnsafe = process.env.WORKBENCH_TERMINAL_LOCAL_UNSAFE;
  process.env.NODE_ENV = 'test';
  process.env.WORKBENCH_TERMINAL_MODE = 'local';
  delete process.env.WORKBENCH_TERMINAL_LOCAL_UNSAFE;
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
  restoreEnv('NODE_ENV', oldNodeEnv);
  restoreEnv('WORKBENCH_TERMINAL_MODE', oldMode);
  restoreEnv('WORKBENCH_TERMINAL_LOCAL_UNSAFE', oldUnsafe);
});

const budget: ToolBudget = {
  maxToolCalls: 5,
  maxTerminalRuns: 1,
  maxWebRequests: 1,
  timeoutMs: 10_000,
  maxToolResultBytes: 4_000
};

describe('Workbench tool execution', () => {
  it('runs a local Node script inside the workspace and captures created files', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    const result = await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: toolCall('terminal_run', {
        runtime: 'node',
        code: "import fs from 'node:fs'; fs.writeFileSync('answer.txt', '42'); console.log('done');"
      })
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.data)).toContain('answer.txt');
    await expect(readWorkspaceText(workspace, 'answer.txt')).resolves.toBe('42');
  });

  it('counts each terminal_run once against the terminal budget', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    const state = createToolState();
    const twoRunBudget = { ...budget, maxToolCalls: 4, maxTerminalRuns: 2 };

    const first = await executeWorkbenchTool({
      workspace,
      budget: twoRunBudget,
      state,
      call: toolCall('terminal_run', { runtime: 'node', code: "console.log('one')" })
    });
    const second = await executeWorkbenchTool({
      workspace,
      budget: twoRunBudget,
      state,
      call: toolCall('terminal_run', { runtime: 'node', code: "console.log('two')" })
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(state.terminalRuns).toBe(2);
  });

  it('marks non-zero terminal exits as tool failures', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    const result = await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: toolCall('terminal_run', {
        runtime: 'node',
        code: "console.error('boom'); process.exit(2);"
      })
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/exited with code 2/i);
  });

  it('blocks local terminal execution in production unless explicitly unsafe', async () => {
    process.env.NODE_ENV = 'production';
    process.env.WORKBENCH_TERMINAL_MODE = 'local';
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    const result = await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: toolCall('terminal_run', { runtime: 'node', code: "console.log('nope')" })
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/requires WORKBENCH_TERMINAL_MODE=docker/);
  });

  it('enforces per-session tool budgets', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    const state = createToolState();
    const tinyBudget = { ...budget, maxToolCalls: 1 };

    const first = await executeWorkbenchTool({
      workspace,
      budget: tinyBudget,
      state,
      call: toolCall('workspace_list', {})
    });
    const second = await executeWorkbenchTool({
      workspace,
      budget: tinyBudget,
      state,
      call: toolCall('workspace_list', {})
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.summary).toMatch(/budget exhausted/);
  });

  it('validates artifact JSON and reports exportable formats', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    const artifact = {
      kind: 'deck',
      title: 'Investor Update',
      audience: 'Founders',
      tone: 'executive',
      sections: [{ heading: 'Progress', body: 'Revenue grew from verified source data.', bullets: ['Pipeline improved'] }],
      slides: [{ title: 'Progress', bullets: ['Pipeline improved'] }],
      citations: [],
      nextQuestions: []
    };

    const result = await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: toolCall('artifact_validate', { json: JSON.stringify(artifact), expectedKind: 'deck' })
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.data)).toContain('"valid":true');
    expect(JSON.stringify(result.data)).toContain('pptx');
  });

  it('exports real artifact files into the workspace for all supported formats', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot,
      limits: { maxFileBytes: 2_000_000, maxTotalBytes: 10_000_000 }
    });
    const artifact = {
      kind: 'deck',
      title: 'Quarterly Review',
      audience: 'Leadership',
      tone: 'executive',
      executiveSummary: 'Validated quarterly progress summary.',
      sections: [{
        heading: 'Progress',
        body: 'The team shipped the core milestone.',
        bullets: ['Revenue dashboard completed', 'Support queue reduced'],
        table: {
          columns: ['Metric', 'Value'],
          rows: [['Revenue', '120'], ['Tickets', '35']]
        }
      }],
      slides: [{ title: 'Progress', bullets: ['Revenue dashboard completed', 'Support queue reduced'] }],
      sheet: {
        sheets: [{
          name: 'Metrics',
          columns: ['Metric', 'Value'],
          rows: [['Revenue', '120'], ['Tickets', '35']]
        }]
      },
      citations: [],
      nextQuestions: []
    };
    const formats = ['pdf', 'docx', 'pptx', 'xlsx', 'zip'];
    const state = createToolState();

    for (const format of formats) {
      const result = await executeWorkbenchTool({
        workspace,
        budget: { ...budget, maxToolCalls: 10 },
        state,
        call: toolCall('artifact_export', {
          json: JSON.stringify(artifact),
          format,
          outputPath: `exports/review.${format}`
        })
      });

      expect(result.ok).toBe(true);
      expect(JSON.stringify(result.data)).toContain('"exported":true');
      expect(JSON.stringify(result.data)).toContain(`"format":"${format}"`);
    }

    const files = await listWorkspace(workspace);
    const exported = files.files.filter((file) => file.path.startsWith('exports/'));
    expect(exported.map((file) => file.path).sort()).toEqual([
      'exports/review.docx',
      'exports/review.pdf',
      'exports/review.pptx',
      'exports/review.xlsx',
      'exports/review.zip'
    ]);
    for (const file of exported) {
      expect(file.bytes).toBeGreaterThan(100);
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    const pdf = await fs.readFile(path.join(workspace.root, 'exports/review.pdf'));
    const pptx = await fs.readFile(path.join(workspace.root, 'exports/review.pptx'));
    const xlsx = await fs.readFile(path.join(workspace.root, 'exports/review.xlsx'));
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pptx.subarray(0, 2).toString('hex')).toBe('504b');
    expect(xlsx.subarray(0, 2).toString('hex')).toBe('504b');
  });

  it('creates checkpoints before deleting generated files', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_tools_1234567890',
      baseRoot: tempRoot
    });
    await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: toolCall('workspace_write', { path: 'scratch.txt', content: 'temporary' })
    });

    const result = await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: toolCall('workspace_delete', { path: 'scratch.txt' })
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.data)).toContain('"deleted":true');
    await expect(fs.readdir(path.join(workspace.root, '.workbench', 'checkpoints'))).resolves.not.toHaveLength(0);
  });

  it('rejects metadata and localhost fetches before network access', async () => {
    await expect(safeWebFetch('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/private|metadata/);
    await expect(safeWebFetch('http://localhost:8080')).rejects.toThrow(/local|metadata/);
  });

  it('extracts a bounded excerpt from HTML pages larger than the excerpt limit', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const response = new Response(
        `<html><body><main><h1>Mission update</h1><p>${'source evidence '.repeat(2000)}</p></main></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
      Object.defineProperty(response, 'url', { value: 'https://example.com/research' });
      return response;
    };
    try {
      const result = await safeWebFetch('https://example.com/research', 5000);
      expect(result.text).toContain('Mission update');
      expect(result.text.length).toBeLessThanOrEqual(5000);
      expect(result.text.length).toBeGreaterThan(1000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses the authenticated Delegators gateway for native deep search', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toBe('https://gateway.example/v1/tools/web_search');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer wb_test_session_key_123456' });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        query: 'current battery market',
        mode: 'deep',
        num_results: 6
      });
      return new Response(JSON.stringify({
        results: [{
          title: 'Official market release',
          url: 'https://example.com/release',
          snippet: 'Verified current figures.',
          highlights: ['Primary-source evidence'],
          published_date: '2026-06-10',
          provider: 'exa'
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    try {
      const results = await webSearch('current battery market', {
        maxResults: 6,
        mode: 'deep',
        platform: {
          baseURL: 'https://gateway.example',
          sessionKey: 'wb_test_session_key_123456'
        }
      });
      expect(results).toEqual([expect.objectContaining({
        title: 'Official market release',
        provider: 'exa',
        publishedDate: '2026-06-10'
      })]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not bypass the Delegators gateway with local search when platform search fails', async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (input) => {
      calls += 1;
      expect(String(input)).toBe('https://gateway.example/v1/tools/web_search');
      return new Response(JSON.stringify({ error: 'search unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    try {
      const results = await webSearch('current battery market', {
        maxResults: 6,
        mode: 'deep',
        platform: {
          baseURL: 'https://gateway.example',
          sessionKey: 'wb_test_session_key_123456'
        }
      });
      expect(results).toEqual([]);
      expect(calls).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('compacts oversized tool results', () => {
    const compacted = compactToolResult({
      ok: true,
      tool: 'workspace_read',
      summary: 'large',
      data: { text: 'x'.repeat(1000) }
    }, 120);

    expect(compacted.length).toBeLessThanOrEqual(135);
    expect(compacted).toContain('[truncated]');
  });

  it('assigns larger budgets to Pro Thinking and Ultra models', () => {
    expect(policyForModel('swe-pro-thinking').maxToolCalls).toBeGreaterThan(policyForModel('swe-fast').maxToolCalls);
    expect(policyForModel('swe-ultra').maxToolCalls).toBeGreaterThan(policyForModel('swe-pro').maxToolCalls);
    expect(policyForModel('swe-ultra').maxTerminalRuns).toBeGreaterThanOrEqual(4);
  });

  it('tightens artifact budgets when research pack already exists', () => {
    const ultraDeck = policyForArtifact('swe-ultra', { kind: 'deck', hasResearchPack: true });
    expect(ultraDeck.maxToolCalls).toBeLessThanOrEqual(5);
    expect(ultraDeck.maxWebRequests).toBe(0);
  });

  it('expands artifact budgets for deep and marathon runs', () => {
    const standard = policyForArtifact('swe-pro-thinking', { kind: 'deck', depthTier: 'standard' });
    const deep = policyForArtifact('swe-pro-thinking', { kind: 'deck', depthTier: 'deep' });
    const marathon = policyForArtifact('swe-pro-thinking', { kind: 'deck', depthTier: 'marathon' });
    expect(deep.maxToolCalls).toBeGreaterThan(standard.maxToolCalls);
    expect(marathon.maxToolCalls).toBeGreaterThan(deep.maxToolCalls);
    expect(marathon.timeoutMs).toBeGreaterThan(standard.timeoutMs);
  });
});

function toolCall(name: string, args: unknown): ToolCall {
  return {
    id: `call_${name}`,
    function: { name, arguments: JSON.stringify(args) }
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
