import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type FreeImageAnalysis = {
  extractor: 'self-hosted-vision' | 'local-ocr';
  text: string;
  warnings: string[];
};

type ImageAnalysisOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  runOcr?: (binary: Buffer, name: string, mime: string, env: NodeJS.ProcessEnv) => Promise<string | null>;
};

export function buildNativeVisionPrompt(name: string): string {
  return [
    `Analyze the uploaded image "${name}" as visual evidence for a professional artifact.`,
    'Return structured Markdown with: Visible content, Exact text and data, Typography, Color system, Layout and spacing, Charts and tables, Brand elements, Ambiguities, Artifact implications.',
    'Transcribe legible text and values exactly.',
    'Describe typeface class, weight, hierarchy, and approximate font scale; name an exact font only when visibly identifiable.',
    'Report dominant and accent colors with approximate six-digit hex values when supportable, clearly labeling estimates.',
    'Describe grid, margins, spacing rhythm, alignment, density, contrast, image treatment, logos, chart encodings, table structure, and reading order.',
    'Separate direct observation from interpretation. State plainly when something is unreadable or uncertain.',
    'Do not speculate, praise the design, or give generic advice.'
  ].join(' ');
}

export async function analyzeImageWithoutPaid(
  binary: Buffer,
  name: string,
  mime: string,
  options: ImageAnalysisOptions = {}
): Promise<FreeImageAnalysis | null> {
  const env = options.env ?? process.env;
  const selfHosted = await analyzeWithSelfHostedVision(binary, name, mime, env, options.fetchImpl ?? fetch);
  if (selfHosted) {
    return {
      extractor: 'self-hosted-vision',
      text: selfHosted,
      warnings: []
    };
  }

  const ocr = await (options.runOcr ?? runLocalOcr)(binary, name, mime, env);
  if (!ocr) return null;
  return {
    extractor: 'local-ocr',
    text: `Local OCR text:\n${ocr}`,
    warnings: ['Local OCR extracted text only; non-text visual details were not analyzed.']
  };
}

async function analyzeWithSelfHostedVision(
  binary: Buffer,
  name: string,
  mime: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch
): Promise<string | null> {
  const baseURL = env.WORKBENCH_VISION_BASE_URL?.trim().replace(/\/$/, '');
  const model = env.WORKBENCH_VISION_MODEL?.trim();
  if (!baseURL || !model) return null;

  const controller = new AbortController();
  const timeoutMs = positiveInt(env.WORKBENCH_VISION_TIMEOUT_MS, 30_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const apiKey = env.WORKBENCH_VISION_API_KEY?.trim();
    const response = await fetchImpl(`${baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildNativeVisionPrompt(name) },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${binary.toString('base64')}` } }
          ]
        }]
      }),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    return completionText(payload.choices?.[0]?.message?.content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runLocalOcr(
  binary: Buffer,
  name: string,
  mime: string,
  env: NodeJS.ProcessEnv
): Promise<string | null> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-ocr-'));
  const input = path.join(root, `input${imageExtension(name, mime)}`);
  try {
    await fs.writeFile(input, binary, { mode: 0o600 });
    const result = await runCommand(
      env.WORKBENCH_TESSERACT_COMMAND?.trim() || 'tesseract',
      [
        input,
        'stdout',
        '-l',
        env.WORKBENCH_TESSERACT_LANG?.trim() || 'eng',
        '--psm',
        env.WORKBENCH_TESSERACT_PSM?.trim() || '6'
      ],
      positiveInt(env.WORKBENCH_TESSERACT_TIMEOUT_MS, 20_000)
    );
    const text = result.stdout.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    return result.exitCode === 0 && text ? text.slice(0, 80_000) : null;
  } catch {
    return null;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function runCommand(
  file: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' }
    });
    let stdout = '';
    let settled = false;
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout });
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(null);
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < 80_000) stdout += chunk.toString('utf8');
    });
    child.on('error', () => finish(127));
    child.on('close', finish);
  });
}

function completionText(content: string | Array<{ type?: string; text?: string }> | undefined): string | null {
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => part.text ?? '').join('\n')
      : '';
  return text.trim() || null;
}

function imageExtension(name: string, mime: string): string {
  const ext = path.extname(name).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.tif', '.tiff', '.bmp'].includes(ext)) return ext;
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('tiff')) return '.tiff';
  if (mime.includes('bmp')) return '.bmp';
  return '.jpg';
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
