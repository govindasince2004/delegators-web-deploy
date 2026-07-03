// Per-tool setup for /swe — exact UI paths, config keys, and paste values.
// Delegators gateway: OpenAI Chat Completions at https://api.delegators.in/v1, Bearer sess_…

export interface ConfigRow {
  /** Label shown in the client UI or config file. */
  setting: string;
  /** What you paste (placeholders until checkout). */
  value: string;
  /** Where to find the field. */
  where: string;
}

export interface ToolGuideStep {
  title: string;
  detail: string;
}

export interface ToolGuide {
  id: string;
  name: string;
  logo?: string;
  invertLogo?: boolean;
  /** Shown on the collapsed row. */
  teaser: string;
  /** Primary settings location. */
  settingsPath: string;
  configRows: ConfigRow[];
  steps: ToolGuideStep[];
  code?: { label: string; content: string };
  verify?: string;
  warning?: string;
}

export const SWE_BASE = 'https://api.delegators.in/v1';
export const SWE_KEY = 'sess_...';
export const SWE_MODEL = 'dlg-pro';

export const SWE_TOOL_GUIDES: ToolGuide[] = [
  {
    id: 'cline',
    name: 'Cline',
    logo: 'cline-mono.svg',
    teaser: 'VS Code extension · OpenAI Compatible provider in Cline settings.',
    settingsPath: 'VS Code → Cline icon (sidebar) → ⚙️ gear → API Configuration',
    configRows: [
      { setting: 'API Provider', value: 'OpenAI Compatible', where: 'Dropdown at top of API Configuration' },
      { setting: 'Base URL', value: SWE_BASE, where: 'Base URL field — must end with /v1' },
      { setting: 'API Key', value: SWE_KEY, where: 'API Key field — sess_… from checkout success page' },
      { setting: 'Model ID', value: SWE_MODEL, where: 'Model → enter exact custom ID' },
      { setting: 'Context Window', value: '128000', where: 'Model Configuration → optional, start here' },
      { setting: 'Support Images', value: 'On if the client supports uploads', where: 'Model Configuration checkbox' },
    ],
    steps: [
      {
        title: 'Install Cline',
        detail: 'VS Code → Extensions (⇧⌘X) → search “Cline” → Install → reload window.',
      },
      {
        title: 'Open API Configuration',
        detail: 'Click the Cline icon in the Activity Bar → gear icon (⚙️) → ensure “Use your own API key” is selected (not a built-in subscription).',
      },
      {
        title: 'Set provider to OpenAI Compatible',
        detail: 'API Provider dropdown → OpenAI Compatible. Do not pick “OpenAI” — that points at api.openai.com.',
      },
      {
        title: 'Paste Delegators values',
        detail: `Base URL = ${SWE_BASE}. API Key = sess_ key from checkout. Model ID = ${SWE_MODEL} by default, or another exact alias your pass includes.`,
      },
      {
        title: 'Verify connection',
        detail: 'Some Cline builds expose a “Verify” or test button; otherwise send: “List files in the project root.” First successful completion activates your SWE timer.',
      },
    ],
    code: {
      label: 'model aliases by plan',
      content: `Pro:             dlg-pro, dlg-light
UltraSpeed beta: + swe-ultra-thinking, swe-ultra
Workbench:       image uploads auto-route automatically`,
    },
    verify: 'Cline should return file listings without “Invalid API Key” or “Model Not Found”.',
  },
  {
    id: 'roo-code',
    name: 'Roo Code',
    logo: 'roocode-mono.svg',
    teaser: 'VS Code extension · OpenAI Compatible in Roo provider settings.',
    settingsPath: 'VS Code → Roo Code icon (sidebar) → ⚙️ → Provider Settings',
    configRows: [
      { setting: 'API Provider', value: 'OpenAI Compatible', where: 'Provider dropdown' },
      { setting: 'Base URL', value: SWE_BASE, where: 'Base URL — not api.openai.com/v1' },
      { setting: 'API Key', value: SWE_KEY, where: 'API Key field' },
      { setting: 'Model ID', value: SWE_MODEL, where: 'Model selector → custom / manual entry' },
      { setting: 'Max Output Tokens', value: '8192+', where: 'Model Configuration (optional)' },
    ],
    steps: [
      {
        title: 'Install Roo Code',
        detail: 'VS Code → Extensions → search “Roo Code” → Install.',
      },
      {
        title: 'Open Provider Settings',
        detail: 'Roo Code sidebar panel → settings/gear → API Provider section.',
      },
      {
        title: 'Select OpenAI Compatible',
        detail: `Roo requires native tool-calling models. Delegators routes to tool-capable SWE models — use ${SWE_MODEL} on Pro, ultra only on beta.`,
      },
      {
        title: 'Enter endpoint, key, model',
        detail: `Base URL: ${SWE_BASE} · API Key: sess_ from checkout · Model: ${SWE_MODEL} (or another plan alias).`,
      },
      {
        title: 'Select profile in task UI',
        detail: 'Before starting a task, pick your configured provider from Roo’s model/profile picker in the chat header.',
      },
    ],
    verify: 'Start a task with “Read package.json and summarize scripts.” Tool calls should stream without 401/404.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    logo: 'cursor.svg',
    teaser: 'Cursor Settings → Models → custom OpenAI-compatible model.',
    settingsPath: 'Cursor → Settings (⌘,) → Models → Add Custom Model',
    configRows: [
      { setting: 'Protocol / Type', value: 'OpenAI-compatible', where: 'Add Custom Model dialog' },
      { setting: 'OpenAI API Key', value: SWE_KEY, where: 'API Key field' },
      { setting: 'Override OpenAI Base URL', value: 'Enabled', where: 'Toggle — required' },
      { setting: 'Base URL', value: SWE_BASE, where: 'Override URL field' },
      { setting: 'Model name', value: SWE_MODEL, where: 'Model ID — exact id, no shorthand' },
    ],
    steps: [
      {
        title: 'Confirm Cursor tier',
        detail: 'Custom API models require Cursor Pro, Business, or Ultra. Free tier hides base-URL override.',
      },
      {
        title: 'Open Models settings',
        detail: 'Cursor Settings → Models (or Features → Models on older builds).',
      },
      {
        title: 'Add custom model',
        detail: 'Click “Add Custom Model” / configure OpenAI section → enable Override OpenAI Base URL.',
      },
      {
        title: 'Paste Delegators endpoint + sess_ key',
        detail: `Override URL: ${SWE_BASE} · API Key: sess_… · Model: ${SWE_MODEL}.`,
      },
      {
        title: 'Select model in Chat / Agent',
        detail: 'Model picker in Cursor Chat or Agent mode → choose your Delegators custom model. Usage should hit your SWE pass, not Cursor’s bundled quota.',
      },
    ],
    verify: 'Send a chat message; check Delegators Usage dashboard — remaining % should drop after the request.',
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    logo: 'kilo-code.svg',
    invertLogo: true,
    teaser: 'VS Code extension · Provider → OpenAI Compatible.',
    settingsPath: 'VS Code → Kilo Code panel → Settings → API Provider',
    configRows: [
      { setting: 'Provider', value: 'OpenAI Compatible', where: 'API Provider dropdown' },
      { setting: 'Base URL', value: SWE_BASE, where: 'Base URL / API endpoint field' },
      { setting: 'API Key', value: SWE_KEY, where: 'API Key field' },
      { setting: 'Model ID', value: SWE_MODEL, where: 'Custom model name field' },
    ],
    steps: [
      { title: 'Install Kilo Code', detail: 'VS Code Extensions → “Kilo Code” → Install.' },
      { title: 'Open API Provider settings', detail: 'Kilo sidebar → Settings → API Provider.' },
      { title: 'Choose OpenAI Compatible', detail: 'Not the built-in provider.' },
      { title: 'Paste Base URL, API Key, Model', detail: `Same three values as Cline: ${SWE_BASE}, sess_ key, model ${SWE_MODEL}.` },
      { title: 'Run agent task', detail: 'Use Kilo’s agent mode; first model request starts SWE session billing.' },
    ],
    verify: 'Inline edit or agent prompt completes with 200 — no “provider not found”.',
  },
  {
    id: 'trae',
    name: 'Trae',
    logo: 'trae.svg',
    teaser: 'Trae IDE · Model settings → custom OpenAI-compatible endpoint.',
    settingsPath: 'Trae → Settings → AI / Models → Custom provider',
    configRows: [
      { setting: 'API type', value: 'OpenAI-compatible', where: 'Provider type selector' },
      { setting: 'API Base URL', value: SWE_BASE, where: 'Endpoint URL field' },
      { setting: 'API Key', value: SWE_KEY, where: 'Secret key field' },
      { setting: 'Model name', value: SWE_MODEL, where: 'Model ID / name field' },
    ],
    steps: [
      { title: 'Open Trae model settings', detail: 'Trae → Settings → search “model” or “API” — labels vary by Trae version.' },
      { title: 'Add custom provider', detail: 'Select OpenAI-compatible / custom endpoint (not Trae bundled subscription).' },
      { title: 'Paste Delegators values', detail: `URL: ${SWE_BASE} · Key: sess_… · Model: ${SWE_MODEL}.` },
      { title: 'Set as default for Agent', detail: 'Select this profile for Trae Agent / SOLO coding mode.' },
    ],
    verify: 'Agent can read workspace files and reply using your configured model.',
  },
  {
    id: 'openai-sdk',
    name: 'OpenAI SDK',
    logo: undefined,
    teaser: 'SDK reference · baseURL + API key + model alias.',
    settingsPath: 'OpenAI SDK client constructor',
    configRows: [
      { setting: 'baseURL', value: SWE_BASE, where: 'OpenAI client option' },
      { setting: 'apiKey', value: SWE_KEY, where: 'OpenAI client option' },
      { setting: 'model', value: SWE_MODEL, where: 'JSON body' },
      { setting: 'endpoint', value: '/chat/completions', where: 'SDK method path' },
    ],
    steps: [
      { title: 'Create the client', detail: 'Pass baseURL and apiKey to the constructor so the SDK does not call api.openai.com.' },
      { title: 'Use a plan model', detail: `Send model = ${SWE_MODEL} by default, or dlg-light when you want the cheaper lane.` },
      { title: 'Session status', detail: 'GET <endpoint>/v1/session/status with same Bearer — does not consume budget.' },
    ],
    code: {
      label: 'node · openai sdk',
      content: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${SWE_BASE}",
  apiKey: "${SWE_KEY}",
});

const response = await client.chat.completions.create({
  model: "${SWE_MODEL}",
  messages: [{ role: "user", content: "ping" }],
});`,
    },
    verify: 'JSON response with choices[0].message.content — HTTP 200.',
  },
];

export function getToolGuide(id: string): ToolGuide | undefined {
  return SWE_TOOL_GUIDES.find((g) => g.id === id);
}
