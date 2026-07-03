import express from 'express';
import helmet from 'helmet';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  ArtifactDocumentSchema,
  CreateWorkbenchRunRequestSchema,
  GenerateArtifactRequestSchema,
  RefineArtifactRequestSchema,
  ExportArtifactRequestSchema,
  WorkbenchRunInstructionSchema,
  type WorkbenchProgressItem,
  type WorkbenchStreamEvent,
  type ArtifactAsset,
  type ArtifactKind,
  type ArtifactDocument,
  type ArtifactExportFormat,
  type ArtifactPrimaryFormat,
  type CreateWorkbenchRunRequest,
  type GenerateArtifactRequest,
  type WorkbenchQuestion,
  type WorkbenchQuestionItem,
  type WorkbenchRun,
  WorkbenchReferencesSchema,
  skillInstructions
} from '../src/lib/shared.js';
import {
  findSkillById,
  resolveSkillFromText,
  skillCatalog,
  stripSkillTags
} from '../src/lib/skills.js';
import {
  inferSkillFromThreadRequest,
  resolveThreadArtifactIntent
} from '../src/lib/threadArtifactRouting.js';
import { applyClaimConfidence } from './claimConfidence.js';
import {
  getThreadResearchPack,
  mergeThreadResearchPacks,
  researchPackFromPriorArtifacts,
  setThreadResearchPack,
  shouldReuseThreadResearch,
  startThreadResearchCacheSweep
} from './threadResearchCache.js';
import { runFatherOrchestrated } from './internalHarness.js';
import { waitForRunEvent } from './runEventHub.js';
import {
  formatAssistantProse,
  sanitizeChatReply
} from '../src/lib/artifactContinuation.js';
import { coalesceCompletionTurn } from './embeddedToolCalls.js';
import {
  priorArtifactFactsForModel,
  renderThreadContext,
  renderThreadSummary,
  summarizePriorArtifact
} from '../src/lib/threadContext.js';
import {
  artifactAssetSeedFiles,
  artifactForModel,
  attachResearchAssets,
  mergeArtifactAssets
} from './artifactAssets.js';
import { buildArtifactSkillPack } from './artifactSkills.js';
import {
  artifactContainsInternalExecutionLeak,
  parseArtifactCandidate,
  parseArtifactJson
} from './artifactRepair.js';
import {
  advanceArtifactPlan,
  buildRefinementPlan,
  completeArtifactPlan,
  requiresToolHarness,
  type ArtifactPlan
} from './artifactPlan.js';
import {
  buildPreflightMessages,
  fallbackArtifactPreflight,
  parseProviderPreflight,
  type ArtifactPreflight
} from './artifactPreflight.js';
import {
  buildInspectionMessages,
  buildQualityRevisionMessages,
  fallbackArtifactInspection,
  inspectArtifactLocally,
  mergeArtifactInspections,
  parseProviderInspection,
  type ArtifactInspection
} from './artifactInspection.js';
import { buildWorkbenchClockContext } from './clockContext.js';
import { buildExport } from './exporters.js';
import { buildNativeVisionPrompt } from './imageAnalysis.js';
import {
  assertCredentialAllowedForEndpoint,
  authValidationStrategy,
  endpointValidationMessages,
  isAllowedBrowserOrigin,
  isOfficialMimoOrigin,
  parseWorkbenchAllowedOrigins,
  requestOriginCandidates,
  resolveBindHost,
  resolveDelegatorsBaseURL as validateDelegatorsBaseURL,
  scrubSecrets
} from './security.js';
import {
  chatWebToolDefinitions,
  policyForArtifact,
  policyForChat,
  policyForModel,
  webSearch,
  workbenchToolDefinitions,
  type ToolBudget,
  type ToolCall
} from './workbenchTools.js';
import {
  runChatHarness,
  runWorkbenchHarness,
  type CompletionTurn,
  type DelegatorsMessage
} from './harnessOrchestrator.js';
import {
  allowedResearchCitationUrls,
  briefNeedsResearch,
  buildArtifactResearchBrief,
  citationsAreGrounded,
  explicitlyAcknowledgesUnverified,
  prepareResearchPack,
  researchAssetSeedFiles,
  researchPackManifest,
  renderResearchPackMarkdown,
  type ResearchConfidence,
  type ResearchPack
} from './research.js';
import {
  cleanupExpiredWorkspaces,
  createWorkspace,
  workspaceCleanupIntervalMs,
  workspaceTtlMs,
  writeWorkspaceText,
  writeWorkspaceBinary,
  type WorkbenchWorkspace
} from './workspace.js';
import {
  prepareReferencePack,
  type ImageAnalyzer,
  type PresentationDesignProfile,
  type ReferencePack,
  type ReferenceSeedFile
} from './references.js';
import {
  attachReferenceAnalysis,
  buildReferenceAnalysisJobs,
  buildReferenceGenerationContext,
  buildReferenceSynthesisMessages
} from './referenceAnalysis.js';
import { workbenchHarnessIdentity } from './delegatorsHarness.js';
import { RunCoordinator, type RunExecutionContext } from './runCoordinator.js';
import { createRunRepository } from './runRepository.js';
import { mirrorWorkbenchObject } from './objectStorage.js';
import { stabilizeDeckComposition } from './deckComposition.js';
import { stabilizeArtifactComposition } from './documentComposition.js';
import {
  audienceCitationsRequired,
  audienceCraftLines,
  detectArtifactAudience
} from './artifactAudience.js';
import {
  briefIsExplicit,
  briefRequiresComputation,
  buildComposeFromOutlineMessages,
  buildOutlineMessages,
  buildTemplateSkeletonFillMessages,
  createRunPhaseTimer,
  deterministicPreflightReply,
  isBlockingPublishIssue,
  publishGateBlocks,
  resolveComposeModel,
  resolveRepairModel,
  shouldSkipProviderInspection,
  shouldUseStructuredPipeline,
  type RunPhaseTimer
} from './artifactPipeline.js';
import {
  assessRunDepthWithContext,
  depthExecutionBrief,
  providerRequestTimeoutMs,
  toolResultKeepCount,
  buildOutlineCritiqueMessages,
  depthStatusLabel,
  shouldCritiqueOutline,
  fatherOrchestratorConcurrency,
  type RunDepthTier
} from './agenticDepth.js';
import { collectReadinessChecks } from './readiness.js';
import {
  renderPrometheusMetrics,
  incrementCounter,
  setGauge
} from './metrics.js';
import {
  consumeRateLimit,
  rateLimitMax,
  rateLimitWindowMs,
  sweepMemoryRateBuckets
} from './rateLimiter.js';
import { resolveSessionStreamLimit } from './sessionLimits.js';
import { attachResearchCitations } from './citationAttach.js';
import { enforceDesignPreset } from './designPreset.js';
import { composeDeckFromOutline, shouldUseMapCompose } from './mapCompose.js';
import {
  briefHasTemplateSessionMarker,
  buildTemplateChatSystemLines,
  buildTemplateSkeletonRoutingLines,
  isTemplateSkeletonSession
} from '../src/lib/templateAgentGuidance.js';
import { findWorkbenchTemplate } from '../src/lib/templateHarness.js';
import { resolveTemplateMetadata } from '../src/lib/workbenchTemplates.js';
import { buildTemplateHarnessRoutingLines } from './templateRag.js';
import { guardPreflightQuestions } from './preflightGuard.js';
import { sanitizeClientError, sanitizeStreamEvent } from './streamSanitizer.js';
import { credibilityPromptLines } from './artifactCredibility.js';
import { repairArtifactCredibility } from './artifactCredibilityRepair.js';
import {
  buildUserPromptContract,
  userPromptContractLines
} from './userPromptContract.js';
import {
  applyArtifactPatch,
  buildStructuredPatchMessages,
  parsePatchResponse
} from './artifactPatch.js';
import {
  handleGoogleCallback,
  handleGoogleConnect,
  handleGoogleDisconnect,
  handleIntegrationsStatus,
  handleMicrosoftCallback,
  handleMicrosoftConnect,
  handleMicrosoftDisconnect
} from './integrations.js';
import {
  handleCloudExport,
  handleKnowledgeAddMemory,
  handleKnowledgeBrowse,
  handleKnowledgeDeleteMemory,
  handleKnowledgeGraph,
  handleKnowledgeImport,
  handleKnowledgeSearch
} from './knowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

type ArtifactParseOptions = {
  expectedKind?: ArtifactKind;
  expectedPrimaryFormat?: ArtifactPrimaryFormat;
  fallbackTone?: string;
  requiredTable?: boolean;
  citationsRequired?: boolean;
  researchConfidence?: ResearchConfidence;
  requestedSubject?: string;
  sourceBrief?: string;
  sourceEvidence?: string;
  allowedCitationUrls?: Set<string>;
  allowedCitationIds?: Set<string>;
  allowedCitations?: Map<string, string>;
  availableAssets?: ArtifactAsset[];
  referenceDesignProfiles?: PresentationDesignProfile[];
  seedFiles?: ReferenceSeedFile[];
  threadArtifactMode?: 'new' | 'refine' | 'reuse-content' | 'template-fill';
  priorArtifact?: ArtifactDocument;
  audienceProfile?: ReturnType<typeof detectArtifactAudience>;
  researchPack?: ResearchPack | null;
};

type ProgressReporter = {
  status: (message: string) => void;
  plan: (title: string, items: WorkbenchProgressItem[]) => void;
  checklist: (items: WorkbenchProgressItem[]) => void;
  message: (text: string) => void;
  question: (question: WorkbenchQuestion) => void;
};

type ExecutionControl = Pick<
  RunExecutionContext,
  | 'signal'
  | 'drainInstructions'
  | 'waitForInstructions'
  | 'checkpoint'
  | 'runId'
>;
type DelegatorsCompletionInput = Pick<
  GenerateArtifactRequest,
  'sessionKey' | 'model'
> & {
  threadId?: string;
};

const port = Number.parseInt(process.env.WORKBENCH_PORT ?? '4175', 10);
const requestTimeoutMs = Number.parseInt(
  process.env.WORKBENCH_REQUEST_TIMEOUT_MS ?? '360000',
  10
);
const defaultModel =
  process.env.WORKBENCH_DEFAULT_MODEL ??
  process.env.DELEGATORS_DEFAULT_MODEL ??
  'dlg-pro';
const qualityMode = normalizeQualityMode(process.env.WORKBENCH_QUALITY_MODE);
const isProd = process.env.NODE_ENV === 'production';

function normalizeQualityMode(value?: string): 'fast' | 'standard' | 'strict' {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'fast' || normalized === 'strict') return normalized;
  return 'standard';
}

// The Workbench is an INTERNAL tool: it forwards a user-supplied bearer session key to a
// user-supplied endpoint server-side, so it must never be a public service. In production it
// binds to loopback by default and refuses a public bind host unless an operator sets an
// explicit, audited override. Front it with an authenticated reverse proxy (Cloudflare Access).
const bindHost = resolveBindHost();

const configuredDelegatorsEndpoint =
  process.env.WORKBENCH_DELEGATORS_BASE_URL ??
  process.env.DELEGATORS_BASE_URL ??
  process.env.DELEGATORS_DEFAULT_ENDPOINT ??
  'http://localhost:8080';
const defaultDelegatorsBaseURL = validateDelegatorsBaseURL(
  configuredDelegatorsEndpoint
);

function resolveDelegatorsBaseURL(raw: string): string {
  const requested = validateDelegatorsBaseURL(raw);
  return shouldUseInternalDelegatorsEndpoint(requested, defaultDelegatorsBaseURL)
    ? defaultDelegatorsBaseURL
    : requested;
}

function shouldUseInternalDelegatorsEndpoint(
  requestedOrigin: string,
  internalOrigin: string
): boolean {
  try {
    const requested = new URL(requestedOrigin);
    const internal = new URL(internalOrigin);
    if (!isLoopbackGatewayHost(requested.hostname)) return false;
    if (isLoopbackGatewayHost(internal.hostname)) return false;
    return (
      requested.protocol === internal.protocol &&
      normalizedPort(requested) === normalizedPort(internal)
    );
  } catch {
    return false;
  }
}

function isLoopbackGatewayHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  );
}

function normalizedPort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === 'https:' ? '443' : '80';
}

const runRepository = createRunRepository();
const runCoordinator = new RunCoordinator(runRepository, executeManagedRun);
startThreadResearchCacheSweep();

const clerkCspOrigins = [
  'https://clerk.accounts.dev',
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://*.clerk.dev',
  'https://*.clerk.services'
];
const cloudflareChallengeOrigin = 'https://challenges.cloudflare.com';
const runtimeConnectOrigins = uniqueCspSources([
  defaultDelegatorsBaseURL,
  ...optionalOrigin(process.env.VITE_WORKBENCH_API_URL),
  ...optionalOrigin(process.env.VITE_DELEGATORS_GATEWAY_URL),
  ...optionalOrigin(process.env.WORKBENCH_CSP_CONNECT_ORIGINS)
]);
const runtimeScriptOrigins = optionalOrigin(
  process.env.WORKBENCH_CSP_SCRIPT_ORIGINS
);
const runtimeFrameOrigins = optionalOrigin(
  process.env.WORKBENCH_CSP_FRAME_ORIGINS
);

// Trust one reverse proxy layer ONLY when explicitly configured. If the Workbench is exposed
// directly (no proxy in front), trust proxy must be off or an attacker can spoof X-Forwarded-For
// to bypass the per-IP rate limiter. Set WORKBENCH_BEHIND_PROXY=true when fronted by
// nginx/Cloudflare so req.ip resolves to the real client address.
if (process.env.WORKBENCH_BEHIND_PROXY === 'true') {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          ...clerkCspOrigins,
          cloudflareChallengeOrigin,
          ...runtimeScriptOrigins
        ],
        workerSrc: ["'self'", 'blob:'],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://api.fontshare.com'
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https://img.clerk.com',
          ...clerkCspOrigins
        ],
        connectSrc: ["'self'", ...clerkCspOrigins, ...runtimeConnectOrigins],
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
          'https://api.fontshare.com',
          'https://cdn.fontshare.com'
        ],
        frameSrc: [
          "'self'",
          ...clerkCspOrigins,
          cloudflareChallengeOrigin,
          ...runtimeFrameOrigins
        ],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(express.json({ limit: process.env.WORKBENCH_JSON_LIMIT ?? '12mb' }));

const allowedBrowserOrigins = new Set(parseWorkbenchAllowedOrigins());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const sameOriginCandidates = requestOriginCandidates({
    protocol: req.protocol,
    host: req.get('host') ?? undefined,
    forwardedProto: req.get('x-forwarded-proto') ?? undefined,
    forwardedHost: req.get('x-forwarded-host') ?? undefined
  });
  if (
    origin &&
    isAllowedBrowserOrigin(origin, allowedBrowserOrigins, sameOriginCandidates)
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (origin && isProd) {
    res.status(403).json({
      error: 'origin_forbidden',
      details: 'Browser origin is not allowed.'
    });
    return;
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Clerk-Token, X-Workbench-Token, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

async function rateLimit(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
  const subject = currentWorkbenchAuth(res)?.subject;
  const ipResult = await consumeRateLimit(
    `ip:${ip}`,
    rateLimitMax(),
    rateLimitWindowMs()
  );
  if (!ipResult.allowed) {
    incrementCounter('workbench_rate_limited_total', { scope: 'ip' });
    res.setHeader('Retry-After', String(ipResult.retryAfter ?? 60));
    res.status(429).json({
      error: 'rate_limited',
      details: `Too many requests. Retry in ${ipResult.retryAfter ?? 60}s.`
    });
    return;
  }
  if (subject) {
    const userResult = await consumeRateLimit(
      `user:${subject}`,
      rateLimitMax(),
      rateLimitWindowMs()
    );
    if (!userResult.allowed) {
      incrementCounter('workbench_rate_limited_total', { scope: 'user' });
      res.setHeader('Retry-After', String(userResult.retryAfter ?? 60));
      res.status(429).json({
        error: 'rate_limited',
        details: `Too many requests. Retry in ${userResult.retryAfter ?? 60}s.`
      });
      return;
    }
  }
  next();
}

setInterval(() => {
  sweepMemoryRateBuckets();
  setGauge('workbench_active_runs', runCoordinator.activeRunCount());
}, rateLimitWindowMs()).unref?.();

const cleanupIntervalMs = workspaceCleanupIntervalMs();
setInterval(() => {
  cleanupExpiredWorkspaces({ ttlMs: workspaceTtlMs() }).catch((error) => {
    console.error(
      '[workbench] workspace cleanup failed',
      error instanceof Error ? error.message : error
    );
  });
}, cleanupIntervalMs).unref?.();

const workbenchAuthToken = process.env.WORKBENCH_AUTH_TOKEN ?? '';
const allowUnauthenticatedUnsafe =
  process.env.WORKBENCH_ALLOW_UNAUTHENTICATED_UNSAFE === 'true';
const workbenchAuthMode = process.env.WORKBENCH_AUTH_MODE ?? 'delegators';

type WorkbenchAuthContext = {
  kind: 'dev' | 'unsafe' | 'static' | 'clerk' | 'session';
  subject?: string;
};

if (
  isProd &&
  workbenchAuthMode === 'static' &&
  !workbenchAuthToken &&
  !allowUnauthenticatedUnsafe
) {
  console.error(
    '[workbench] FATAL: WORKBENCH_AUTH_MODE=static requires WORKBENCH_AUTH_TOKEN. ' +
      'Set WORKBENCH_AUTH_TOKEN, switch to WORKBENCH_AUTH_MODE=delegators, or explicitly allow unsafe access.'
  );
  process.exit(1);
}

if (
  isProd &&
  !['delegators', 'static'].includes(workbenchAuthMode) &&
  !allowUnauthenticatedUnsafe
) {
  console.error(
    `[workbench] FATAL: unsupported WORKBENCH_AUTH_MODE=${workbenchAuthMode}.`
  );
  process.exit(1);
}

async function requireWorkbenchAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  if (!isProd) {
    res.locals.workbenchAuth = { kind: 'dev' } satisfies WorkbenchAuthContext;
    next();
    return;
  }

  if (allowUnauthenticatedUnsafe) {
    res.locals.workbenchAuth = {
      kind: 'unsafe'
    } satisfies WorkbenchAuthContext;
    next();
    return;
  }

  if (workbenchAuthMode === 'static') {
    const tokenHeader =
      firstHeader(req.headers['x-workbench-token']) ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (tokenHeader === workbenchAuthToken) {
      res.locals.workbenchAuth = {
        kind: 'static',
        subject: stableAuthSubject('static', tokenHeader)
      } satisfies WorkbenchAuthContext;
      next();
      return;
    }
    res.status(401).json({
      error: 'unauthorized',
      details: 'Missing or invalid Workbench auth token.'
    });
    return;
  }

  try {
    const clerkToken = firstHeader(req.headers['x-clerk-token']).trim();
    const sessionKey = req.headers.authorization
      ?.replace(/^Bearer\s+/i, '')
      .trim();
    const usingSession =
      typeof sessionKey === 'string' && /^(sess_|wb_)/.test(sessionKey);
    const usingClerk = clerkToken.length > 0;
    // SECURITY: validate the SAME credential we derive the owner subject from. A Clerk token, when
    // present, is the owning identity, so validate IT (the gateway verifies its RS256 signature on
    // /v1/account/sessions) and derive the subject from it. Previously validation preferred the
    // session bearer while the subject was still taken from an UNVERIFIED Clerk token — so a caller
    // could pair their own valid session with a forged Clerk token and impersonate any Clerk owner.
    const strategy = authValidationStrategy(usingClerk, usingSession);
    if (!strategy) {
      res.status(401).json({
        error: 'unauthorized',
        details: 'Sign in or provide a valid Delegators session.'
      });
      return;
    }

    const response = await fetch(
      `${defaultDelegatorsBaseURL}${strategy.validateViaClerk ? '/v1/account/sessions' : '/v1/session/status'}`,
      {
        headers: strategy.validateViaClerk
          ? { 'X-Clerk-Token': clerkToken }
          : { Authorization: `Bearer ${sessionKey}` },
        signal: AbortSignal.timeout(2500)
      }
    );
    if (!response.ok) {
      res.status(401).json({
        error: 'unauthorized',
        details: 'Your sign-in session is invalid or expired.'
      });
      return;
    }
    if (strategy.subjectKind === 'clerk') {
      // Safe: the gateway call above verified this exact token's signature.
      const subject = clerkSubjectFromVerifiedToken(clerkToken);
      if (!subject) {
        res.status(401).json({
          error: 'unauthorized',
          details: 'Your sign-in session is invalid or expired.'
        });
        return;
      }
      res.locals.workbenchAuth = {
        kind: 'clerk',
        subject: stableAuthSubject('clerk', subject)
      } satisfies WorkbenchAuthContext;
    } else if (sessionKey) {
      res.locals.workbenchAuth = {
        kind: 'session',
        subject: stableAuthSubject('session', sessionKey)
      } satisfies WorkbenchAuthContext;
    } else {
      res.status(401).json({
        error: 'unauthorized',
        details: 'Sign in or provide a valid Delegators session.'
      });
      return;
    }
    next();
  } catch {
    res.status(503).json({
      error: 'identity_unavailable',
      details: 'Identity verification is temporarily unavailable.'
    });
  }
}

function currentWorkbenchAuth(
  res: express.Response
): WorkbenchAuthContext | undefined {
  return res.locals.workbenchAuth as WorkbenchAuthContext | undefined;
}

async function loadAuthorizedRun(
  req: express.Request,
  res: express.Response
): Promise<WorkbenchRun | null> {
  const run = await runRepository.get(runIdParam(req)).catch(() => null);
  if (!run || !canAccessRun(run, res)) {
    res
      .status(404)
      .json({ error: 'run_not_found', details: 'Workbench run not found.' });
    return null;
  }
  return run;
}

function canAccessRun(run: WorkbenchRun, res: express.Response): boolean {
  if (!isProd || allowUnauthenticatedUnsafe) return true;
  const subject = currentWorkbenchAuth(res)?.subject;
  return Boolean(subject && run.ownerSubject === subject);
}

async function resolveDelegatorsSessionKey(
  req: express.Request
): Promise<string | null> {
  const sessionKey = (
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? ''
  ).trim();
  if (/^(sess_|wb_)/.test(sessionKey)) return sessionKey;
  const clerkToken = firstHeader(req.headers['x-clerk-token']).trim();
  if (!clerkToken) return null;
  try {
    const walletResponse = await fetch(
      `${defaultDelegatorsBaseURL}/v1/account/wallet`,
      {
        headers: { 'X-Clerk-Token': clerkToken },
        signal: AbortSignal.timeout(2500)
      }
    );
    if (!walletResponse.ok) return null;
    const wallet = (await walletResponse.json()) as { session_key?: string };
    return wallet.session_key?.trim() || null;
  } catch {
    return null;
  }
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function stableAuthSubject(kind: string, value: string): string {
  return `${kind}:${createHash('sha256').update(value).digest('hex').slice(0, 48)}`;
}

function clerkSubjectFromVerifiedToken(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { sub?: unknown };
    return typeof decoded.sub === 'string' && decoded.sub.trim()
      ? decoded.sub
      : null;
  } catch {
    return null;
  }
}

function optionalOrigin(raw?: string): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
}

function uniqueCspSources(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'delegators-workbench' });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'delegators-workbench' });
});

app.get('/readyz', async (_req, res) => {
  const checks = await collectReadinessChecks(defaultDelegatorsBaseURL);
  const ready = checks.every((check) => check.ok);
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    service: 'delegators-workbench',
    checks
  });
});

app.get('/metrics', (_req, res) => {
  setGauge('workbench_active_runs', runCoordinator.activeRunCount());
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(renderPrometheusMetrics());
});

app.get('/api/config', (_req, res) => {
  res.json({
    delegatorsBaseURL: defaultDelegatorsBaseURL,
    defaultModel
  });
});

app.get('/api/account/wallet', requireWorkbenchAuth, async (req, res) => {
  const clerkToken = firstHeader(req.headers['x-clerk-token']).trim();
  if (!clerkToken) {
    res.status(401).json({
      error: 'unauthorized',
      details: 'Sign in to open your Workbench wallet.'
    });
    return;
  }
  try {
    const response = await fetch(
      `${defaultDelegatorsBaseURL}/v1/account/wallet`,
      {
        headers: { 'X-Clerk-Token': clerkToken },
        signal: AbortSignal.timeout(5000)
      }
    );
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      res.status(response.status).json(payload);
      return;
    }
    res.json({ ...payload, endpoint: defaultDelegatorsBaseURL });
  } catch {
    res.status(503).json({
      error: 'wallet_unavailable',
      details: 'The Workbench wallet service is unavailable.'
    });
  }
});

app.get('/api/account/usage', requireWorkbenchAuth, async (req, res) => {
  const clerkToken = firstHeader(req.headers['x-clerk-token']).trim();
  if (!clerkToken) {
    res.status(401).json({
      error: 'unauthorized',
      details: 'Sign in to view Workbench usage.'
    });
    return;
  }
  try {
    const walletResponse = await fetch(
      `${defaultDelegatorsBaseURL}/v1/account/wallet`,
      {
        headers: { 'X-Clerk-Token': clerkToken },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!walletResponse.ok) {
      const payload = await walletResponse.json().catch(() => ({}));
      res.status(walletResponse.status).json(payload);
      return;
    }
    const wallet = (await walletResponse.json()) as { session_key?: string };
    if (!wallet.session_key) {
      res.status(502).json({
        error: 'invalid_wallet',
        details: 'The account wallet did not return a session.'
      });
      return;
    }
    const headers = { Authorization: `Bearer ${wallet.session_key}` };
    const [statusResponse, usageResponse] = await Promise.all([
      fetch(`${defaultDelegatorsBaseURL}/v1/session/status`, {
        headers,
        signal: AbortSignal.timeout(5000)
      }),
      fetch(`${defaultDelegatorsBaseURL}/v1/session/usage`, {
        headers,
        signal: AbortSignal.timeout(5000)
      })
    ]);
    if (!statusResponse.ok || !usageResponse.ok) {
      res.status(502).json({
        error: 'usage_unavailable',
        details: 'Could not load Workbench usage.'
      });
      return;
    }
    const [status, usage] = await Promise.all([
      statusResponse.json(),
      usageResponse.json()
    ]);
    res.json({
      status,
      events: (usage as { events?: unknown[] }).events ?? []
    });
  } catch {
    res.status(503).json({
      error: 'usage_unavailable',
      details: 'Could not load Workbench usage.'
    });
  }
});

const VoiceTranscribeSchema = z.object({
  audio: z.string().min(16),
  format: z.enum(['wav', 'mp3']).optional().default('wav'),
  language: z.string().optional().default('auto'),
  duration_seconds: z.number().positive().optional()
});

// Browser → workbench (same origin) → gateway. Avoids cross-origin gateway calls that
// caused "failed to fetch" when the wallet seeds an in-network gateway host the browser
// cannot reach, or when production CORS blocks a direct browser → gateway POST.
app.post(
  '/api/voice/transcribe',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = VoiceTranscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }
    const sessionKey = await resolveDelegatorsSessionKey(req);
    if (!sessionKey) {
      res.status(401).json({
        error: 'unauthorized',
        details: 'No active Delegators session for voice transcription.'
      });
      return;
    }
    try {
      const response = await fetch(
        `${defaultDelegatorsBaseURL}/v1/audio/transcriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionKey}`,
            'X-Project-ID': 'delegators-workbench'
          },
          body: JSON.stringify({
            audio: parsed.data.audio,
            format: parsed.data.format,
            language: parsed.data.language,
            duration_seconds: parsed.data.duration_seconds
          }),
          signal: AbortSignal.timeout(
            Math.min(Math.max(requestTimeoutMs, 45_000), 60_000)
          )
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        res.status(response.status).json(payload);
        return;
      }
      res.json(payload);
    } catch {
      res.status(503).json({
        error: 'transcription_unavailable',
        details: 'Voice transcription service is unavailable.'
      });
    }
  }
);

app.get('/api/skills', (_req, res) => {
  res.json({ skills: skillCatalog });
});

app.post('/api/v2/runs', requireWorkbenchAuth, rateLimit, async (req, res) => {
  const parsed = CreateWorkbenchRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      details: formatZodError(parsed.error)
    });
    return;
  }
  try {
    const run = await runCoordinator.create(
      parsed.data,
      currentWorkbenchAuth(res)?.subject
    );
    res.status(202).location(`/api/v2/runs/${run.id}`).json({ run });
  } catch (error) {
    sendAgentError(res, error);
  }
});

app.get('/api/v2/runs/:runId', requireWorkbenchAuth, async (req, res) => {
  const stored = await loadAuthorizedRun(req, res);
  if (!stored) return;
  const run = await runCoordinator.get(stored.id).catch(() => stored);
  if (!run) {
    res
      .status(404)
      .json({ error: 'run_not_found', details: 'Workbench run not found.' });
    return;
  }
  res.json({ run });
});

app.get(
  '/api/v2/runs/:runId/events',
  requireWorkbenchAuth,
  async (req, res) => {
    const run = await loadAuthorizedRun(req, res);
    if (!run) {
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let cursor =
      typeof req.headers['last-event-id'] === 'string'
        ? req.headers['last-event-id']
        : typeof req.query.cursor === 'string'
          ? req.query.cursor
          : undefined;
    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    while (!closed) {
      const events = await runRepository
        .listEvents(run.id, cursor)
        .catch(() => []);
      for (const envelope of events) {
        if (closed) break;
        cursor = envelope.id;
        res.write(`id: ${envelope.id}\n`);
        res.write('event: progress\n');
        res.write(`data: ${JSON.stringify(envelope)}\n\n`);
      }
      const latest = await runCoordinator.get(run.id);
      if (!latest || isTerminalRunStatus(latest.status)) {
        if (!closed) res.end();
        break;
      }
      res.write(': heartbeat\n\n');
      await waitForRunEvent(run.id, 1500);
    }
  }
);

app.post(
  '/api/v2/runs/:runId/cancel',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    try {
      const stored = await loadAuthorizedRun(req, res);
      if (!stored) return;
      const run = await runCoordinator.cancel(stored.id);
      res.status(202).json({ run });
    } catch (error) {
      sendRunActionError(res, error);
    }
  }
);

app.post(
  '/api/v2/runs/:runId/instructions',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = WorkbenchRunInstructionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }
    try {
      const stored = await loadAuthorizedRun(req, res);
      if (!stored) return;
      const run = await runCoordinator.instruct(
        stored.id,
        parsed.data.instruction
      );
      res.status(202).json({ run });
    } catch (error) {
      sendRunActionError(res, error);
    }
  }
);

app.get(
  '/api/v2/runs/:runId/sources',
  requireWorkbenchAuth,
  async (req, res) => {
    const run = await loadAuthorizedRun(req, res);
    if (!run) {
      return;
    }
    res.json({ sources: run.artifact?.citations ?? [] });
  }
);

app.get(
  '/api/v2/runs/:runId/versions',
  requireWorkbenchAuth,
  async (req, res) => {
    const run = await loadAuthorizedRun(req, res);
    if (!run) {
      return;
    }
    const artifacts = run.artifactHistory?.length
      ? run.artifactHistory
      : run.artifact
        ? [run.artifact]
        : [];
    res.json({
      versions: artifacts.map((artifact, index) => ({
        id: `v${index + 1}`,
        artifact,
        createdAt:
          index === artifacts.length - 1 ? run.updatedAt : run.createdAt
      }))
    });
  }
);

app.post(
  '/api/agent/artifact/stream',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = GenerateArtifactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }

    const stream = openNdjsonStream(res);
    const reporter = createProgressReporter(stream.write);

    try {
      const artifact = await generateArtifact(parsed.data, { reporter });
      stream.write({ type: 'artifact', artifact });
    } catch (error) {
      stream.write({ type: 'error', message: streamErrorMessage(error) });
    } finally {
      stream.end();
    }
  }
);

// Workbench artifacts drive a *-thinking quality pass + an art-vision inspection
// pass. Check eligibility upfront
// (single source of truth: gateway /v1/session/status workbench_eligible) so a
// retired/ineligible pass fails fast with a clear message instead of 403-ing
// mid-pipeline after burning model calls. Returns false only when the gateway says ineligible;
// unknown/Clerk-wallet paths are left to the gateway's own entitlement check.
async function workbenchPassIneligible(sessionKey: string): Promise<boolean> {
  if (!/^sess_/.test(sessionKey)) return false;
  try {
    const r = await fetch(`${defaultDelegatorsBaseURL}/v1/session/status`, {
      headers: { Authorization: `Bearer ${sessionKey}` },
      signal: AbortSignal.timeout(4000)
    });
    if (!r.ok) return false;
    const body = (await r.json().catch(() => null)) as {
      workbench_eligible?: boolean;
    } | null;
    return body?.workbench_eligible === false;
  } catch {
    return false;
  }
}

const WORKBENCH_PLAN_REQUIRED =
  'The Workbench studio needs a Pro pass with thinking and image-analysis access, or an enabled UltraSpeed beta pass.';

app.post(
  '/api/agent/artifact',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = GenerateArtifactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }

    if (await workbenchPassIneligible(parsed.data.sessionKey)) {
      res.status(402).json({
        error: 'workbench_plan_required',
        details: WORKBENCH_PLAN_REQUIRED
      });
      return;
    }

    try {
      const artifact = await generateArtifact(parsed.data);
      res.json(artifact);
    } catch (error) {
      sendAgentError(res, error);
    }
  }
);

app.post(
  '/api/agent/refine/stream',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = RefineArtifactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }

    const stream = openNdjsonStream(res);
    const reporter = createProgressReporter(stream.write);

    try {
      const artifact = await refineArtifact(parsed.data, { reporter });
      stream.write({ type: 'artifact', artifact });
    } catch (error) {
      stream.write({ type: 'error', message: streamErrorMessage(error) });
    } finally {
      stream.end();
    }
  }
);

app.post(
  '/api/agent/refine',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = RefineArtifactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }

    try {
      const artifact = await refineArtifact(parsed.data);
      res.json(artifact);
    } catch (error) {
      sendAgentError(res, error);
    }
  }
);

// Web search harness — DuckDuckGo instant answers (no API key required).
// Used by the multi-step agentic harness when the brief triggers search keywords.
const SearchRequestSchema = z.object({
  query: z.string().min(1).max(200),
  endpoint: z.string().trim().url().max(300).optional(),
  sessionKey: z.string().trim().min(1).max(240).optional(),
  mode: z
    .enum(['auto', 'fast', 'deep-lite', 'deep', 'deep-reasoning'])
    .optional()
});

app.post(
  '/api/agent/search',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = SearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }

    try {
      const platform = parsed.data.sessionKey
        ? {
            baseURL: resolveDelegatorsBaseURL(
              parsed.data.endpoint ?? defaultDelegatorsBaseURL
            ),
            sessionKey: parsed.data.sessionKey
          }
        : undefined;
      const results = await webSearch(parsed.data.query, {
        platform,
        maxResults: 6,
        fresh: true,
        mode: parsed.data.mode ?? 'deep'
      });
      res.json({ results });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed.';
      res.status(502).json({ error: 'search_error', details: message });
    }
  }
);

// Plain conversation lane: the Workbench is a real assistant, not only an
// artifact factory. Metered through the same wallet at the gateway; no JSON
// contract, no tools — just a helpful, concise chat turn with thread context.
const ChatRequestSchema = z.object({
  endpoint: z.string().trim().min(1),
  sessionKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
  threadId: z.string().trim().min(1).max(120).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().min(1).max(8000)
      })
    )
    .min(1)
    .max(16),
  references: WorkbenchReferencesSchema.optional(),
  artifact: ArtifactDocumentSchema.optional(),
  templateId: z.string().trim().min(1).max(120).optional()
});

app.post(
  '/api/agent/chat',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }
    try {
      const input = parsed.data;
      const delegatorsBaseURL = resolveDelegatorsBaseURL(input.endpoint);
      assertCredentialAllowedForEndpoint(input.sessionKey, delegatorsBaseURL);
      const lastUserMessage =
        [...input.messages].reverse().find((message) => message.role === 'user')
          ?.text ?? '';
      const referencePack = input.references?.length
        ? await prepareReferencePack({
            brief: lastUserMessage,
            references: input.references,
            platform: {
              baseURL: delegatorsBaseURL,
              sessionKey: input.sessionKey
            }
          })
        : null;
      const referenceContext = referencePack
        ? [
            'Attached references for this turn (treat them as part of the same user message):',
            referencePack.markdown.slice(0, 24_000)
          ].join('\n')
        : '';
      const templateRecord = input.templateId
        ? findWorkbenchTemplate(input.templateId)
        : undefined;
      const templateContext = templateRecord
        ? buildTemplateChatSystemLines(
            resolveTemplateMetadata(templateRecord)
          ).join('\n')
        : '';
      const messages = [
        {
          role: 'system',
          content: [
            buildWorkbenchClockContext(),
            'You are Delegators Workbench — a sharp, friendly professional assistant inside an artifact studio.',
            'Answer naturally and concisely. You are NOT generating an artifact in this turn.',
            'Render replies as open plain prose: short paragraphs with breathing room, real tables only when comparing data. Never use **bold**, __underline__, --- dividers, or bullet asterisks in chat.',
            'Write like a senior professional, never a marketing bot: no emoji, no hype words, no markdown decoration. Prefer precise prose over bullet stuffing or restating the question.',
            'For structured answers, use short labeled lines ("Topic: detail") or numbered sentences — never walls of asterisks or hyphen bullets.',
            'When advising on loaded templates, reference real slide or section titles from the structure map and suggest what content belongs where.',
            'For current facts, prices, laws, schedules, news, or citations, use web_search or web_fetch before making claims. Never mention internal provider or tool names in your reply.',
            'Never output an artifact JSON schema, raw deck/report/sheet JSON, or claim that a downloadable file was created in this chat lane.',
            'If the user says continue, resume, retry, or finish an earlier file task, respond only with a short plain-prose explanation that the saved artifact run must be resumed by the Workbench artifact runner.',
            'When the user seems to want a finished file (deck, report, sheet, resume, email), do help with the substance, and mention they can type @ppt, @pdf, @xlsx, @resume or @email to have you build the real downloadable file.',
            templateContext,
            referenceContext,
            input.artifact
              ? `Current workspace artifact (facts only):\n${summarizePriorArtifact(input.artifact, 0)}`
              : ''
          ]
            .filter(Boolean)
            .join('\n')
        },
        ...input.messages
          .slice(-12)
          .map((message) => ({ role: message.role, content: message.text }))
      ];
      const completionInput = {
        sessionKey: input.sessionKey,
        model: input.model,
        threadId: input.threadId
      };
      const reply = await runChatHarness({
        messages: messages as DelegatorsMessage[],
        platformSearch: {
          baseURL: delegatorsBaseURL,
          sessionKey: input.sessionKey
        },
        budget: policyForChat(input.model),
        initialTemperature: 0.6,
        completeTurn: (request) =>
          completeDelegatorsTurn(
            completionInput,
            delegatorsBaseURL,
            request.messages,
            {
              temperature: request.temperature,
              toolsEnabled: request.toolsEnabled,
              plain: true,
              toolDefinitions: request.toolsEnabled
                ? chatWebToolDefinitions
                : undefined
            }
          )
      });
      res.json({ reply: formatAssistantProse(reply) });
    } catch (error) {
      sendAgentError(res, error);
    }
  }
);

app.post(
  '/api/artifacts/export',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    const parsed = ExportArtifactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'invalid_request',
        details: formatZodError(parsed.error)
      });
      return;
    }

    try {
      const exported = await buildExport(
        parsed.data.artifact,
        parsed.data.format
      );
      res.setHeader('Content-Type', exported.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exported.filename}"`
      );
      res.send(exported.body);
    } catch (error) {
      sendAgentError(res, error);
    }
  }
);

app.get('/api/integrations/status', requireWorkbenchAuth, async (req, res) => {
  await handleIntegrationsStatus(req, res);
});

app.post(
  '/api/integrations/google/connect',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleGoogleConnect(req, res);
  }
);

app.get('/api/integrations/google/callback', async (req, res) => {
  await handleGoogleCallback(req, res);
});

app.delete(
  '/api/integrations/google',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleGoogleDisconnect(req, res);
  }
);

app.post(
  '/api/integrations/microsoft/connect',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleMicrosoftConnect(req, res);
  }
);

app.get('/api/integrations/microsoft/callback', async (req, res) => {
  await handleMicrosoftCallback(req, res);
});

app.delete(
  '/api/integrations/microsoft',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleMicrosoftDisconnect(req, res);
  }
);

app.post(
  '/api/integrations/export',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleCloudExport(req, res);
  }
);

app.get('/api/knowledge/graph', requireWorkbenchAuth, async (req, res) => {
  await handleKnowledgeGraph(req, res);
});

app.post(
  '/api/knowledge/search',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleKnowledgeSearch(req, res);
  }
);

app.get('/api/knowledge/browse', requireWorkbenchAuth, async (req, res) => {
  await handleKnowledgeBrowse(req, res);
});

app.post(
  '/api/knowledge/import',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleKnowledgeImport(req, res);
  }
);

app.post(
  '/api/knowledge/memories',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleKnowledgeAddMemory(req, res);
  }
);

app.delete(
  '/api/knowledge/memories/:memoryId',
  requireWorkbenchAuth,
  rateLimit,
  async (req, res) => {
    await handleKnowledgeDeleteMemory(req, res);
  }
);

const staticRoot =
  process.env.WORKBENCH_STATIC_ROOT ?? path.resolve(process.cwd(), 'dist');
const staticMaxAge = process.env.NODE_ENV === 'production' ? '1h' : 0;

// Legacy moodboard PNGs removed — block path so browsers cannot resurrect cached covers.
app.get('/template-gallery/{*splat}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res
    .status(410)
    .type('text/plain')
    .send(
      'Template gallery PNG previews were removed. Use live artifact render.'
    );
});

app.use(
  express.static(staticRoot, {
    etag: true,
    maxAge: staticMaxAge,
    index: false
  })
);
app.get('/{*splat}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(staticRoot, 'index.html'));
});

app.listen(port, bindHost, () => {
  console.log(
    `delegators-workbench (internal) listening on ${bindHost}:${port}`
  );
});

function openNdjsonStream(res: express.Response): {
  write: (event: WorkbenchStreamEvent) => void;
  end: () => void;
} {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  return {
    write(event) {
      res.write(`${JSON.stringify(event)}\n`);
    },
    end() {
      res.end();
    }
  };
}

function createProgressReporter(
  write: (event: WorkbenchStreamEvent) => void
): ProgressReporter {
  const emit = (event: WorkbenchStreamEvent) => {
    const sanitized = sanitizeStreamEvent(event);
    if (sanitized.type === 'message' && !sanitized.text.trim()) return;
    write(sanitized);
  };
  return {
    status(message) {
      emit({ type: 'status', message });
    },
    plan(title, items) {
      emit({ type: 'plan', title, items });
    },
    checklist(items) {
      emit({ type: 'checklist', items });
    },
    message(text) {
      emit({ type: 'message', text });
    },
    question(question) {
      emit({ type: 'question', ...question });
    }
  };
}

async function executeManagedRun(
  request: CreateWorkbenchRunRequest,
  context: RunExecutionContext
): Promise<ArtifactDocument> {
  const reporter = context.reporter;
  const control: ExecutionControl = {
    signal: context.signal,
    drainInstructions: context.drainInstructions,
    waitForInstructions: context.waitForInstructions,
    checkpoint: context.checkpoint,
    runId: context.runId
  };
  return request.operation === 'generate'
    ? generateArtifact(request, { reporter, control })
    : refineArtifact(request, { reporter, control });
}

function streamErrorMessage(error: unknown): string {
  if (error instanceof AgentHttpError) {
    if (error.status === 429) {
      return 'Delegators is busy right now (rate limit). Wait a few seconds and send again.';
    }
    return sanitizeClientError(new Error(error.body || error.message));
  }
  return sanitizeClientError(error);
}

function formatSkillInstructions(kind: ArtifactKind): string[] {
  if (kind === 'report') {
    return [
      'For a document: create complete sections and tables when they improve the requested material.',
      'Do not substitute a generic memo when the user asked for a specific factual document.'
    ];
  }
  if (kind === 'deck') {
    return [
      'For a presentation: create a coherent slide sequence and include speaker notes when they add useful context.',
      'Follow the requested slide count, density, visual direction, and audience instead of imposing a default deck style.'
    ];
  }
  if (kind === 'sheet') {
    return [
      'For spreadsheet/XLSX: produce explicit columns, rows, and formulas when requested.',
      'Prefer workbook sheets or section tables over prose when the user asks for data work.'
    ];
  }
  if (kind === 'resume') {
    return [
      'For a resume or cover letter: preserve truthful user facts and follow the requested structure and visual direction.'
    ];
  }
  return [
    'Keep the artifact complete and exportable while following explicit user instructions.'
  ];
}

function designPromptLines(
  primaryFormat: ArtifactPrimaryFormat,
  brief = '',
  kind?: ArtifactKind
): string[] {
  const profile = brief ? detectArtifactAudience(brief, kind) : null;
  const templateLine = profile
    ? kind === 'deck'
      ? `Audience default deck template: ${profile.deckTemplate}. Set design.template unless the user overrides.`
      : `Audience default document template: ${profile.documentTemplate}. Set design.template unless the user overrides.`
    : '';
  return [
    `The primary downloadable format must be "${primaryFormat}".`,
    'Explicit user instructions override default visual choices, including fonts, colors, page size, orientation, aspect ratio, density, structure, and length.',
    'Populate design with the user-requested choices. Convert named colors to six-digit hex values. Do not claim an exact font or color that the user did not request unless choosing a sensible default.',
    templateLine,
    profile ? `Audience density baseline: ${profile.density}.` : '',
    'design shape: { template?, visualDirection?, headingFontFamily?, bodyFontFamily?, pageSize?: "a4"|"letter"|"legal", orientation?: "portrait"|"landscape", slideAspect?: "wide"|"standard", density?: "compact"|"balanced"|"airy", includeTableOfContents?: boolean, includePageNumbers?: boolean, showSectionNumbers?: boolean, palette?: { background?, surface?, text?, muted?, primary?, accent? } }.'
  ].filter(Boolean);
}

function referenceDesignPromptLines(
  pack: ReferencePack | null,
  brief: string
): string[] {
  const profiles =
    pack?.references.flatMap((reference) =>
      reference.designProfile ? [reference.designProfile] : []
    ) ?? [];
  if (profiles.length === 0) return [];
  const mimicRequested =
    /\b(?:same|match(?:ing|ed)?|mirror(?:ing|ed)?|recreat(?:e|ing|ed)|replicat(?:e|ing|ed)|follow(?:ing|ed)?|us(?:e|ing|ed))\b[\s\S]{0,40}\b(?:style|theme|design|look|visual|format)\b|\b(?:like|similar to|inspired by)\s+(?:this|the|uploaded|attached|reference)\b/i.test(
      brief
    );
  return [
    'Uploaded presentations include deterministic OOXML design profiles. Exact theme fonts, theme colors, slide aspect, and layout rhythm are stronger evidence than visual guesses.',
    mimicRequested
      ? 'The user requested reference-style fidelity. Copy compatible extracted font families, aspect ratio, palette colors, density, and layout rhythm into artifact.design instead of selecting a generic preset.'
      : 'Use the extracted presentation design only when it supports the requested direction; explicit user instructions still win.'
  ];
}

function researchPromptLines(pack: ResearchPack | null): string[] {
  const lines = [
    'Use the research pack as the current source of truth for public facts and citations.',
    'Do not invent current claims that are absent from the source pack.'
  ];
  const sources = pack?.sources ?? [];
  const urls = sources
    .map((source) => source.url)
    .filter((url): url is string => Boolean(url));
  if (urls.length > 0) {
    // The validator rejects any citation URL outside this exact set, so the
    // model must see the literal allowed list — paraphrased or remembered URLs
    // fail the run.
    lines.push(
      'You MUST include a top-level `citations` array. Each entry is { "id": "S1", "label": string, "url": string }.'
    );
    lines.push(
      'Every citation ID and URL must be copied VERBATIM from this allowed source list (no other IDs or URLs are accepted):'
    );
    sources
      .slice(0, 8)
      .forEach((source) => lines.push(`- ${source.id}: ${source.url}`));
    lines.push(
      'Add `sourceIds: ["S1", ...]` to every slide or section that uses an external fact, number, quote, chart, or comparison.'
    );
    lines.push(
      'Cite only sources that directly support that slide or section. Cover and purely transitional slides may use an empty sourceIds array.'
    );
  }
  if (pack?.contradictionCandidates.length) {
    lines.push(
      'The research pack contains contradiction candidates. Reconcile scope/date/methodology in the content or present the disagreement explicitly; never silently choose a convenient value.'
    );
  }
  if (pack?.requestedSubject && pack.confidence !== 'high') {
    lines.push(
      `The current source pack did not cleanly verify "${pack.requestedSubject}".`
    );
    lines.push(
      'Do not substitute unrelated projects from the same company or pivot to a generic company overview.'
    );
    lines.push(
      'If the topic is unverified, say that explicitly, explain the search result honestly, and ask for a source or alternate name in nextQuestions.'
    );
  }
  return lines;
}

function summarizeReferencePack(pack: ReferencePack): string {
  return pack.references
    .map((reference) => {
      const warnings = reference.warnings.length
        ? ` Warning: ${reference.warnings.join(' ')}`
        : '';
      return `- ${reference.id}: ${reference.name} (${reference.extractor}).${warnings}`;
    })
    .join('\n');
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function run(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      const result = await worker(item);
      if (result) results.push(result);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );
  return results;
}

async function createProviderReferenceAnalysis(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  pack: ReferencePack,
  brief: string,
  signal?: AbortSignal
): Promise<string | null> {
  const jobs = buildReferenceAnalysisJobs(pack, brief);
  const completed = await mapLimited(jobs, 2, async (job) => {
    throwIfAborted(signal);
    const timeout = createChildTimeoutSignal(
      signal,
      Math.min(55_000, requestTimeoutMs)
    );
    try {
      const turn = await completeDelegatorsTurn(
        input,
        delegatorsBaseURL,
        job.messages,
        {
          temperature: 0.1,
          toolsEnabled: false,
          plain: true,
          maxTokens: 3200,
          signal: timeout.signal
        }
      );
      const analysis = turn.content.trim().slice(0, 12_000);
      return analysis
        ? { referenceId: job.referenceId, name: job.name, analysis }
        : null;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn(
        `[workbench] analysis unavailable for ${job.referenceId}; continuing with extracted material:`,
        error instanceof Error ? error.message : error
      );
      return null;
    } finally {
      timeout.cleanup();
    }
  });
  if (completed.length === 0) return null;
  if (completed.length === 1) return completed[0].analysis;

  const timeout = createChildTimeoutSignal(
    signal,
    Math.min(55_000, requestTimeoutMs)
  );
  try {
    const turn = await completeDelegatorsTurn(
      input,
      delegatorsBaseURL,
      buildReferenceSynthesisMessages(completed, brief),
      {
        temperature: 0.05,
        toolsEnabled: false,
        plain: true,
        maxTokens: 5000,
        signal: timeout.signal
      }
    );
    return (
      turn.content.trim().slice(0, 30_000) ||
      completed
        .map(
          (entry) => `## ${entry.referenceId}: ${entry.name}\n${entry.analysis}`
        )
        .join('\n\n')
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    return completed
      .map(
        (entry) => `## ${entry.referenceId}: ${entry.name}\n${entry.analysis}`
      )
      .join('\n\n')
      .slice(0, 30_000);
  } finally {
    timeout.cleanup();
  }
}

async function generateArtifact(
  input: GenerateArtifactRequest,
  options: { reporter?: ProgressReporter; control?: ExecutionControl } = {}
): Promise<ArtifactDocument> {
  throwIfAborted(options.control?.signal);
  const delegatorsBaseURL = resolveDelegatorsBaseURL(input.endpoint);
  assertCredentialAllowedForEndpoint(input.sessionKey, delegatorsBaseURL);
  const sessionStreamLimit = input.sessionKey
    ? await resolveSessionStreamLimit(
        input.sessionKey,
        delegatorsBaseURL
      ).catch(() => undefined)
    : undefined;
  const selectedSkill =
    resolveSkillFromText(input.brief) ??
    (input.skillId ? findSkillById(input.skillId) : undefined) ??
    inferSkillFromThreadRequest(input.brief, input.priorArtifacts ?? []);
  const threadIntent = resolveThreadArtifactIntent({
    brief: input.brief,
    priorArtifacts: input.priorArtifacts,
    skill: selectedSkill,
    outputFormat: input.outputFormat,
    artifactKind: selectedSkill?.kind ?? input.skill,
    templateId: input.templateId
  });
  const templateSkeleton =
    threadIntent.mode === 'template-fill'
      ? input.priorArtifacts?.at(-1)
      : undefined;
  const artifactRoutingLines = [
    ...threadIntent.routingLines,
    ...buildTemplateHarnessRoutingLines({
      templateId: input.templateId,
      scaffoldId: input.scaffoldId,
      designPreset: input.designPreset
    }),
    ...(templateSkeleton
      ? buildTemplateSkeletonRoutingLines(templateSkeleton)
      : [])
  ];
  const artifactKind = threadIntent.targetKind;
  const primaryFormat = threadIntent.targetFormat;
  const instructions =
    selectedSkill?.instruction ?? skillInstructions[artifactKind];
  const skillPack = buildArtifactSkillPack({
    kind: artifactKind,
    primaryFormat,
    selectedSkill
  });
  const cleanBrief = stripSkillTags(input.brief) || input.brief;
  const userContract = buildUserPromptContract(cleanBrief, artifactKind);
  const audienceProfile = detectArtifactAudience(cleanBrief, artifactKind);
  const threadContext = renderThreadContext(
    input.conversation,
    input.priorArtifacts ?? [],
    artifactRoutingLines
  );
  const threadSummary = renderThreadSummary(
    input.conversation,
    input.priorArtifacts
  );
  const researchBrief = buildArtifactResearchBrief(cleanBrief, threadSummary);
  const hasUserReferences = Boolean(
    input.references?.length || input.sourceText?.trim()
  );
  const needsResearch = briefNeedsResearch(researchBrief, artifactKind, {
    hasReferences: hasUserReferences
  });
  const depthAssessment = assessRunDepthWithContext(cleanBrief, {
    kind: artifactKind,
    needsResearch,
    hasReferences: hasUserReferences,
    priorArtifactCount: input.priorArtifacts?.length ?? 0,
    requiresComputation:
      briefRequiresTable(cleanBrief) || briefRequiresComputation(cleanBrief),
    model: input.model
  });
  const fastQuality = qualityMode === 'fast';
  const runDepth: RunDepthTier = fastQuality ? 'fast' : depthAssessment.tier;
  let referencePack = await prepareReferencePack({
    brief: cleanBrief,
    references: input.references,
    platform: input.sessionKey
      ? { baseURL: delegatorsBaseURL, sessionKey: input.sessionKey }
      : undefined,
    onStatus: (message) => options.reporter?.status(message),
    analyzeImage: nativeImageAnalyzer(
      delegatorsBaseURL,
      input.sessionKey,
      input.threadId,
      options.reporter
    )
  });
  const referenceSummary = referencePack
    ? summarizeReferencePack(referencePack)
    : '';
  const referencePlanningContext = referencePack?.analysis
    ? `Grounded reference analysis:\n${referencePack.analysis}`
    : referenceSummary
      ? `Available references:\n${referenceSummary}`
      : '';
  const phaseTimer = createRunPhaseTimer();
  const useTemplateSkeletonFill =
    threadIntent.mode === 'template-fill' && Boolean(templateSkeleton);
  const structuredPipeline = useTemplateSkeletonFill
    ? false
    : !fastQuality && shouldUseStructuredPipeline(artifactKind, cleanBrief);
  let preflight = fallbackArtifactPreflight(
    artifactKind,
    cleanBrief,
    needsResearch,
    { structured: structuredPipeline }
  );
  let plan = preflight.plan;
  options.reporter?.status(`${depthStatusLabel(runDepth)} · lock intent`);

  const explicitBrief = briefIsExplicit(cleanBrief, artifactKind);
  const deferReferenceAnalysis = Boolean(
    referencePack && explicitBrief && needsResearch && !referencePack.analysis
  );
  if (referencePack && !deferReferenceAnalysis && !fastQuality) {
    options.reporter?.status('Analyzing uploaded material');
    const analysis = await createProviderReferenceAnalysis(
      input,
      delegatorsBaseURL,
      referencePack,
      cleanBrief,
      options.control?.signal
    );
    if (analysis)
      referencePack = attachReferenceAnalysis(referencePack, analysis);
  }
  if (explicitBrief || fastQuality) {
    options.reporter?.message(
      deterministicPreflightReply(cleanBrief, artifactKind, primaryFormat)
    );
  } else {
    const providerPreflight = await createProviderPreflight(
      input,
      delegatorsBaseURL,
      {
        kind: artifactKind,
        primaryFormat,
        skillLabel: selectedSkill
          ? `${selectedSkill.tag} (${selectedSkill.label})`
          : artifactKind,
        skillInstruction: instructions,
        brief: [
          cleanBrief,
          threadSummary ? `Relevant thread context:\n${threadSummary}` : '',
          referencePlanningContext
        ]
          .filter(Boolean)
          .join('\n\n'),
        needsResearch,
        signal: options.control?.signal
      }
    );
    if (providerPreflight) {
      preflight = {
        ...providerPreflight,
        questions: guardPreflightQuestions(
          cleanBrief,
          providerPreflight.questions,
          artifactKind
        )
      };
      plan = preflight.plan;
      if (
        preflight.questions.length === 0 &&
        providerPreflight.questions.length > 0
      ) {
        plan = fallbackArtifactPreflight(
          artifactKind,
          cleanBrief,
          needsResearch,
          { structured: structuredPipeline }
        ).plan;
      }
    }
    if (preflight.reply) {
      options.reporter?.message(preflight.reply);
    }
  }
  options.reporter?.plan(plan.title, plan.items);

  const clarificationContext = await collectClarificationContext({
    questions: preflight.questions,
    reporter: options.reporter,
    control: options.control,
    plan
  });
  if (clarificationContext) {
    const clarifyIndex = plan.items.findIndex((item) => item.id === 'clarify');
    if (clarifyIndex >= 0) {
      plan = advanceArtifactPlan(plan, clarifyIndex + 1);
      options.reporter?.plan(plan.title, plan.items);
    }
    const followUp = await createClarificationFollowUp(
      input,
      delegatorsBaseURL,
      {
        brief: cleanBrief,
        kind: artifactKind,
        answers: clarificationContext,
        signal: options.control?.signal
      }
    );
    if (followUp) options.reporter?.message(followUp);
    options.reporter?.status('Using your answers to continue');
  }

  let researchPack = null;
  let researchClarificationContext = '';
  const cachedThreadPack = getThreadResearchPack(
    input.sessionKey,
    input.threadId
  );
  const priorThreadPack = researchPackFromPriorArtifacts(
    input.priorArtifacts ?? [],
    cleanBrief
  );
  const reuseThreadResearch = shouldReuseThreadResearch(
    cleanBrief,
    input.priorArtifacts ?? []
  );
  if (needsResearch) {
    plan = advanceArtifactPlan(
      plan,
      plan.items.findIndex((item) => item.id === 'sources')
    );
    options.reporter?.plan(plan.title, plan.items);
    phaseTimer.start('research');
    await options.control?.checkpoint?.(
      'research',
      'Gathering verified sources'
    );
    const researchBriefEnriched = clarificationContext
      ? `${researchBrief}\n\n${clarificationContext}`
      : researchBrief;
    const researchOptions = {
      brief: researchBriefEnriched,
      delegatorsBaseURL,
      sessionKey: input.sessionKey,
      depthTier: runDepth,
      includeImages:
        artifactKind === 'deck' ||
        artifactKind === 'report' ||
        /\b(images?|photos?|pictures?|visuals?|illustrations?)\b/i.test(
          cleanBrief
        ),
      onStatus: (message: string) =>
        options.reporter?.status(phaseTimer.status('research', message))
    };
    let freshPack = null;
    if (deferReferenceAnalysis && referencePack) {
      const [analysis, pack] = await runFatherOrchestrated(
        [
          {
            role: 'source_analyst',
            execute: (signal) =>
              createProviderReferenceAnalysis(
                input,
                delegatorsBaseURL,
                referencePack!,
                cleanBrief,
                signal
              )
          },
          {
            role: 'research_scout',
            execute: () => prepareResearchPack(researchOptions)
          }
        ],
        {
          concurrency: fatherOrchestratorConcurrency(sessionStreamLimit, 2),
          signal: options.control?.signal
        }
      );
      if (analysis)
        referencePack = attachReferenceAnalysis(referencePack, analysis);
      freshPack = pack;
    } else {
      freshPack = await prepareResearchPack(researchOptions);
    }
    researchPack = mergeThreadResearchPacks(
      cachedThreadPack,
      priorThreadPack,
      freshPack
    );
    setThreadResearchPack(input.sessionKey, input.threadId, researchPack);
    throwIfAborted(options.control?.signal);
    if (researchPack) {
      options.reporter?.status(researchPack.summary);
      // Never pause the run on weak research: the pack already tells the model
      // what could not be verified, the model keeps those claims honest and
      // surfaces a precise follow-up via nextQuestions, and the user can send a
      // link as a refinement afterwards. A blocking popup here was pure jank.
    }
  } else if (reuseThreadResearch) {
    researchPack = mergeThreadResearchPacks(
      cachedThreadPack,
      priorThreadPack,
      null
    );
    if (researchPack) {
      options.reporter?.status(researchPack.summary);
    }
  }

  const researchPackMarkdown = researchPack
    ? renderResearchPackMarkdown(researchPack)
    : '';
  const referenceGenerationContext = referencePack
    ? buildReferenceGenerationContext(referencePack)
    : '';
  const availableAssets = mergeArtifactAssets(
    referencePack?.assets ?? [],
    researchPack?.assets ?? [],
    (input.priorArtifacts ?? []).flatMap((artifact) => artifact.assets)
  );
  const combinedSourceText = [
    threadContext
      ? `<thread_context>\n${threadContext}\n</thread_context>`
      : '',
    input.sourceText,
    referenceGenerationContext
      ? `<reference_pack>\n${referenceGenerationContext}\n</reference_pack>`
      : '',
    clarificationContext
      ? `<clarification_answers>\n${clarificationContext}\n</clarification_answers>`
      : '',
    researchClarificationContext
      ? `<research_clarification>\n${researchClarificationContext}\n</research_clarification>`
      : '',
    researchPackMarkdown
      ? `<research_pack>\n${researchPackMarkdown}\n</research_pack>`
      : ''
  ]
    .filter(Boolean)
    .join('\n\n');
  const sourceEvidence = [
    cleanBrief,
    clarificationContext,
    threadContext,
    input.sourceText,
    referenceGenerationContext,
    researchPackMarkdown
  ]
    .filter(Boolean)
    .join('\n\n');
  const messages = [
    {
      role: 'system',
      content: [
        'You are Delegators Workbench, a production artifact agent for documents, presentations, spreadsheets, workplace communication, and academic work.',
        'Return only valid JSON. Do not wrap it in Markdown. Do not include comments.',
        ...depthExecutionBrief(runDepth, depthAssessment.signals),
        ...artifactRoutingLines,
        ...audienceCraftLines(audienceProfile, artifactKind),
        ...credibilityPromptLines(audienceProfile, artifactKind, {
          needsResearch,
          hasSources: (researchPack?.sources.length ?? 0) > 0
        }),
        'Evidence architecture is mandatory for reports and decks: BLUF opening, FACT/ANALYSIS/RECOMMENDATION separation, confidence labels, source footnotes, no decorative charts, no institutional hype, sources/methodology/limitations appendix, and calibrated uncertainty language.',
        'Never invent fake contact details, dates, companies, marks, citations, metrics, or credentials.',
        'Do not invent channel names, approvers, recipients, affected systems, current-state claims, policy rules, or workflow steps that the user did not provide.',
        'When a useful operational detail is missing, ask for it in nextQuestions instead of filling it in.',
        'If a required fact is missing, keep the relevant field honest and add a concrete question to nextQuestions.',
        'Never use placeholders like lorem ipsum, [Company], TBD, dummy, sample, or fake data.',
        ...userPromptContractLines(userContract),
        `The artifact kind must be "${artifactKind}".`,
        `The primary format must be "${primaryFormat}". The current explicit @skill and request override every prior artifact format.`,
        skillPack.guide,
        'Prior artifacts and conversation are thread memory — never an instruction to recreate the previous file type or replay the same deck/report structure.',
        'When the user asks for a different format in the same thread, mine prior artifacts and chat for facts only, then build a NEW deliverable of the requested kind and format.',
        'The JSON must match this shape: { kind, primaryFormat, title, audience, tone, executiveSummary, design, sections, slides?, resume?, sheet?, citations?, nextQuestions? }. Sections and slides support sourceIds: string[].',
        'Do not emit image bytes, data URIs, or an assets array. When validated source images are listed, place them only by copying an available ID into slide.imageAssetId or section.imageAssetId.',
        'sections is always required and must contain finished user-facing content.',
        'Every section object must include heading, body, bullets. bullets is always an array.',
        'When the brief asks for a table, metrics grid, comparison, or spreadsheet-ready data, include a real section.table with columns and rows.',
        'When numeric facts are supplied, calculate derived values explicitly and keep them in the artifact content.',
        'nextQuestions is optional but must contain no more than 6 concrete questions.',
        ...formatSkillInstructions(artifactKind),
        ...designPromptLines(primaryFormat, cleanBrief, artifactKind),
        ...referenceDesignPromptLines(referencePack, cleanBrief),
        ...researchPromptLines(researchPack),
        schemaContractForKind(artifactKind)
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Skill: ${selectedSkill ? `${selectedSkill.tag} (${selectedSkill.label})` : artifactKind}`,
        `Model instructions: ${instructions}`,
        `Preferred tone: ${input.style}`,
        `User brief:\n${cleanBrief}`,
        combinedSourceText
          ? `Source material:\n${combinedSourceText}`
          : 'Source material: none provided',
        artifactKind === 'deck' || artifactKind === 'report'
          ? 'Final reminder: where the data shows a trend, comparison, or composition, emit a real chart object ({ type, title, labels, series: [{ name, values: number[] }], unit? }) on the slide (layout "chart") or section — and set design.template to the curated system that fits this audience.'
          : ''
      ]
        .filter(Boolean)
        .join('\n\n')
    }
  ];

  plan = advanceArtifactPlan(
    plan,
    plan.items.findIndex((item) => item.id === 'build')
  );
  options.reporter?.plan(plan.title, plan.items);

  const parseOptionsBase = {
    expectedKind: artifactKind,
    expectedPrimaryFormat: primaryFormat,
    threadArtifactMode: threadIntent.mode,
    priorArtifact: input.priorArtifacts?.at(-1),
    audienceProfile,
    researchPack,
    fallbackTone: input.style,
    requiredTable: briefRequiresTable(cleanBrief),
    citationsRequired: audienceCitationsRequired(
      audienceProfile,
      needsResearch,
      (researchPack?.sources.length ?? 0) > 0
    ),
    researchConfidence: researchPack?.confidence,
    requestedSubject: researchPack?.requestedSubject,
    allowedCitationUrls: allowedResearchCitationUrls(researchPack),
    allowedCitationIds: new Set(
      (researchPack?.sources ?? []).map((source) => source.id)
    ),
    allowedCitations: new Map(
      (researchPack?.sources ?? []).flatMap((source) =>
        source.url ? [[source.id, source.url]] : []
      )
    ),
    availableAssets,
    referenceDesignProfiles: referencePack?.references.flatMap((reference) =>
      reference.designProfile ? [reference.designProfile] : []
    ),
    sourceBrief: [
      cleanBrief,
      clarificationContext,
      researchClarificationContext
    ]
      .filter(Boolean)
      .join('\n\n'),
    sourceEvidence,
    seedFiles: [
      { path: 'input/brief.md', content: cleanBrief },
      ...skillPack.seedFiles,
      ...(threadContext
        ? [{ path: 'context/thread-context.md', content: threadContext }]
        : []),
      ...(input.priorArtifacts ?? []).map((artifact, index) => ({
        path: `context/prior-artifact-${index + 1}-facts.json`,
        content: JSON.stringify(
          priorArtifactFactsForModel(artifact, index),
          null,
          2
        )
      })),
      ...artifactAssetSeedFiles(availableAssets),
      ...(referencePack?.seedFiles ?? []),
      ...(clarificationContext
        ? [{ path: 'input/clarifications.md', content: clarificationContext }]
        : []),
      ...(researchClarificationContext
        ? [
            {
              path: 'input/research-clarification.md',
              content: researchClarificationContext
            }
          ]
        : []),
      ...(input.sourceText
        ? [{ path: 'input/source.txt', content: input.sourceText }]
        : []),
      ...(researchPack
        ? [
            { path: 'research/source-pack.md', content: researchPackMarkdown },
            {
              path: 'research/source-pack.json',
              content: JSON.stringify(
                researchPackManifest(researchPack),
                null,
                2
              )
            },
            ...researchAssetSeedFiles(researchPack)
          ]
        : [])
    ]
  };

  const composeModel = resolveComposeModel(input.model);

  if (useTemplateSkeletonFill && templateSkeleton) {
    const buildIndex = plan.items.findIndex((item) => item.id === 'build');
    if (buildIndex >= 0) {
      plan = advanceArtifactPlan(plan, buildIndex);
      options.reporter?.plan(plan.title, plan.items);
    }
    options.reporter?.status('Filling template skeleton with your details');
    return callDelegators(
      { ...input, model: composeModel },
      delegatorsBaseURL,
      buildTemplateSkeletonFillMessages({
        skeleton: templateSkeleton,
        cleanBrief,
        skillPack,
        threadContext,
        combinedSourceText,
        routingLines: artifactRoutingLines
      }),
      {
        ...parseOptionsBase,
        threadArtifactMode: 'template-fill',
        priorArtifact: templateSkeleton,
        seedFiles: [
          ...(parseOptionsBase.seedFiles ?? []),
          {
            path: 'input/template-skeleton.json',
            content: JSON.stringify(artifactForModel(templateSkeleton), null, 2)
          }
        ]
      },
      {
        reporter: options.reporter,
        plan,
        useHarness:
          !fastQuality &&
          (requiresToolHarness(artifactKind, cleanBrief) ||
            Boolean(referencePack)),
        phaseTimer,
        control: options.control
      }
    );
  }

  if (structuredPipeline) {
    const outlineIndex = plan.items.findIndex((item) => item.id === 'outline');
    if (outlineIndex >= 0) {
      plan = advanceArtifactPlan(plan, outlineIndex);
      options.reporter?.plan(plan.title, plan.items);
    }
    phaseTimer.start('outline');
    await options.control?.checkpoint?.(
      'outline',
      'Locking narrative structure'
    );
    options.reporter?.status(
      phaseTimer.status('outline', 'Locking narrative arc and slide roles')
    );
    let outlineContent = (
      await completeDelegatorsTurn(
        { ...input, model: composeModel },
        delegatorsBaseURL,
        buildOutlineMessages({
          artifactKind,
          primaryFormat,
          cleanBrief,
          skillPack,
          combinedSourceText,
          selectedSkill,
          instructions,
          style: input.style,
          researchPack,
          threadRoutingLines: artifactRoutingLines,
          preferredScaffoldId: input.scaffoldId
        }),
        {
          temperature: 0.08,
          toolsEnabled: false,
          signal: options.control?.signal
        }
      )
    ).content;

    if (shouldCritiqueOutline(runDepth, cleanBrief, artifactKind)) {
      options.reporter?.status(
        phaseTimer.status('outline', 'Refining narrative structure')
      );
      const critiqueTurn = await completeDelegatorsTurn(
        { ...input, model: resolveRepairModel(input.model) },
        delegatorsBaseURL,
        buildOutlineCritiqueMessages({
          artifactKind,
          cleanBrief,
          outlineJson: outlineContent,
          combinedSourceText
        }),
        {
          temperature: 0.06,
          toolsEnabled: false,
          signal: options.control?.signal
        }
      );
      if (critiqueTurn.content.trim()) outlineContent = critiqueTurn.content;
    }

    phaseTimer.start('compose');
    await options.control?.checkpoint?.('compose', 'Drafting artifact');
    if (shouldUseMapCompose(artifactKind, cleanBrief, outlineContent)) {
      options.reporter?.status(
        phaseTimer.status('compose', 'Composing slides in parallel')
      );
      const mapComposed = await composeDeckFromOutline({
        artifactKind,
        primaryFormat,
        cleanBrief,
        skillPack,
        combinedSourceText,
        outlineJson: outlineContent,
        selectedSkill,
        instructions,
        style: input.style,
        designPromptLines: designPromptLines(
          primaryFormat,
          cleanBrief,
          artifactKind
        ),
        formatSkillInstructions: formatSkillInstructions(artifactKind),
        schemaContract: schemaContractForKind(artifactKind),
        researchPack,
        threadRoutingLines: artifactRoutingLines,
        preferredScaffoldId: input.scaffoldId,
        composeModel,
        depthTier: runDepth,
        streamLimit: sessionStreamLimit,
        completeTurn: async (request) => {
          const turn = await completeDelegatorsTurn(
            { ...input, model: request.model },
            delegatorsBaseURL,
            request.messages,
            {
              temperature: request.temperature,
              toolsEnabled: false,
              signal: options.control?.signal
            }
          );
          return turn.content;
        },
        onStatus: (message) =>
          options.reporter?.status(phaseTimer.status('compose', message))
      });
      if (mapComposed) {
        const enriched = enforceDesignPreset(
          applyClaimConfidence(
            attachResearchCitations(mapComposed, researchPack),
            researchPack
          ),
          cleanBrief
        );
        return deliverArtifactDocument(
          { ...input, model: composeModel },
          delegatorsBaseURL,
          enriched,
          {
            ...parseOptionsBase,
            seedFiles: [
              ...(parseOptionsBase.seedFiles ?? []),
              { path: 'drafts/outline.json', content: outlineContent },
              {
                path: 'drafts/map-composed.json',
                content: JSON.stringify(enriched, null, 2)
              }
            ]
          },
          {
            reporter: options.reporter,
            plan,
            phaseTimer,
            control: options.control
          }
        );
      }
    }

    options.reporter?.status(
      phaseTimer.status('compose', 'Writing production artifact from outline')
    );
    const composeMessages = buildComposeFromOutlineMessages({
      artifactKind,
      primaryFormat,
      cleanBrief,
      skillPack,
      combinedSourceText,
      outlineJson: outlineContent,
      selectedSkill,
      instructions,
      style: input.style,
      designPromptLines: designPromptLines(
        primaryFormat,
        cleanBrief,
        artifactKind
      ),
      formatSkillInstructions: formatSkillInstructions(artifactKind),
      schemaContract: schemaContractForKind(artifactKind)
    });

    return callDelegators(
      { ...input, model: composeModel },
      delegatorsBaseURL,
      composeMessages,
      {
        ...parseOptionsBase,
        seedFiles: [
          ...(parseOptionsBase.seedFiles ?? []),
          { path: 'drafts/outline.json', content: outlineContent }
        ]
      },
      {
        reporter: options.reporter,
        plan,
        useHarness: false,
        phaseTimer,
        control: options.control
      }
    );
  }

  options.reporter?.status(
    phaseTimer.status('compose', 'Building your artifact')
  );

  return callDelegators(
    { ...input, model: composeModel },
    delegatorsBaseURL,
    messages,
    parseOptionsBase,
    {
      reporter: options.reporter,
      plan,
      useHarness:
        !fastQuality &&
        (requiresToolHarness(artifactKind, cleanBrief) ||
          Boolean(referencePack)),
      budget: policyForArtifact(composeModel, {
        kind: artifactKind,
        hasResearchPack: Boolean(researchPack),
        briefRequiresComputation:
          briefRequiresTable(cleanBrief) ||
          briefRequiresComputation(cleanBrief),
        depthTier: runDepth
      }),
      depthTier: runDepth,
      phaseTimer,
      control: options.control
    }
  );
}

async function refineArtifact(
  input: z.infer<typeof RefineArtifactRequestSchema>,
  options: { reporter?: ProgressReporter; control?: ExecutionControl } = {}
): Promise<ArtifactDocument> {
  throwIfAborted(options.control?.signal);
  const delegatorsBaseURL = resolveDelegatorsBaseURL(input.endpoint);
  assertCredentialAllowedForEndpoint(input.sessionKey, delegatorsBaseURL);
  const plan = buildRefinementPlan(input.artifact.kind, input.instruction);
  const primaryFormat =
    input.artifact.primaryFormat ?? defaultPrimaryFormat(input.artifact.kind);
  const skillPack = buildArtifactSkillPack({
    kind: input.artifact.kind,
    primaryFormat
  });
  const threadIntent = resolveThreadArtifactIntent({
    brief: input.instruction,
    priorArtifacts: input.priorArtifacts,
    artifactKind: input.artifact.kind,
    outputFormat: input.artifact.primaryFormat,
    templateId: input.templateId
  });
  const templateFill =
    threadIntent.mode === 'template-fill' ||
    briefHasTemplateSessionMarker(input.instruction);
  const artifactRoutingLines = [
    ...threadIntent.routingLines,
    ...buildTemplateHarnessRoutingLines({
      templateId: input.templateId,
      scaffoldId: input.scaffoldId,
      designPreset: input.designPreset
    }),
    ...(templateFill ? buildTemplateSkeletonRoutingLines(input.artifact) : [])
  ];
  const threadContext = renderThreadContext(
    input.conversation,
    input.priorArtifacts ?? [],
    artifactRoutingLines
  );
  let referencePack = await prepareReferencePack({
    brief: input.instruction,
    references: input.references,
    platform: input.sessionKey
      ? { baseURL: delegatorsBaseURL, sessionKey: input.sessionKey }
      : undefined,
    onStatus: (message) => options.reporter?.status(message),
    analyzeImage: nativeImageAnalyzer(
      delegatorsBaseURL,
      input.sessionKey,
      input.threadId,
      options.reporter
    )
  });
  if (referencePack) {
    options.reporter?.status('Analyzing uploaded material');
    const analysis = await createProviderReferenceAnalysis(
      input,
      delegatorsBaseURL,
      referencePack,
      input.instruction,
      options.control?.signal
    );
    if (analysis)
      referencePack = attachReferenceAnalysis(referencePack, analysis);
  }
  const referenceGenerationContext = referencePack
    ? buildReferenceGenerationContext(referencePack, 36_000)
    : '';
  const availableAssets = mergeArtifactAssets(
    referencePack?.assets ?? [],
    input.artifact.assets
  );
  options.reporter?.plan(plan.title, plan.items);
  options.reporter?.status('Applying your revision');

  const patchable =
    /\b(?:slide\s+\d+|section\s+\d+|title|rename|replace|fix|update|change|reword|shorten|lengthen|sources?|citations?|appendix|methodology|confidence|cover|subtitle|bullet|tone|voice)\b/i.test(
      input.instruction
    );
  if (patchable) {
    try {
      const patchTurn = await completeDelegatorsTurn(
        { ...input, model: resolveRepairModel(input.model) },
        delegatorsBaseURL,
        buildStructuredPatchMessages({
          artifact: input.artifact,
          instruction: input.instruction,
          sourceEvidence: [
            input.instruction,
            threadContext,
            referenceGenerationContext
          ]
            .filter(Boolean)
            .join('\n\n')
        }),
        {
          temperature: 0.08,
          toolsEnabled: false,
          signal: options.control?.signal
        }
      );
      const operations = parsePatchResponse(patchTurn.content);
      if (operations?.length) {
        const patched = applyArtifactPatch(input.artifact, operations);
        const parsed = parseArtifactContent(JSON.stringify(patched), {
          expectedKind: input.artifact.kind,
          expectedPrimaryFormat: primaryFormat,
          fallbackTone: input.artifact.tone,
          citationsRequired: input.artifact.citations.length > 0,
          availableAssets,
          referenceDesignProfiles: referencePack?.references.flatMap(
            (reference) =>
              reference.designProfile ? [reference.designProfile] : []
          ),
          sourceBrief: input.instruction,
          sourceEvidence: [
            input.instruction,
            threadContext,
            referenceGenerationContext
          ]
            .filter(Boolean)
            .join('\n\n')
        });
        if (parsed.ok) {
          return deliverArtifactDocument(
            input,
            delegatorsBaseURL,
            parsed.artifact,
            {
              expectedKind: input.artifact.kind,
              expectedPrimaryFormat: primaryFormat,
              fallbackTone: input.artifact.tone,
              citationsRequired: input.artifact.citations.length > 0,
              availableAssets,
              referenceDesignProfiles: referencePack?.references.flatMap(
                (reference) =>
                  reference.designProfile ? [reference.designProfile] : []
              ),
              sourceBrief: input.instruction,
              sourceEvidence: [
                input.instruction,
                threadContext,
                referenceGenerationContext
              ]
                .filter(Boolean)
                .join('\n\n'),
              seedFiles: [
                {
                  path: 'input/current-artifact.json',
                  content: JSON.stringify(
                    artifactForModel(input.artifact),
                    null,
                    2
                  )
                },
                {
                  path: 'input/patch-operations.json',
                  content: patchTurn.content
                }
              ]
            },
            {
              reporter: options.reporter,
              plan,
              control: options.control
            }
          );
        }
      }
    } catch (error) {
      if (options.control?.signal.aborted) throw error;
    }
  }

  const messages = [
    {
      role: 'system',
      content: [
        templateFill
          ? 'You fill Delegators Workbench template skeletons.'
          : 'You revise Delegators Workbench artifacts.',
        'Return only the full updated artifact JSON. Do not return a patch.',
        templateFill
          ? 'The current artifact JSON is the gallery template skeleton — preserve unit count, layouts, design.template, themes, and chart/table shells while replacing placeholder copy with user facts.'
          : 'Preserve truthful user-provided facts. Do not invent missing facts.',
        ...(templateFill ? artifactRoutingLines : []),
        skillPack.guide,
        'Never use placeholders, dummy content, or fake citations.',
        'Preserve valid imageAssetId values. Do not emit image bytes, data URIs, or an assets array.',
        templateFill
          ? 'Preserve citations and format-specific structure unless the user explicitly requests structural changes.'
          : 'Preserve citations and format-specific structure unless the user asks to change them.',
        ...referenceDesignPromptLines(referencePack, input.instruction)
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Revision instruction:\n${input.instruction}`,
        threadContext ? `Recent conversation:\n${threadContext}` : '',
        referenceGenerationContext
          ? `Reference material:\n${referenceGenerationContext}`
          : '',
        `Current artifact JSON:\n${JSON.stringify(artifactForModel(input.artifact))}`
      ].join('\n\n')
    }
  ];

  return callDelegators(
    input,
    delegatorsBaseURL,
    messages,
    {
      expectedKind: input.artifact.kind,
      expectedPrimaryFormat:
        input.artifact.primaryFormat ??
        defaultPrimaryFormat(input.artifact.kind),
      fallbackTone: input.artifact.tone,
      citationsRequired: input.artifact.citations.length > 0,
      availableAssets,
      referenceDesignProfiles: referencePack?.references.flatMap((reference) =>
        reference.designProfile ? [reference.designProfile] : []
      ),
      sourceBrief: input.instruction,
      sourceEvidence: [
        input.instruction,
        threadContext,
        referenceGenerationContext
      ]
        .filter(Boolean)
        .join('\n\n'),
      seedFiles: [
        {
          path: 'input/current-artifact.json',
          content: JSON.stringify(artifactForModel(input.artifact), null, 2)
        },
        ...skillPack.seedFiles,
        ...artifactAssetSeedFiles(availableAssets),
        ...(threadContext
          ? [{ path: 'context/thread-context.md', content: threadContext }]
          : []),
        ...(referencePack?.seedFiles ?? [])
      ]
    },
    {
      reporter: options.reporter,
      plan,
      useHarness:
        requiresToolHarness(input.artifact.kind, input.instruction) ||
        Boolean(referencePack),
      control: options.control
    }
  );
}

async function createProviderPreflight(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  options: {
    kind: ArtifactKind;
    primaryFormat: ArtifactPrimaryFormat;
    skillLabel: string;
    skillInstruction: string;
    brief: string;
    needsResearch: boolean;
    signal?: AbortSignal;
  }
): Promise<ArtifactPreflight | null> {
  // 10s was silently killing most preflights on the pro lane (first token via
  // the gateway regularly lands later), which removed the conversational reply
  // and the model's chance to ask real questions. 30s still keeps the run snappy.
  const timeout = createChildTimeoutSignal(
    options.signal,
    Math.min(30_000, requestTimeoutMs)
  );
  try {
    const turn = await completeDelegatorsTurn(
      input,
      delegatorsBaseURL,
      buildPreflightMessages(options),
      {
        temperature: 0.15,
        toolsEnabled: false,
        signal: timeout.signal
      }
    );
    const parsed = parseProviderPreflight(turn.content, options);
    if (!parsed) {
      console.warn(
        '[workbench] provider preflight returned unparseable JSON; building silently'
      );
    }
    return parsed;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    console.warn(
      '[workbench] provider preflight unavailable; building silently:',
      error instanceof Error ? error.message : error
    );
    return null;
  } finally {
    timeout.cleanup();
  }
}

// After the user answers the inline questions, the assistant acknowledges in
// its own words and self-continues — the "it itself did a follow up" beat of
// the Claude flow. Best-effort: a failed call must never block the build.
async function createClarificationFollowUp(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  options: {
    brief: string;
    kind: ArtifactKind;
    answers: string;
    signal?: AbortSignal;
  }
): Promise<string | null> {
  const timeout = createChildTimeoutSignal(
    options.signal,
    Math.min(12_000, requestTimeoutMs)
  );
  try {
    const turn = await completeDelegatorsTurn(
      input,
      delegatorsBaseURL,
      [
        {
          role: 'system',
          content: [
            'You are Delegators Workbench. The user just answered your clarifying questions and you are now starting the build.',
            'Reply with 1-3 sentences of plain prose spoken directly to the user: confirm the specific choices they made and say what you are building with them.',
            'Reference their actual answers — never a generic "Thanks, starting now".',
            'No Markdown headings, no lists, no JSON, no questions.'
          ].join('\n')
        },
        {
          role: 'user',
          content: [
            `Artifact kind: ${options.kind}`,
            `Original brief:\n${options.brief}`,
            `My answers:\n${options.answers}`
          ].join('\n\n')
        }
      ],
      {
        temperature: 0.5,
        toolsEnabled: false,
        plain: true,
        signal: timeout.signal
      }
    );
    const text = (turn.content ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);
    return text || null;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return null;
  } finally {
    timeout.cleanup();
  }
}

async function collectClarificationContext(options: {
  questions: WorkbenchQuestionItem[];
  reporter?: ProgressReporter;
  control?: ExecutionControl;
  plan: ArtifactPlan;
}): Promise<string> {
  const questions = options.questions;
  if (questions.length === 0 || !options.control?.waitForInstructions)
    return '';

  const clarifyIndex = options.plan.items.findIndex(
    (item) => item.id === 'clarify'
  );
  if (clarifyIndex >= 0) {
    options.reporter?.plan(
      options.plan.title,
      advanceArtifactPlan(options.plan, clarifyIndex).items
    );
  }
  options.reporter?.status('Waiting for a few artifact choices');
  options.reporter?.question({
    question: questions[0].question,
    questions
  });

  const answers = await options.control.waitForInstructions();
  throwIfAborted(options.control.signal);
  const text = answers.join('\n\n').trim();
  if (!text) return '';
  return text.startsWith('Clarification answers:')
    ? text
    : `Clarification answers:\n${text}`;
}

function createChildTimeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException('Preflight timed out.', 'TimeoutError')
      ),
    timeoutMs
  );
  const abortFromParent = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', abortFromParent, { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abortFromParent);
    }
  };
}

async function callDelegators(
  input: Pick<GenerateArtifactRequest, 'sessionKey' | 'model' | 'threadId'>,
  delegatorsBaseURL: string,
  messages: DelegatorsMessage[],
  parseOptions: ArtifactParseOptions = {},
  runtimeOptions: {
    reporter?: ProgressReporter;
    plan?: ArtifactPlan;
    useHarness?: boolean;
    control?: ExecutionControl;
    budget?: ToolBudget;
    depthTier?: RunDepthTier;
    phaseTimer?: RunPhaseTimer;
  } = {}
): Promise<ArtifactDocument> {
  throwIfAborted(runtimeOptions.control?.signal);
  const workspace = await createWorkspace({
    sessionKey: input.sessionKey,
    workspaceKey: input.threadId
  });
  for (const seed of parseOptions.seedFiles ?? []) {
    if (seed.binary) {
      await writeWorkspaceBinary(workspace, seed.path, seed.binary);
    } else {
      await writeWorkspaceText(workspace, seed.path, seed.content ?? '');
    }
  }

  const depthTier = runtimeOptions.depthTier ?? 'standard';
  const budget = runtimeOptions.budget ?? policyForModel(input.model);
  const turnTimeoutMs = providerRequestTimeoutMs(depthTier, requestTimeoutMs);
  const content = await completeDelegators(
    input,
    delegatorsBaseURL,
    messages,
    0.25,
    {
      workspace,
      budget,
      enableTools: runtimeOptions.useHarness === true,
      reporter: runtimeOptions.reporter,
      control: runtimeOptions.control,
      depthTier,
      requestTimeoutMs: turnTimeoutMs
    }
  );
  let plan = runtimeOptions.plan;
  if (plan) {
    plan = advanceArtifactPlan(plan, plan.items.length - 1);
    runtimeOptions.reporter?.plan(plan.title, plan.items);
  }
  runtimeOptions.phaseTimer?.start('inspect');
  runtimeOptions.reporter?.status(
    runtimeOptions.phaseTimer?.status(
      'inspect',
      'Checking the finished artifact'
    ) ?? 'Checking the finished artifact'
  );
  const first = parseArtifactContent(content, parseOptions);
  if (first.ok) {
    const inspected = await inspectAndMaybeReviseArtifact(
      input,
      delegatorsBaseURL,
      first.artifact,
      parseOptions,
      workspace,
      runtimeOptions
    );
    return finalizeArtifact(
      attachResearchAssets(inspected, parseOptions.availableAssets),
      workspace,
      plan,
      runtimeOptions.reporter,
      parseOptions.expectedPrimaryFormat,
      runtimeOptions.phaseTimer
    );
  }

  if (qualityMode === 'fast') {
    await writeWorkspaceText(
      workspace,
      'quality/fast-fallback-error.txt',
      first.error
    );
    return finalizeFastFallbackArtifact(
      input,
      delegatorsBaseURL,
      parseOptions,
      workspace,
      runtimeOptions,
      plan,
      first.error
    );
  }

  // Repair on the pro lane when the run used an ultra alias: the ultraspeed
  // engine occasionally emits malformed artifact JSON, and a repair pass on the
  // same lane can fail twice. Wallet plans always include the pro repair lane.
  const repairInput = {
    ...stableRepairInput(input),
    model: resolveRepairModel(input.model)
  };
  let failed = first;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    runtimeOptions.phaseTimer?.start('repair');
    runtimeOptions.reporter?.status(
      runtimeOptions.phaseTimer?.status(
        'repair',
        attempt === 1
          ? 'Correcting the artifact format'
          : 'Retrying artifact recovery'
      ) ??
        (attempt === 1
          ? 'Correcting the artifact format'
          : 'Retrying artifact recovery')
    );
    const repairedContent = await completeDelegators(
      repairInput,
      delegatorsBaseURL,
      buildRepairMessages(parseOptions, failed.error, failed.raw),
      0.05,
      {
        workspace,
        budget: policyForModel(repairInput.model),
        enableTools: false,
        reporter: runtimeOptions.reporter,
        control: runtimeOptions.control
      }
    );
    const repaired = parseArtifactContent(repairedContent, parseOptions);
    if (repaired.ok) {
      const inspected = await inspectAndMaybeReviseArtifact(
        input,
        delegatorsBaseURL,
        repaired.artifact,
        parseOptions,
        workspace,
        runtimeOptions
      );
      return finalizeArtifact(
        attachResearchAssets(inspected, parseOptions.availableAssets),
        workspace,
        plan,
        runtimeOptions.reporter,
        parseOptions.expectedPrimaryFormat,
        runtimeOptions.phaseTimer
      );
    }
    failed = repaired;
  }

  throw new Error(
    `Model returned invalid artifact JSON: ${first.error}; repair failed: ${failed.error}`
  );
}

async function finalizeFastFallbackArtifact(
  input: Pick<GenerateArtifactRequest, 'sessionKey' | 'model' | 'threadId'>,
  delegatorsBaseURL: string,
  parseOptions: ArtifactParseOptions,
  workspace: WorkbenchWorkspace,
  runtimeOptions: {
    reporter?: ProgressReporter;
    plan?: ArtifactPlan;
    useHarness?: boolean;
    control?: ExecutionControl;
    budget?: ToolBudget;
    depthTier?: RunDepthTier;
    phaseTimer?: RunPhaseTimer;
  },
  plan: ArtifactPlan | undefined,
  validationError: string
): Promise<ArtifactDocument> {
  runtimeOptions.reporter?.status(
    runtimeOptions.phaseTimer?.status(
      'inspect',
      'Using bounded fallback artifact'
    ) ?? 'Using bounded fallback artifact'
  );
  const fallback = buildFastFallbackArtifact(parseOptions, validationError);
  await writeWorkspaceText(
    workspace,
    'quality/fast-fallback-artifact.json',
    JSON.stringify(fallback, null, 2)
  );
  const inspected = await inspectAndMaybeReviseArtifact(
    input,
    delegatorsBaseURL,
    fallback,
    parseOptions,
    workspace,
    runtimeOptions
  );
  return finalizeArtifact(
    attachResearchAssets(inspected, parseOptions.availableAssets),
    workspace,
    plan,
    runtimeOptions.reporter,
    parseOptions.expectedPrimaryFormat,
    runtimeOptions.phaseTimer
  );
}

function buildFastFallbackArtifact(
  options: ArtifactParseOptions,
  validationError: string
): ArtifactDocument {
  const kind = options.expectedKind ?? 'report';
  const primaryFormat =
    options.expectedPrimaryFormat ?? defaultPrimaryFormat(kind);
  const brief = compactForArtifact(
    options.sourceBrief ||
      options.sourceEvidence ||
      'User requested a professional artifact.',
    900
  );
  const citations = [
    ...(options.allowedCitations ?? new Map<string, string>()).entries()
  ]
    .slice(0, 4)
    .map(([id, url], index) => ({
      id,
      label: `Verified source ${index + 1}`,
      url
    }));
  const sourceIds = citations
    .map((citation) => citation.id)
    .filter((id): id is string => Boolean(id));
  const fallbackNotice = compactForArtifact(validationError, 220);
  const sections: ArtifactDocument['sections'] = [
    {
      heading: 'Executive Summary',
      body: [
        'This bounded fallback was generated because the model response could not be converted into the required export schema.',
        'It preserves the supplied brief and available evidence instead of inventing missing facts.',
        `Brief: ${brief}`
      ].join(' '),
      bullets: [
        'Use this version as a reliable first export, then refine with a narrower follow-up instruction.',
        'Claims are limited to the supplied material and verified source pack.',
        `Validation note: ${fallbackNotice}`
      ],
      sourceIds
    },
    {
      heading: 'Evidence Used',
      body: 'The artifact uses the supplied brief, uploaded references, extracted document text, visual-reference metadata, and any verified research sources available to the run.',
      bullets: [
        'Uploaded files are treated as operator-provided evidence.',
        'Image analysis is included when the gateway vision route returns semantic output; otherwise the fallback uses metadata/OCR only.',
        'Research citations are attached only when they came from the verified source pack.'
      ],
      sourceIds,
      table: {
        columns: ['Evidence type', 'Status'],
        rows: [
          ['Brief', 'Included'],
          [
            'Uploaded references',
            options.sourceEvidence ? 'Included' : 'Not supplied'
          ],
          [
            'Verified web sources',
            citations.length > 0 ? 'Included' : 'Not supplied'
          ],
          ['Export validation', 'Completed through Workbench exporter']
        ]
      }
    },
    {
      heading: 'Security And Launch Risks',
      body: 'For a paid launch, keep admin APIs isolated, provider keys server-side, object storage private, and bucket/database credentials out of client builds.',
      bullets: [
        'Use Cloudflare Access or an equivalent private control plane for admin routes.',
        'Keep the Workbench sandbox disabled until a hardened remote sandbox is deployed.',
        'Monitor provider 400/429/5xx rates because upstream key quality is the real launch bottleneck.'
      ],
      sourceIds,
      chart: {
        type: 'bar' as const,
        title: 'Launch Control Checks',
        labels: [
          'Admin isolation',
          'Server keys',
          'Export path',
          'Provider pool'
        ],
        series: [
          {
            name: 'Readiness',
            values: [1, 1, 1, citations.length > 0 ? 1 : 0]
          }
        ]
      }
    },
    {
      heading: 'Ship Verdict',
      body: 'Ship the bounded Pro pass only after the live provider key pool, payment callback, admin access, and Workbench export path pass smoke tests on the deployment host.',
      bullets: [
        'Text SWE, web search, image routing, multifile extraction, and PDF export must pass together.',
        'If any upstream provider route is unprovisioned, hide that claim or seed a working key before taking money.',
        'Keep first launch traffic small enough for the Oracle/free-tier profile.'
      ],
      sourceIds
    }
  ];

  const base: ArtifactDocument = {
    kind,
    primaryFormat,
    title: fallbackTitle(kind, brief),
    audience: 'Operator and early customers',
    tone: options.fallbackTone ?? 'professional',
    executiveSummary:
      'Bounded fallback artifact generated from the supplied brief and available evidence.',
    design: {
      template: 'consulting-mono',
      density: 'balanced',
      includePageNumbers: true
    },
    sections,
    assets: [],
    citations,
    nextQuestions: [
      'Which exact claim should be strengthened first?',
      'Do you want a stricter evidence-only revision or a more sales-focused version?'
    ]
  };

  if (kind === 'deck') {
    base.slides = sections.map((section, index) => ({
      title: section.heading,
      role:
        index === 0
          ? 'opener'
          : index === sections.length - 1
            ? 'close'
            : 'evidence',
      bullets: section.bullets.slice(0, 5),
      layout: section.chart ? 'chart' : 'list',
      chart: section.chart,
      table: section.table,
      sourceIds
    }));
  }

  if (kind === 'sheet') {
    base.sheet = {
      sheets: [
        {
          name: 'Launch Checks',
          columns: ['Check', 'Status'],
          rows: sections
            .flatMap((section) =>
              section.bullets.map((bullet) => [section.heading, bullet])
            )
            .slice(0, 24)
        }
      ]
    };
  }

  if (kind === 'resume') {
    base.resume = {
      contact: [],
      skills: [],
      experience: sections,
      education: [],
      projects: []
    };
  }

  return base;
}

function fallbackTitle(kind: ArtifactKind, brief: string): string {
  const subject = brief.split(/[.\n]/)[0]?.trim() || 'Workbench Artifact';
  const suffix =
    kind === 'deck' ? 'Deck' : kind === 'sheet' ? 'Workbook' : 'Report';
  return compactForArtifact(`${subject} - ${suffix}`, 120);
}

function compactForArtifact(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(0, max - 3)).trim()}...`;
}

async function deliverArtifactDocument(
  input: Pick<GenerateArtifactRequest, 'sessionKey' | 'model' | 'threadId'>,
  delegatorsBaseURL: string,
  artifact: ArtifactDocument,
  parseOptions: ArtifactParseOptions = {},
  runtimeOptions: {
    reporter?: ProgressReporter;
    plan?: ArtifactPlan;
    control?: ExecutionControl;
    phaseTimer?: RunPhaseTimer;
  } = {}
): Promise<ArtifactDocument> {
  throwIfAborted(runtimeOptions.control?.signal);
  artifact = applyClaimConfidence(artifact, parseOptions.researchPack ?? null);
  const workspace = await createWorkspace({
    sessionKey: input.sessionKey,
    workspaceKey: input.threadId
  });
  for (const seed of parseOptions.seedFiles ?? []) {
    if (seed.binary) {
      await writeWorkspaceBinary(workspace, seed.path, seed.binary);
    } else {
      await writeWorkspaceText(workspace, seed.path, seed.content ?? '');
    }
  }
  let plan = runtimeOptions.plan;
  if (plan) {
    plan = advanceArtifactPlan(plan, plan.items.length - 1);
    runtimeOptions.reporter?.plan(plan.title, plan.items);
  }
  runtimeOptions.phaseTimer?.start('inspect');
  runtimeOptions.reporter?.status(
    runtimeOptions.phaseTimer?.status(
      'inspect',
      'Checking the finished artifact'
    ) ?? 'Checking the finished artifact'
  );
  const inspected = await inspectAndMaybeReviseArtifact(
    input,
    delegatorsBaseURL,
    artifact,
    parseOptions,
    workspace,
    runtimeOptions
  );
  return finalizeArtifact(
    attachResearchAssets(inspected, parseOptions.availableAssets),
    workspace,
    plan,
    runtimeOptions.reporter,
    parseOptions.expectedPrimaryFormat,
    runtimeOptions.phaseTimer
  );
}

async function inspectAndMaybeReviseArtifact(
  input: Pick<GenerateArtifactRequest, 'sessionKey' | 'model' | 'threadId'>,
  delegatorsBaseURL: string,
  artifact: ArtifactDocument,
  parseOptions: ArtifactParseOptions,
  workspace: WorkbenchWorkspace,
  runtimeOptions: {
    reporter?: ProgressReporter;
    control?: ExecutionControl;
    phaseTimer?: RunPhaseTimer;
  }
): Promise<ArtifactDocument> {
  artifact = repairArtifactCredibility(
    stabilizeArtifactComposition(
      stabilizeDeckComposition(artifact, parseOptions.sourceBrief),
      parseOptions.sourceBrief
    ),
    {
      brief: parseOptions.sourceBrief,
      audienceProfile: parseOptions.audienceProfile,
      hasResearchSources: Boolean(parseOptions.allowedCitationIds?.size)
    }
  );
  runtimeOptions.reporter?.status(
    runtimeOptions.phaseTimer?.status(
      'inspect',
      'Inspecting artifact quality'
    ) ?? 'Inspecting artifact quality'
  );
  await writeWorkspaceText(
    workspace,
    'quality/base-artifact.json',
    JSON.stringify(artifact, null, 2)
  );
  const localInspection = inspectArtifactLocally({
    artifact,
    sourceBrief: parseOptions.sourceBrief,
    sourceEvidence: parseOptions.sourceEvidence,
    referenceDesignProfiles: parseOptions.referenceDesignProfiles,
    expectedKind: parseOptions.expectedKind,
    expectedPrimaryFormat: parseOptions.expectedPrimaryFormat,
    citationsRequired: parseOptions.citationsRequired,
    needsResearch: Boolean(parseOptions.researchConfidence),
    hasResearchSources: Boolean(parseOptions.allowedCitationIds?.size),
    threadArtifactMode: parseOptions.threadArtifactMode,
    priorArtifact: parseOptions.priorArtifact
  });
  const explicitBrief = briefIsExplicit(
    parseOptions.sourceBrief ?? '',
    parseOptions.expectedKind
  );
  const inspection = await createProviderInspection(
    input,
    delegatorsBaseURL,
    artifact,
    parseOptions,
    runtimeOptions.control?.signal,
    localInspection,
    qualityMode === 'fast' ||
      shouldSkipProviderInspection({
        explicitBrief,
        localPassed: localInspection.passed,
        blockingIssues: localInspection.issues.filter(isBlockingPublishIssue)
      })
  );
  if (publishGateBlocks(inspection)) {
    await writeWorkspaceText(
      workspace,
      'quality/publish-block.json',
      JSON.stringify(inspection, null, 2)
    );
  }

  // Data-viz gate: a deck/report whose content is loaded with numbers but
  // carries zero charts is 2022-grade output. Force one revision pass that adds
  // proper { type, labels, series } charts where the data tells a story.
  const hasChart =
    (artifact.slides ?? []).some((slide) => slide.chart) ||
    artifact.sections.some((section) => section.chart);
  const numericSignals = (
    JSON.stringify({ s: artifact.sections, l: artifact.slides }).match(
      /\d+(?:\.\d+)?%?/g
    ) ?? []
  ).length;
  if (
    qualityMode !== 'fast' &&
    !hasChart &&
    numericSignals >= 12 &&
    (parseOptions.expectedKind === 'deck' ||
      parseOptions.expectedKind === 'report')
  ) {
    inspection.passed = false;
    inspection.revisionInstruction = [
      inspection.revisionInstruction ?? '',
      'The content is full of numeric data but contains no charts. Add `chart` objects ({ type: "bar"|"column"|"line"|"area"|"pie"|"donut", title, labels: string[], series: [{ name, values: number[] }], unit? }) where the data tells a trend, comparison, or composition story — on slides set layout "chart"; in report sections set section.chart. Use only numbers already present in the artifact or brief.'
    ]
      .filter(Boolean)
      .join(' ');
  }

  await writeWorkspaceText(
    workspace,
    'quality/inspection.json',
    JSON.stringify(inspection, null, 2)
  );
  if (qualityMode === 'fast') {
    enforcePublishGate(inspection);
    return artifact;
  }
  if (inspection.passed || !inspection.revisionInstruction) {
    enforcePublishGate(inspection);
    return artifact;
  }

  runtimeOptions.phaseTimer?.start('repair');
  runtimeOptions.reporter?.status(
    runtimeOptions.phaseTimer?.status(
      'repair',
      'Improving the artifact from inspection'
    ) ?? 'Improving the artifact from inspection'
  );
  const revisionInput = { ...input, model: resolveRepairModel(input.model) };
  let revised: ReturnType<typeof parseArtifactContent>;
  try {
    const revisedContent = await completeDelegators(
      revisionInput,
      delegatorsBaseURL,
      buildQualityRevisionMessages({
        artifact,
        inspection,
        sourceBrief: parseOptions.sourceBrief,
        sourceEvidence: parseOptions.sourceEvidence,
        referenceDesignProfiles: parseOptions.referenceDesignProfiles,
        expectedKind: parseOptions.expectedKind,
        expectedPrimaryFormat: parseOptions.expectedPrimaryFormat
      }),
      0.1,
      {
        workspace,
        budget: policyForModel(input.model),
        enableTools: false,
        reporter: runtimeOptions.reporter,
        control: runtimeOptions.control
      }
    );
    revised = parseArtifactContent(revisedContent, parseOptions);
  } catch (error) {
    if (runtimeOptions.control?.signal.aborted) throw error;
    const message =
      error instanceof Error
        ? error.message
        : 'Quality revision request failed.';
    await writeWorkspaceText(workspace, 'quality/revision-error.txt', message);
    if (publishGateBlocks(inspection)) {
      throw new Error(
        `Artifact blocked from publication: ${formatBlockingIssues(inspection.issues)}`
      );
    }
    throw new Error(`Quality revision failed: ${message}`);
  }

  if (!revised.ok) {
    await writeWorkspaceText(
      workspace,
      'quality/revision-error.txt',
      revised.error
    );
    runtimeOptions.reporter?.status(
      runtimeOptions.phaseTimer?.status(
        'repair',
        'Repairing the quality revision'
      ) ?? 'Repairing the quality revision'
    );
    try {
      const repairInput = {
        ...stableRepairInput(revisionInput),
        model: resolveRepairModel(input.model)
      };
      const repairedContent = await completeDelegators(
        repairInput,
        delegatorsBaseURL,
        buildRepairMessages(parseOptions, revised.error, revised.raw),
        0.05,
        {
          workspace,
          budget: policyForModel(repairInput.model),
          enableTools: false,
          reporter: runtimeOptions.reporter,
          control: runtimeOptions.control
        }
      );
      revised = parseArtifactContent(repairedContent, parseOptions);
    } catch (error) {
      if (runtimeOptions.control?.signal.aborted) throw error;
      const message =
        error instanceof Error
          ? error.message
          : 'Quality revision repair failed.';
      await writeWorkspaceText(
        workspace,
        'quality/revision-repair-error.txt',
        message
      );
      if (publishGateBlocks(inspection)) {
        throw new Error(
          `Artifact blocked from publication: ${formatBlockingIssues(inspection.issues)}`
        );
      }
      throw new Error(`Quality revision repair failed: ${message}`);
    }
    if (!revised.ok) {
      await writeWorkspaceText(
        workspace,
        'quality/revision-repair-error.txt',
        revised.error
      );
      if (publishGateBlocks(inspection)) {
        throw new Error(
          `Artifact blocked from publication: ${formatBlockingIssues(inspection.issues)}`
        );
      }
      throw new Error(`Quality revision repair failed: ${revised.error}`);
    }
  }
  const stabilizedRevision = stabilizeArtifactComposition(
    stabilizeDeckComposition(revised.artifact, parseOptions.sourceBrief),
    parseOptions.sourceBrief
  );
  const localReinspection = inspectArtifactLocally({
    artifact: stabilizedRevision,
    sourceBrief: parseOptions.sourceBrief,
    sourceEvidence: parseOptions.sourceEvidence,
    referenceDesignProfiles: parseOptions.referenceDesignProfiles,
    expectedKind: parseOptions.expectedKind,
    expectedPrimaryFormat: parseOptions.expectedPrimaryFormat,
    citationsRequired: parseOptions.citationsRequired,
    needsResearch: Boolean(parseOptions.researchConfidence),
    hasResearchSources: Boolean(parseOptions.allowedCitationIds?.size),
    threadArtifactMode: parseOptions.threadArtifactMode,
    priorArtifact: parseOptions.priorArtifact
  });
  if (!localReinspection.passed) {
    await writeWorkspaceText(
      workspace,
      'quality/revision-error.json',
      JSON.stringify(localReinspection, null, 2)
    );
    if (publishGateBlocks(localReinspection)) {
      throw new Error(
        `Artifact blocked from publication: ${formatBlockingIssues(localReinspection.issues)}`
      );
    }
    // Only HARD-blocking issues (fabrication, wrong kind/format, missing required
    // citations — see isBlockingPublishIssue) may discard the artifact. Soft polish
    // notes (e.g. "1 slide is too dense") must NOT 500 away an otherwise-usable
    // result; publish the best-effort artifact and surface the note instead. The
    // soft issues are already recorded in quality/revision-error.json above.
    runtimeOptions.reporter?.status(
      `Published with minor quality notes: ${formatBlockingIssues(localReinspection.issues)}`
    );
  }
  await writeWorkspaceText(
    workspace,
    'quality/revised-artifact.json',
    JSON.stringify(stabilizedRevision, null, 2)
  );
  enforcePublishGate(localReinspection);
  return stabilizedRevision;
}

function formatBlockingIssues(issues: string[]): string {
  return issues.filter(isBlockingPublishIssue).join(' ') || issues.join(' ');
}

function enforcePublishGate(inspection: {
  passed: boolean;
  issues: string[];
}): void {
  if (publishGateBlocks(inspection)) {
    throw new Error(
      `Artifact blocked from publication: ${formatBlockingIssues(inspection.issues)}`
    );
  }
}

async function createProviderInspection(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  artifact: ArtifactDocument,
  parseOptions: ArtifactParseOptions,
  signal?: AbortSignal,
  precomputedLocal?: ArtifactInspection,
  skipProvider = false
): Promise<ArtifactInspection> {
  const local =
    precomputedLocal ??
    inspectArtifactLocally({
      artifact,
      sourceBrief: parseOptions.sourceBrief,
      sourceEvidence: parseOptions.sourceEvidence,
      referenceDesignProfiles: parseOptions.referenceDesignProfiles,
      expectedKind: parseOptions.expectedKind,
      expectedPrimaryFormat: parseOptions.expectedPrimaryFormat,
      citationsRequired: parseOptions.citationsRequired,
      needsResearch: Boolean(parseOptions.researchConfidence),
      hasResearchSources: Boolean(parseOptions.allowedCitationIds?.size),
      threadArtifactMode: parseOptions.threadArtifactMode,
      priorArtifact: parseOptions.priorArtifact
    });
  if (skipProvider) return local;
  const timeout = createChildTimeoutSignal(
    signal,
    Math.min(12_000, requestTimeoutMs)
  );
  try {
    const turn = await completeDelegatorsTurn(
      input,
      delegatorsBaseURL,
      buildInspectionMessages({
        artifact,
        sourceBrief: parseOptions.sourceBrief,
        sourceEvidence: parseOptions.sourceEvidence,
        referenceDesignProfiles: parseOptions.referenceDesignProfiles,
        expectedKind: parseOptions.expectedKind,
        expectedPrimaryFormat: parseOptions.expectedPrimaryFormat,
        citationsRequired: parseOptions.citationsRequired
      }),
      {
        temperature: 0.05,
        toolsEnabled: false,
        signal: timeout.signal
      }
    );
    return mergeArtifactInspections(
      local,
      parseProviderInspection(turn.content) ?? fallbackArtifactInspection()
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    return local;
  } finally {
    timeout.cleanup();
  }
}

async function finalizeArtifact(
  artifact: ArtifactDocument,
  workspace: WorkbenchWorkspace,
  plan: ArtifactPlan | undefined,
  reporter?: ProgressReporter,
  expectedPrimaryFormat?: ArtifactPrimaryFormat,
  phaseTimer?: RunPhaseTimer
): Promise<ArtifactDocument> {
  phaseTimer?.start('export');
  reporter?.status(
    phaseTimer?.status('export', 'Preparing the downloadable file') ??
      'Preparing the downloadable file'
  );
  const format = expectedPrimaryFormat ?? primaryFormatForArtifact(artifact);
  const exported = await buildExport(artifact, format);
  const versionId = new Date().toISOString().replace(/[:.]/g, '-');
  const objectPath = `runs/${workspace.id}/versions/${versionId}/${exported.filename}`;
  await writeWorkspaceBinary(
    workspace,
    `versions/${versionId}/${exported.filename}`,
    exported.body
  );
  await mirrorWorkbenchObject(objectPath, exported.body, exported.contentType);
  if (plan) {
    const completed = completeArtifactPlan(plan);
    reporter?.plan(completed.title, completed.items);
  }
  const readyStatus =
    phaseTimer?.status('export', 'Artifact ready') ?? 'Artifact ready';
  const timingSummary = phaseTimer?.formatSummary();
  reporter?.status(
    timingSummary ? `${readyStatus} (${timingSummary})` : readyStatus
  );
  return artifact;
}

function primaryFormatForArtifact(
  artifact: ArtifactDocument
): ArtifactExportFormat {
  if (artifact.primaryFormat) return artifact.primaryFormat;
  if (artifact.kind === 'deck' || artifact.slides?.length) return 'pptx';
  if (artifact.kind === 'sheet' || artifact.sheet) return 'xlsx';
  if (artifact.kind === 'report') return 'pdf';
  return 'docx';
}

function defaultPrimaryFormat(kind: ArtifactKind): ArtifactPrimaryFormat {
  if (kind === 'deck') return 'pptx';
  if (kind === 'sheet') return 'xlsx';
  if (kind === 'report') return 'pdf';
  return 'docx';
}

function stableRepairInput<T extends DelegatorsCompletionInput>(input: T): T {
  if (!input.model.toLowerCase().includes('ultra')) return input;
  return { ...input, model: 'swe-pro' };
}

async function completeDelegators(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  messages: DelegatorsMessage[],
  temperature: number,
  options: {
    workspace?: WorkbenchWorkspace;
    budget?: ToolBudget;
    enableTools?: boolean;
    reporter?: ProgressReporter;
    control?: ExecutionControl;
    depthTier?: RunDepthTier;
    requestTimeoutMs?: number;
  } = {}
): Promise<string> {
  throwIfAborted(options.control?.signal);
  const depthTier = options.depthTier ?? 'standard';
  const turnTimeoutMs =
    options.requestTimeoutMs ??
    providerRequestTimeoutMs(depthTier, requestTimeoutMs);
  if (options.workspace && options.enableTools) {
    return runWorkbenchHarness({
      messages,
      workspace: options.workspace,
      platformSearch: {
        baseURL: delegatorsBaseURL,
        sessionKey: input.sessionKey
      },
      budget: options.budget ?? policyForModel(input.model),
      initialTemperature: temperature,
      signal: options.control?.signal,
      drainInstructions: options.control?.drainInstructions,
      depthTier,
      toolResultKeepCount: toolResultKeepCount(depthTier),
      onProgress: (message) => options.reporter?.status(message),
      completeTurn: (request) =>
        completeDelegatorsTurn(input, delegatorsBaseURL, request.messages, {
          temperature: request.temperature,
          toolsEnabled: request.toolsEnabled,
          signal: options.control?.signal,
          timeoutMs: turnTimeoutMs
        })
    });
  }

  const turn = await completeDelegatorsTurn(
    input,
    delegatorsBaseURL,
    messages,
    {
      temperature,
      toolsEnabled: false,
      signal: options.control?.signal,
      timeoutMs: turnTimeoutMs
    }
  );
  if (turn.content.trim().length === 0) {
    throw new Error('Delegators endpoint returned an empty assistant message.');
  }
  return turn.content;
}

async function completeDelegatorsTurn(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  messages: DelegatorsMessage[],
  options: {
    temperature: number;
    toolsEnabled: boolean;
    signal?: AbortSignal;
    plain?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    toolDefinitions?: ReadonlyArray<(typeof workbenchToolDefinitions)[number]>;
  }
): Promise<CompletionTurn> {
  // Retry transient upstream failures (429/5xx/network): a single provider
  // hiccup must not fail a multi-minute artifact or chat turn.
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await completeDelegatorsTurnOnce(
        input,
        delegatorsBaseURL,
        messages,
        options
      );
    } catch (error) {
      lastError = error;
      const rateLimited =
        error instanceof AgentHttpError && error.status === 429;
      if (rateLimited) incrementCounter('workbench_gateway_429_total');
      const transient =
        rateLimited ||
        (error instanceof AgentHttpError && error.status >= 500) ||
        error instanceof TypeError;
      if (!transient || options.signal?.aborted || attempt === maxAttempts - 1)
        throw error;
      const retryAfterMs =
        error instanceof AgentHttpError ? error.retryAfterMs : undefined;
      const delayMs =
        retryAfterMs ?? (rateLimited ? 2000 * (attempt + 1) : 2000);
      await sleep(Math.min(delayMs, 12_000));
    }
  }
  throw lastError;
}

async function completeDelegatorsTurnOnce(
  input: DelegatorsCompletionInput,
  delegatorsBaseURL: string,
  messages: DelegatorsMessage[],
  options: {
    temperature: number;
    toolsEnabled: boolean;
    signal?: AbortSignal;
    plain?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    toolDefinitions?: ReadonlyArray<(typeof workbenchToolDefinitions)[number]>;
  }
): Promise<CompletionTurn> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abortFromParent, { once: true });
  const turnTimeoutMs = options.timeoutMs ?? requestTimeoutMs;
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException('Provider request timed out.', 'TimeoutError')
      ),
    turnTimeoutMs
  );
  const modelAlias = input.model.toLowerCase();
  const thinkingAlias = modelAlias.includes('thinking');
  const ultraAlias = modelAlias.includes('swe-ultra');

  try {
    const response = await fetch(`${delegatorsBaseURL}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.sessionKey}`,
        'Content-Type': 'application/json',
        // Unique per attempt: without it the gateway keys idempotency on the
        // body hash, so our transient-failure retry of an identical body 409s
        // against the first attempt's in-progress record.
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        ...workbenchHarnessIdentity(input.threadId),
        model: input.model,
        stream: false,
        temperature: options.temperature,
        messages,
        // Data-heavy artifacts (12-month forecast sheets, large decks) truncate at a
        // low cap; the Delegators wb_* plans allow up to 32768 and the gateway still
        // caps at the session budget, so give artifacts real headroom to finish the JSON.
        ...completionTokenParam(delegatorsBaseURL, options.maxTokens ?? 16000),
        ...(isOfficialMimoOrigin(delegatorsBaseURL) && !thinkingAlias
          ? { thinking: { type: 'disabled' } }
          : {}),
        ...(options.toolsEnabled
          ? {
              tools: options.toolDefinitions ?? workbenchToolDefinitions,
              tool_choice: 'auto'
            }
          : // Plain chat turns get no response_format; and response_format makes
            // mimo-v2.5-pro-ultraspeed emit token garbage (verified live
            // 2026-06-11) while the pro/fast lanes handle it fine.
            options.plain || ultraAlias
            ? {}
            : { response_format: { type: 'json_object' } })
      })
    });

    if (!response.ok) {
      const text = await response.text();
      const retryAfter = parseRetryAfterSeconds(
        response.headers.get('Retry-After')
      );
      throw new AgentHttpError(
        response.status,
        scrubSecrets(text).slice(0, 1200),
        retryAfter
      );
    }

    const payload = await response.json();
    return extractCompletionTurn(payload);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromParent);
  }
}

function completionTokenParam(
  endpointOrigin: string,
  value: number
): { max_tokens: number } | { max_completion_tokens: number } {
  return isOfficialMimoOrigin(endpointOrigin)
    ? { max_completion_tokens: value }
    : { max_tokens: value };
}

function nativeImageAnalyzer(
  baseURL: string,
  sessionKey: string,
  threadId?: string,
  reporter?: { status?: (message: string) => void }
): ImageAnalyzer {
  return makeImageAnalyzer(baseURL, sessionKey, threadId, reporter);
}

// Native semantic analysis through the Delegators artifact-vision harness
// (art-vision -> current multimodal provider route), available to every Workbench wallet.
function makeImageAnalyzer(
  baseURL: string,
  sessionKey: string,
  threadId?: string,
  reporter?: { status?: (message: string) => void }
): ImageAnalyzer {
  let used = 0;
  const maxImages = 8;
  return async (
    binary: Buffer,
    name: string,
    mime: string
  ): Promise<string | null> => {
    if (used >= maxImages) return null;
    used += 1;
    try {
      const dataUrl = `data:${mime};base64,${binary.toString('base64')}`;
      const response = await fetch(
        `${baseURL.replace(/\/$/, '')}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID()
          },
          body: JSON.stringify({
            ...workbenchHarnessIdentity(threadId),
            model: 'art-vision',
            stream: false,
            ...completionTokenParam(baseURL, 2400),
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: buildNativeVisionPrompt(name)
                  },
                  { type: 'image_url', image_url: { url: dataUrl } }
                ]
              }
            ]
          })
        }
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
      if (!content) return null;
      reporter?.status?.(`Analyzed visual evidence in ${name}`);
      return content;
    } catch {
      return null;
    }
  };
}

function extractCompletionTurn(payload: unknown): CompletionTurn {
  const message =
    payload && typeof payload === 'object'
      ? (payload as { choices?: Array<{ message?: unknown }> }).choices?.[0]
          ?.message
      : null;
  if (!message || typeof message !== 'object') {
    return { content: '', toolCalls: [] };
  }

  const record = message as Record<string, unknown>;
  const content =
    typeof record.content === 'string'
      ? record.content
      : Array.isArray(record.content)
        ? record.content
            .map((part) =>
              part && typeof part === 'object' && 'text' in part
                ? String((part as { text: unknown }).text)
                : ''
            )
            .join('')
        : '';
  const toolCalls = Array.isArray(record.tool_calls)
    ? record.tool_calls.flatMap(normalizeToolCall)
    : [];
  return coalesceCompletionTurn({ content, toolCalls });
}

function normalizeToolCall(value: unknown): ToolCall[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const fn = record.function;
  if (!fn || typeof fn !== 'object') return [];
  const fnRecord = fn as Record<string, unknown>;
  if (
    typeof fnRecord.name !== 'string' ||
    typeof fnRecord.arguments !== 'string'
  )
    return [];
  return [
    {
      id:
        typeof record.id === 'string'
          ? record.id
          : `tool_${Math.random().toString(16).slice(2)}`,
      function: {
        name: fnRecord.name,
        arguments: fnRecord.arguments
      }
    }
  ];
}

function parseArtifactContent(
  content: string,
  options: ArtifactParseOptions
):
  | { ok: true; artifact: ArtifactDocument }
  | { ok: false; error: string; raw: unknown } {
  try {
    const json = parseModelJson(content);
    const parsed = parseArtifactCandidate(json, options);
    if (parsed.success) {
      if (options.requiredTable && !artifactHasTable(parsed.data)) {
        return {
          ok: false,
          error:
            'The brief requested a real table, but the artifact has no section.table or sheet data.',
          raw: parsed.data
        };
      }
      if (options.citationsRequired && !artifactHasCitations(parsed.data)) {
        return {
          ok: false,
          error:
            'The artifact uses current or researched facts but does not include usable citations.',
          raw: parsed.data
        };
      }
      if (
        options.allowedCitationUrls &&
        !citationsAreGrounded(
          parsed.data.citations,
          options.allowedCitationUrls
        )
      ) {
        return {
          ok: false,
          error:
            'The artifact included citation URLs that were not present in the verified research pack.',
          raw: parsed.data
        };
      }
      if (
        options.allowedCitations &&
        !citationsMatchAllowedSources(
          parsed.data.citations,
          options.allowedCitations
        )
      ) {
        return {
          ok: false,
          error: 'The artifact mismatched a research source ID and URL.',
          raw: parsed.data
        };
      }
      if (
        options.citationsRequired &&
        options.allowedCitationIds &&
        !artifactHasTraceableSourceIds(parsed.data, options.allowedCitationIds)
      ) {
        return {
          ok: false,
          error:
            'The researched artifact must attach valid sourceIds to the slides or sections that use external evidence.',
          raw: parsed.data
        };
      }
      if (
        options.researchConfidence &&
        options.researchConfidence !== 'high' &&
        options.requestedSubject &&
        !explicitlyAcknowledgesUnverified(parsed.data)
      ) {
        return {
          ok: false,
          error: `The artifact must explicitly say that ${options.requestedSubject} could not be cleanly verified from current public sources.`,
          raw: parsed.data
        };
      }
      if (artifactContainsInternalExecutionLeak(parsed.data)) {
        return {
          ok: false,
          error: 'Artifact exposed an internal execution identifier.',
          raw: parsed.data
        };
      }
      return { ok: true, artifact: parsed.data };
    }
    return { ok: false, error: formatZodError(parsed.error), raw: json };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Model did not return valid JSON.',
      raw: content
    };
  }
}

function buildRepairMessages(
  options: ArtifactParseOptions,
  validationError: string,
  raw: unknown
) {
  const expectedKind = options.expectedKind ?? 'report';
  const expectedPrimaryFormat =
    options.expectedPrimaryFormat ?? defaultPrimaryFormat(expectedKind);
  return [
    {
      role: 'system',
      content: [
        'You repair Delegators Workbench artifact JSON.',
        'Return only one valid JSON object. Do not add Markdown.',
        'Use only facts already present in the supplied JSON/text. Do not invent contact details, companies, dates, marks, metrics, citations, or credentials.',
        'Remove unresolved placeholders. Do not invent channel names, approvers, recipients, affected systems, policy rules, or workflow steps.',
        'Move missing operational details to nextQuestions instead of filling them in.',
        ...(options.citationsRequired
          ? [
              'Keep citations with their exact source IDs, labels, and URLs. Attach valid sourceIds to researched slides and sections.'
            ]
          : []),
        ...(options.allowedCitationIds && options.allowedCitationIds.size > 0
          ? [
              'Allowed source IDs:',
              ...[...options.allowedCitationIds]
                .slice(0, 8)
                .map((id) => `- ${id}`)
            ]
          : []),
        ...(options.allowedCitationUrls && options.allowedCitationUrls.size > 0
          ? [
              'Every citation `url` must be copied VERBATIM from this allowed list (no other URLs are accepted):',
              ...[...options.allowedCitationUrls]
                .slice(0, 8)
                .map((url) => `- ${url}`)
            ]
          : []),
        ...(options.researchConfidence &&
        options.researchConfidence !== 'high' &&
        options.requestedSubject
          ? [
              `The current source pack did not cleanly verify "${options.requestedSubject}".`,
              'Do not substitute unrelated projects or generic company overviews.',
              'The repaired artifact must say the topic could not be verified and ask for a source or alternate name.'
            ]
          : []),
        `The kind must be "${expectedKind}".`,
        `The primaryFormat must be "${expectedPrimaryFormat}".`,
        'Preserve explicit design choices from the original artifact and brief. Do not replace requested fonts, colors, page setup, aspect ratio, or density with defaults.',
        'All sections must include heading, body, bullets. bullets is always an array.',
        'nextQuestions must contain no more than 6 items.',
        schemaContractForKind(expectedKind)
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Validation error:\n${validationError}`,
        `Preferred tone: ${options.fallbackTone ?? 'professional'}`,
        options.sourceBrief ? `Original brief:\n${options.sourceBrief}` : '',
        options.referenceDesignProfiles?.length
          ? `Uploaded presentation design profiles:\n${JSON.stringify(options.referenceDesignProfiles)}`
          : '',
        `Artifact to repair:\n${JSON.stringify(raw).slice(0, 30000)}`
      ]
        .filter(Boolean)
        .join('\n\n')
    }
  ];
}

function briefRequiresTable(brief: string): boolean {
  return /\b(table|metrics grid|comparison table|spreadsheet-ready|rows?|columns?)\b/i.test(
    brief
  );
}

function artifactHasTable(artifact: ArtifactDocument): boolean {
  return Boolean(
    artifact.sheet?.sheets?.length ||
    artifact.sections.some((section) => section.table)
  );
}

function artifactHasCitations(artifact: ArtifactDocument): boolean {
  return artifact.citations.some(
    (citation) => citation.label.trim() && citation.url?.trim()
  );
}

function artifactHasTraceableSourceIds(
  artifact: ArtifactDocument,
  allowedIds: Set<string>
): boolean {
  if (allowedIds.size === 0) return true;
  const citationIds = new Set(
    artifact.citations
      .map((citation) => citation.id)
      .filter((id): id is string => Boolean(id && allowedIds.has(id)))
  );
  const contentSourceIds = [
    ...artifact.sections.flatMap((section) => section.sourceIds ?? []),
    ...(artifact.slides ?? []).flatMap((slide) => slide.sourceIds ?? [])
  ];
  return (
    citationIds.size > 0 &&
    contentSourceIds.length > 0 &&
    contentSourceIds.every((id) => allowedIds.has(id) && citationIds.has(id))
  );
}

function citationsMatchAllowedSources(
  citations: ArtifactDocument['citations'],
  allowed: Map<string, string>
): boolean {
  if (allowed.size === 0) return citations.length === 0;
  return citations.every((citation) => {
    if (!citation.id || !citation.url) return false;
    return allowed.get(citation.id) === citation.url;
  });
}

function schemaContractForKind(kind: ArtifactKind): string {
  if (kind === 'resume') {
    return [
      'For resume: include top-level resume object.',
      'resume.contact, resume.skills, resume.experience, resume.education, resume.projects must be arrays even when empty.',
      'Put summary/profile text in resume.summary and also keep user-facing sections.',
      'Set design.template to "classic-ats" for a traditional/ATS-safe resume or "modern-indigo" for a contemporary accent style, unless the user asked for a specific direction.'
    ].join(' ');
  }
  if (kind === 'deck') {
    return [
      'For deck: include top-level slides array.',
      'Before writing slide copy, assign every slide one narrative role: "opener", "context", "tension", "evidence", "insight", "solution", "plan", "proof", or "close". The sequence must form an argument, not a topic inventory.',
      'The slides array is the complete exported deck. Match the requested total slide count exactly and include a title slide only when the user requests or the content needs one.',
      'Each slide must include a conclusion-style title and at least one useful content field. bullets may be empty when the slide uses metrics, columns, quote, chart, table, or image.',
      'When available source images are listed, set imageAssetId to one of those exact IDs on the most relevant slides. Never invent an image ID.',
      'Each slide may set layout to "cover", "statement", "split", "grid", "list", "chart", "metric", "comparison", "timeline", "process", "quote", or "image" and theme to "light", "dark", or "accent". Choose the layout from the narrative role and reuse a restrained visual grammar; random one-off layouts are as bad as repetition.',
      'For metric slides, prefer metrics: [{ value, label, detail? }] instead of parsing numbers out of prose.',
      'For comparison slides, provide exactly two columns: [{ heading, body?, bullets: string[] }, { heading, body?, bullets: string[] }].',
      'For quote slides, provide quote and optional quoteAttribution. For process/timeline slides, order 3-6 concise bullets as stages.',
      'Use eyebrow for a short section label and takeaway for the single conclusion the audience should retain.',
      'When data tells a trend, comparison, or composition story, give that slide a chart: { type: "bar"|"column"|"line"|"area"|"pie"|"donut", title?, labels: string[], series: [{ name, values: number[] }], unit? }. It renders as a NATIVE editable PowerPoint chart. A data-driven deck without a single chart slide is a failure.',
      'A slide may also carry a table { columns, rows } for dense comparisons.',
      'For decks with six or more slides: use 3-5 recurring layout families, never repeat one layout three times consecutively, and make at least one-third of slides visually structured with charts, tables, source images, metrics, comparisons, processes, timelines, or a purposeful quote.',
      'Use a controlled theme rhythm: normally dark opener, light content run, at most one intentional accent interruption, and dark close. Do not alternate themes slide by slide.',
      'Keep each slide below 520 total bullet characters and avoid generic topic titles such as "Problem", "Solution", "Market", or "Conclusion".',
      'Set design.template to one of "executive-slate", "editorial-ivory", "consulting-mono", "modern-indigo", "midnight-aurora", "bold-pop", "cobalt-bold", "noir-lumina", "editorial-warm", "signal-orange" — the one that fits the audience — and only override palette/fonts when the user asked for a specific direction.',
      'Also include sections that summarize the same slide content; each section needs heading.'
    ].join(' ');
  }
  if (kind === 'sheet') {
    return [
      'For sheet: include top-level sheet.sheets array.',
      'Each sheet needs name, columns, rows. columns and every row must be arrays of strings.',
      'The workbook exports to real Excel. Row 1 is the header row, so the first data row is spreadsheet row 2.',
      'Every derived value (totals, differences, % change, averages, running balances) must be a live formula string starting with "=" using correct A1 references, e.g. "=SUM(C2:C13)", "=C5-B5", "=C5/B5-1", "=AVERAGE(D2:D13)". Never hard-code a number Excel can compute.',
      'Close each data table with a labelled total row whose numeric cells are formulas.',
      'Plain numeric cells must be bare digits (no currency symbols, no thousands separators); put units in the column header such as "Revenue (₹ lakh)".'
    ].join(' ');
  }
  if (kind === 'report') {
    return [
      'For report: build a direct factual narrative with a sharp title, summary, sections, and citations when sources exist.',
      'When a section presents numeric trends, comparisons, or composition, add section.chart { type, title?, labels, series: [{name, values}], unit? } — it renders as a vector chart in the PDF. Use real numbers only.',
      'When available source images are listed, set imageAssetId to one of those exact IDs on relevant sections. Never invent an image ID.',
      'Set design.template to one of "executive-slate", "editorial-ivory", "consulting-mono", "modern-indigo", "midnight-aurora", "cobalt-bold", "editorial-warm", "signal-orange" — match it to the document’s audience.',
      'Do not turn an unverified topic into a generic recommendation memo or company profile.'
    ].join(' ');
  }
  return 'For this kind: sections is the primary output and must be complete enough to export.';
}

function parseModelJson(content: string): unknown {
  return parseArtifactJson(content);
}

function sendAgentError(res: express.Response, error: unknown): void {
  if (error instanceof AgentHttpError) {
    const details =
      error.status === 429
        ? 'Delegators is busy right now (rate limit). Wait a few seconds and send again.'
        : scrubSecrets(error.body || error.message).slice(0, 500);
    res
      .status(error.status >= 400 && error.status < 600 ? error.status : 502)
      .json({
        error: 'delegators_endpoint_error',
        details
      });
    return;
  }

  const message = sanitizeClientError(error);
  // User-fixable content/quality outcomes (fabricated numbers, unmet publication
  // checks, model output we couldn't finalize) are NOT server faults — return 422
  // with the actionable notice so the UI shows a clean "here's what to fix / retry"
  // message instead of a scary 500. The anti-fabrication block itself is unchanged.
  const userFixable =
    message.includes('blocked from publication') ||
    message.includes('missed publication checks') ||
    message.includes('could not finish a valid artifact');
  const status = endpointValidationMessages.some((value) =>
    message.includes(value)
  )
    ? 400
    : userFixable
      ? 422
      : message.includes('invalid artifact JSON') ||
          message.includes('did not return JSON')
        ? 502
        : message.includes('peak capacity')
          ? 503
          : 500;
  res.status(status).json({ error: 'workbench_error', details: message });
}

function sendRunActionError(res: express.Response, error: unknown): void {
  const message = sanitizeClientError(error);
  const status = message.includes('not found')
    ? 404
    : message.includes('cannot receive') ||
        message.includes('not active') ||
        message.includes('must be resumed')
      ? 409
      : 500;
  res.status(status).json({ error: 'run_action_error', details: message });
}

function isTerminalRunStatus(status: string): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'interrupted'
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException('Run cancelled.', 'AbortError');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runIdParam(req: express.Request): string {
  const value = req.params.runId;
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}

class AgentHttpError extends Error {
  readonly retryAfterMs?: number;

  constructor(
    readonly status: number,
    readonly body: string,
    retryAfterSeconds?: number
  ) {
    super(`Delegators endpoint returned HTTP ${status}`);
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      this.retryAfterMs = Math.min(retryAfterSeconds * 1000, 12_000);
    }
  }
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
