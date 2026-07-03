import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Brain,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GitBranch,
  Link2,
  Layers,
  LayoutTemplate,
  Loader2,
  MessageSquarePlus,
  Mic,
  Paperclip,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  Pencil,
  Plus,
  Presentation,
  Search,
  Moon,
  Settings,
  Square,
  Sun,
  Trash2,
  X
} from 'lucide-react';
import { UserButton, useUser } from '@clerk/clerk-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ClipboardEvent,
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode
} from 'react';
import { ArtifactPreview } from './components/ArtifactPreview';
import { useWorkbenchAccount } from './components/AccountGate';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { PersonalKnowledgePanel } from './components/PersonalKnowledgePanel';
import { RunProgressPanel } from './components/RunProgressPanel';
import { CloudSaveActions } from './components/CloudSaveActions';

import { VoiceRecordingStrip } from './components/VoiceRecordingStrip';

import { LoadingBreadcrumb } from './components/ui/animated-loading-svg-text-shimmer';
import { ComposerModelPicker } from './components/ui/ComposerModelPicker';
import { ModelPicker } from './components/ui/ModelPicker';
import {
  appendActivityLog,
  isThreadWorking,
  latestActivityMessage,
  mergeProgressItems,
  sanitizeHydratedThreads
} from './lib/threadActivity';
import {
  downloadArtifact,
  exportFormatsForArtifact,
  primaryExportFormat
} from './lib/downloads';
import {
  ArtifactDocumentSchema,
  type ArtifactDocument,
  type ArtifactExportFormat,
  type CreateWorkbenchRunRequest,
  type GenerateArtifactRequest,
  type SkillStyle,
  type WorkbenchReferenceInput,
  type WorkbenchProgressItem,
  type WorkbenchQuestion,
  type WorkbenchQuestionItem,
  type WorkbenchRunStatus,
  WorkbenchRunEventSchema,
  WorkbenchRunSchema
} from './lib/shared';
import {
  findSkillById,
  resolveSkillFromText,
  skillCatalog,
  stripSkillTags,
  type SkillDefinition
} from './lib/skills';
import {
  applySkillSelection,
  detectAtQuery,
  filterSkills,
  type AtQuery
} from './lib/commandMenu';
import {
  promptWithSkill,
  toolMetaForSkill,
  visiblePromptForSkill
} from './lib/skillIcons';
import {
  appendArtifactHistory,
  artifactFormatLabel,
  recentArtifacts,
  recentConversation
} from './lib/threadContext';
import {
  inferSkillFromThreadRequest,
  shouldGenerateNewArtifact
} from './lib/threadArtifactRouting';
import {
  canRestartSavedArtifact,
  isArtifactContinuation,
  formatAssistantProse
} from './lib/artifactContinuation';
import { friendlyRunError, isTransientDelegatorsError } from './lib/runErrors';
import { quietWorkbenchFetch } from './lib/quietFetch';
import {
  fetchIntegrationsStatus,
  listenForIntegrationOAuthPopup,
  type IntegrationsStatus
} from './lib/integrations';
import { fetchKnowledgeGraph } from './lib/knowledge';

import {
  loadThreadArchive,
  prepareThreadArchive,
  saveThreadArchive
} from './lib/threadStorage';
import {
  isThreadArchiveHydrated,
  markThreadArchiveHydrated
} from './lib/threadHydration';
import { ChatMarkdown } from './components/ChatMarkdown';
import { TemplateGallery } from './components/TemplateGallery';
import { ThemeToggle } from './components/ThemeToggle';
import { buildTemplatePreviewArtifact } from './lib/templatePreviewArtifacts';
import {
  resolveTemplateMetadata,
  type WorkbenchTemplate
} from './lib/workbenchTemplates';
import {
  buildGenerationBrief,
  buildTemplateWelcomeMessage,
  resolveActiveTemplate,
  templateComposerDisplayMessage,
  templateHarnessMetadata,
  buildTemplateTurnMessage,
  resolveTemplateTurnRouting,
  templateSessionFromTemplate,
  type TemplateSessionState
} from './lib/templateHarness';
import {
  fetchWorkbenchUsage,
  isWorkbenchSessionKey,
  openWorkbenchPlans,
  probeWorkbenchSession,
  readResolvedCredentials,
  resolveManualSessionPlan,
  WORKBENCH_WALLET_RESOLVED_EVENT,
  workbenchCreditUsage,
  workbenchFetch,
  type ManualSessionPlan,
  type WorkbenchUsage
} from './lib/account';
import { parseComposerModelSelection } from './lib/composerModelLanes';
import {
  applyWorkbenchTheme,
  persistTheme,
  readStoredTheme,
  type WorkbenchTheme
} from './lib/theme';
import {
  buildSubmitPrompt,
  composerPreviewHeight,
  isImageMime,
  messageAttachmentsFromReferences,
  referencePreviewUrl,
  reindexImageReferences,
  type MessageAttachment
} from './lib/composerAttachments';
import {
  BrowserVoiceRecorder,
  requestMicrophoneAccess,
  transcribeVoice
} from './lib/voiceInput';

const fallbackEndpoint = 'http://localhost:8080';
const fallbackModel =
  import.meta.env.VITE_DELEGATORS_DEFAULT_MODEL ?? 'dlg-pro';
const MIN_VOICE_TRANSCRIBING_MS = 250;

const defaultStyle: SkillStyle = 'professional';
const maxReferenceBytes = 8 * 1024 * 1024;

type ApiError = { error?: string; details?: string };
type WorkbenchConfig = { delegatorsBaseURL: string; defaultModel: string };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  skill?: SkillDefinition;
  artifact?: ArtifactDocument;
  isSearch?: boolean;
  attachments?: MessageAttachment[];
};

type CredentialFreeRunRequest<T> = T extends unknown
  ? Omit<T, 'sessionKey'>
  : never;

type PendingRunRequest = CredentialFreeRunRequest<CreateWorkbenchRunRequest>;

interface WorkThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  artifact: ArtifactDocument | null;
  versions: ArtifactDocument[];
  activeVersion: number;
  runId?: string;
  runStatus?: WorkbenchRunStatus;
  pendingRequest?: PendingRunRequest;
  pendingInstructions?: string[];
  activityLog?: string[];
  planTitle?: string;
  planItems?: WorkbenchProgressItem[];
  chatStreaming?: boolean;
  activeTemplate?: TemplateSessionState;
  updatedAt: number;
}

type ClarificationFlow = {
  questions: WorkbenchQuestionItem[];
  index: number;
  answers: Record<string, string>;
  sending: boolean;
};

function loadThreads(): WorkThread[] {
  try {
    const raw = localStorage.getItem('dw:threads');
    return parseThreads(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function persistThreads(threads: WorkThread[]) {
  if (!isThreadArchiveHydrated()) return;
  try {
    localStorage.setItem(
      'dw:threads',
      JSON.stringify(prepareThreadArchive(threads, false))
    );
  } catch {
    // IndexedDB remains the durable source when browser localStorage is unavailable or full.
  }
  void saveThreadArchive(prepareThreadArchive(threads, true)).catch(
    () => undefined
  );
}

function parseThreads(stored: unknown): WorkThread[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((candidate): WorkThread[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const thread = candidate as Partial<WorkThread>;
    const parsedArtifact = thread.artifact
      ? ArtifactDocumentSchema.safeParse(thread.artifact)
      : null;
    const versions = Array.isArray(thread.versions)
      ? thread.versions.flatMap((artifact) => {
          const parsed = ArtifactDocumentSchema.safeParse(artifact);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
    if (versions.length === 0 && parsedArtifact?.success)
      versions.push(parsedArtifact.data);
    const activeVersion =
      versions.length > 0
        ? Math.max(
            0,
            Math.min(
              thread.activeVersion ?? versions.length - 1,
              versions.length - 1
            )
          )
        : 0;
    return [
      {
        id:
          typeof thread.id === 'string' && thread.id
            ? thread.id
            : crypto.randomUUID(),
        title:
          typeof thread.title === 'string' && thread.title
            ? thread.title
            : 'New workspace',
        messages: Array.isArray(thread.messages)
          ? (thread.messages.map((message) => {
              if (!message || typeof message !== 'object') return message;
              const storedMessage = message as ChatMessage;
              return storedMessage.role === 'assistant' &&
                typeof storedMessage.text === 'string'
                ? {
                    ...storedMessage,
                    text: formatAssistantProse(storedMessage.text)
                  }
                : storedMessage;
            }) as ChatMessage[])
          : [],
        artifact: versions[activeVersion] ?? null,
        versions,
        activeVersion,
        runId: thread.runId,
        runStatus: thread.runStatus,
        pendingRequest: thread.pendingRequest,
        pendingInstructions: thread.pendingInstructions,
        activityLog: Array.isArray(thread.activityLog)
          ? thread.activityLog.filter((line) => typeof line === 'string')
          : [],
        planTitle:
          typeof thread.planTitle === 'string' ? thread.planTitle : undefined,
        planItems: Array.isArray(thread.planItems)
          ? thread.planItems
          : undefined,
        activeTemplate:
          thread.activeTemplate &&
          typeof thread.activeTemplate === 'object' &&
          typeof thread.activeTemplate.templateId === 'string' &&
          thread.activeTemplate.templateId
            ? { templateId: thread.activeTemplate.templateId }
            : undefined,
        updatedAt:
          typeof thread.updatedAt === 'number' ? thread.updatedAt : Date.now()
      }
    ];
  });
}

function mergeThreadArchives(
  current: WorkThread[],
  archived: WorkThread[]
): WorkThread[] {
  const archivedIds = new Set(archived.map((thread) => thread.id));
  return [
    ...archived.map((stored) => {
      const live = current.find((thread) => thread.id === stored.id);
      return live && live.updatedAt > stored.updatedAt ? live : stored;
    }),
    ...current.filter((thread) => !archivedIds.has(thread.id))
  ];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function App() {
  const account = useWorkbenchAccount();
  const [config, setConfig] = useState<WorkbenchConfig | null>(null);
  const [endpoint, setEndpoint] = useState(
    () => localStorage.getItem('dw:endpoint') ?? fallbackEndpoint
  );
  const [sessionKey, setSessionKey] = useState(
    () => sessionStorage.getItem('dw:sessionKey') ?? ''
  );
  const [model, setModel] = useState<string>(
    () => localStorage.getItem('dw:model') ?? fallbackModel
  );
  const [rememberForTab, setRememberForTab] = useState(() =>
    Boolean(sessionStorage.getItem('dw:sessionKey'))
  );
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<WorkbenchReferenceInput[]>([]);

  const [threads, setThreads] = useState<WorkThread[]>(() =>
    sanitizeHydratedThreads(loadThreads())
  );
  const [threadsReady, setThreadsReady] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string>(
    () => localStorage.getItem('dw:activeThread') ?? ''
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(true);
  const [threadQuery, setThreadQuery] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [referenceDragActive, setReferenceDragActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspacePanel, setWorkspacePanel] = useState<
    'progress' | 'integrations' | 'knowledge' | null
  >(null);
  const [integrationsStatus, setIntegrationsStatus] =
    useState<IntegrationsStatus | null>(null);
  const [knowledgeItemCount, setKnowledgeItemCount] = useState<number | null>(
    null
  );
  const [theme, setTheme] = useState<WorkbenchTheme>(() => readStoredTheme());
  const [usageOpen, setUsageOpen] = useState(false);
  const [usage, setUsage] = useState<WorkbenchUsage | null>(null);
  const [usageError, setUsageError] = useState('');
  const [exporting, setExporting] = useState<ArtifactExportFormat | null>(null);
  const [error, setError] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planItems, setPlanItems] = useState<WorkbenchProgressItem[]>([]);
  const [liveStatus, setLiveStatus] = useState('');
  const [sessionLive, setSessionLive] = useState(false);
  const [manualPlan, setManualPlan] = useState<ManualSessionPlan | null>(null);

  const [clarificationFlow, setClarificationFlow] =
    useState<ClarificationFlow | null>(null);
  const [artifactTab, setArtifactTab] = useState<'preview' | 'sources'>(
    'preview'
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceRecorderRef = useRef(new BrowserVoiceRecorder());
  const [voicePhase, setVoicePhase] = useState<
    'idle' | 'listening' | 'transcribing'
  >('idle');
  const [voiceLevels, setVoiceLevels] = useState<number[]>(() =>
    Array.from({ length: 56 }, () => 0.06)
  );

  const messagesWrapRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const resumingRunRef = useRef('');
  const initialUsageOpenedRef = useRef(false);
  const activeThreadIdRef = useRef(activeThreadId);
  const chatAbortControllers = useRef(new Map<string, AbortController>());
  const runStreamAbortControllers = useRef(new Map<string, AbortController>());
  const activeClientStreams = useRef(new Set<string>());

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuQuery, setMenuQuery] = useState<AtQuery>({
    active: false,
    query: '',
    start: -1
  });
  const menuItems = useMemo(
    () => (menuOpen ? filterSkills(menuQuery.query) : []),
    [menuOpen, menuQuery]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const walletBlocked = account.enabled && account.needsCredits && !sessionLive;
  const legacyPlanBlocked =
    !account.enabled &&
    (!sessionKey.trim() || !isWorkbenchSessionKey(sessionKey) || !sessionLive);
  const planBlocked = walletBlocked || legacyPlanBlocked;
  const composerAllowedModels = account.enabled
    ? account.allowedModels
    : manualPlan?.live
      ? manualPlan.allowedModels
      : [];
  const hasConnection =
    Boolean(endpoint.trim() && sessionKey.trim() && model.trim()) &&
    !planBlocked;
  const isGenerating = useMemo(
    () => hasConnection && isThreadWorking(activeThread ?? undefined),
    [activeThread, hasConnection]
  );
  const messages = activeThread?.messages ?? [];

  const closeWorkspacePanel = useCallback(() => {
    setWorkspacePanel(null);
  }, []);

  const openWorkspacePanel = useCallback(
    (panel: 'progress' | 'integrations' | 'knowledge') => {
      setWorkspacePanel(panel);
    },
    []
  );

  const refreshWorkspaceBadges = useCallback(async () => {
    if (!account.enabled) {
      setIntegrationsStatus(null);
      setKnowledgeItemCount(null);
      return;
    }
    try {
      const [integrations, graph] = await Promise.all([
        fetchIntegrationsStatus(),
        fetchKnowledgeGraph()
      ]);
      setIntegrationsStatus(integrations);
      setKnowledgeItemCount(
        graph.stats.cloudFiles +
          graph.stats.memories +
          graph.stats.artifacts +
          graph.stats.threads
      );
    } catch {
      setIntegrationsStatus(null);
      setKnowledgeItemCount(null);
    }
  }, [account.enabled]);

  const connectedIntegrationCount = useMemo(() => {
    if (!integrationsStatus) return 0;
    return [
      integrationsStatus.google_workspace.connected,
      integrationsStatus.microsoft_365.connected
    ].filter(Boolean).length;
  }, [integrationsStatus]);

  const integrationsBadgeLabel = useMemo(() => {
    if (!account.enabled) return null;
    if (connectedIntegrationCount > 0) return String(connectedIntegrationCount);
    const configured =
      integrationsStatus &&
      (integrationsStatus.google_workspace.configured ||
        integrationsStatus.microsoft_365.configured);
    return configured ? '·' : null;
  }, [account.enabled, connectedIntegrationCount, integrationsStatus]);

  const knowledgeBadgeLabel = useMemo(() => {
    if (!account.enabled || knowledgeItemCount === null) return null;
    if (knowledgeItemCount > 0)
      return knowledgeItemCount > 99 ? '99+' : String(knowledgeItemCount);
    return '·';
  }, [account.enabled, knowledgeItemCount]);

  useEffect(() => {
    void refreshWorkspaceBadges();
  }, [refreshWorkspaceBadges]);

  useEffect(() => {
    return listenForIntegrationOAuthPopup(() => {
      void refreshWorkspaceBadges();
    });
  }, [refreshWorkspaceBadges]);

  useEffect(() => {
    setWorkspacePanel(null);
  }, [activeThreadId]);

  useEffect(() => {
    if (!error || !isTransientDelegatorsError(error)) return;
    const last = messages.at(-1);
    if (last?.role === 'assistant') setError('');
  }, [error, messages]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);
  const artifact = activeThread?.artifact ?? null;
  const versions = activeThread?.versions ?? [];
  const activeVersion = activeThread?.activeVersion ?? 0;
  const exportFormats = useMemo(
    () => (artifact ? exportFormatsForArtifact(artifact) : []),
    [artifact]
  );
  const primaryExport = useMemo(
    () => (artifact ? primaryExportFormat(artifact) : null),
    [artifact]
  );

  const activeTemplate = useMemo(
    () => resolveActiveTemplate(activeThread?.activeTemplate),
    [activeThread?.activeTemplate]
  );

  const selectedSkill = useMemo(
    () =>
      resolveSkillFromText(prompt) ??
      (activeTemplate ? findSkillById(activeTemplate.skillId) : undefined),
    [prompt, activeTemplate]
  );
  const visiblePrompt = useMemo(
    () => visiblePromptForSkill(prompt, selectedSkill),
    [prompt, selectedSkill]
  );
  const composerImageReferences = useMemo(
    () =>
      reindexImageReferences(references).filter((reference) =>
        isImageMime(reference.mimeType, reference.name)
      ),
    [references]
  );
  const composerFileReferences = useMemo(
    () =>
      references.filter(
        (reference) => !isImageMime(reference.mimeType, reference.name)
      ),
    [references]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const archivedRaw = await loadThreadArchive().catch(() => null);
      if (cancelled) return;
      const archived = archivedRaw ? parseThreads(archivedRaw) : [];
      const local = loadThreads();
      const merged = sanitizeHydratedThreads(
        mergeThreadArchives(local, archived)
      );
      setThreads(merged);
      markThreadArchiveHydrated();
      persistThreads(merged);
      setThreadsReady(true);
      const storedActive = localStorage.getItem('dw:activeThread') ?? '';
      if (storedActive && merged.some((thread) => thread.id === storedActive)) {
        setActiveThreadId(storedActive);
      } else if (merged.length > 0) {
        setActiveThreadId(merged[0].id);
        localStorage.setItem('dw:activeThread', merged[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!account.enabled || account.allowedModels.length === 0) return;
    setModel((current) => {
      const seed = account.allowedModels.includes(current)
        ? current
        : account.defaultModel &&
            account.allowedModels.includes(account.defaultModel)
          ? account.defaultModel
          : account.allowedModels[0];
      const resolved = parseComposerModelSelection(seed, account.allowedModels);
      if (resolved.model !== current) {
        localStorage.setItem('dw:model', resolved.model);
        return resolved.model;
      }
      return current;
    });
  }, [account.allowedModels, account.defaultModel, account.enabled]);

  useEffect(() => {
    if (
      account.enabled ||
      !manualPlan?.live ||
      manualPlan.allowedModels.length === 0
    )
      return;
    setModel((current) => {
      if (manualPlan.allowedModels.includes(current)) return current;
      const seed = manualPlan.defaultModel || manualPlan.allowedModels[0];
      const resolved = parseComposerModelSelection(
        seed,
        manualPlan.allowedModels
      );
      if (resolved.model !== current) {
        localStorage.setItem('dw:model', resolved.model);
        return resolved.model;
      }
      return current;
    });
  }, [account.enabled, manualPlan]);

  useEffect(() => {
    const key = sessionKey.trim();
    if (!key) {
      setSessionLive(false);
      setManualPlan(null);
      return;
    }
    let cancelled = false;
    void probeWorkbenchSession(key, endpoint).then((live) => {
      if (!cancelled) setSessionLive(live);
    });
    if (!account.enabled && isWorkbenchSessionKey(key)) {
      void resolveManualSessionPlan(key, endpoint).then((plan) => {
        if (!cancelled) setManualPlan(plan);
      });
    } else if (!account.enabled) {
      setManualPlan(null);
    }
    return () => {
      cancelled = true;
    };
  }, [sessionKey, endpoint, account.enabled]);

  useEffect(() => {
    if (!sessionLive || !account.needsCredits) return;
    void account.refreshWallet();
  }, [sessionLive, account.needsCredits, account.refreshWallet]);

  useEffect(() => {
    if (!planBlocked) return;
    chatAbortControllers.current.forEach((controller) => controller.abort());
    chatAbortControllers.current.clear();
    runStreamAbortControllers.current.forEach((controller) =>
      controller.abort()
    );
    runStreamAbortControllers.current.clear();
    activeClientStreams.current.clear();
    setLiveStatus('');
    setPlanTitle('');
    setPlanItems([]);
    setThreads((previous) => {
      const next = sanitizeHydratedThreads(previous);
      persistThreads(next);
      return next;
    });
  }, [planBlocked]);

  useEffect(() => {
    if (!account.enabled || !account.needsCredits || sessionLive) return;
    sessionStorage.removeItem('dw:sessionKey');
    setSessionKey('');
    setRememberForTab(false);
    setUsage(null);
    setUsageOpen(false);
  }, [account.enabled, account.needsCredits, sessionLive]);

  const syncResolvedCredentials = useCallback(() => {
    const creds = readResolvedCredentials();
    if (creds.endpoint) setEndpoint(creds.endpoint);
    if (creds.model) {
      setModel((current) => {
        if (!account.enabled || account.allowedModels.length === 0)
          return creds.model;
        if (account.allowedModels.includes(current)) return current;
        const resolved = parseComposerModelSelection(
          creds.model,
          account.allowedModels
        );
        return resolved.model;
      });
    }
    if (creds.sessionKey) {
      setSessionKey(creds.sessionKey);
      setRememberForTab(true);
    }
  }, [account.enabled, account.allowedModels]);

  useEffect(() => {
    if (!account.enabled) return;
    syncResolvedCredentials();
    const onWalletResolved = () => syncResolvedCredentials();
    window.addEventListener(WORKBENCH_WALLET_RESOLVED_EVENT, onWalletResolved);
    return () =>
      window.removeEventListener(
        WORKBENCH_WALLET_RESOLVED_EVENT,
        onWalletResolved
      );
  }, [account.enabled, account.planCode, syncResolvedCredentials]);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const response = await workbenchFetch('/api/config');
        if (!response.ok) return;
        const payload = (await response.json()) as WorkbenchConfig;
        if (cancelled) return;
        setConfig(payload);
        if (!localStorage.getItem('dw:endpoint'))
          setEndpoint(payload.delegatorsBaseURL || fallbackEndpoint);
        if (!localStorage.getItem('dw:model'))
          setModel(payload.defaultModel || fallbackModel);
      } catch {
        // will surface on first generation
      }
    }
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !account.enabled ||
      account.needsCredits ||
      initialUsageOpenedRef.current
    )
      return;
    if (new URLSearchParams(window.location.search).get('view') !== 'usage')
      return;
    initialUsageOpenedRef.current = true;
    void openUsageDashboard();
  }, [account.enabled, account.needsCredits]);

  useEffect(() => {
    const thread = activeThread;
    if (
      !thread?.runId ||
      (thread.artifact && !thread.pendingRequest) ||
      activeClientStreams.current.has(thread.id) ||
      resumingRunRef.current === thread.runId ||
      thread.runStatus === 'completed' ||
      thread.runStatus === 'cancelled' ||
      thread.runStatus === 'failed' ||
      (thread.runStatus === 'interrupted' && !hasConnection)
    ) {
      return;
    }
    resumingRunRef.current = thread.runId;
    syncActiveThreadUI(thread);
    const streamSignal = beginClientStream(thread.id);
    const handlers = makeRunHandlers(thread.id);
    const resume = async () => {
      if (thread.runStatus === 'interrupted') {
        return restartSavedRun(thread, handlers);
      }
      try {
        return await streamWorkbenchRun(thread.runId!, handlers, {
          signal: streamSignal.signal
        });
      } catch (error) {
        if (error instanceof RunInterruptedError) {
          return restartSavedRun(thread, handlers);
        }
        throw error;
      }
    };
    void resume()
      .then(({ artifact: resumedArtifact }) => {
        setError('');
        const isRefinement = thread.pendingRequest?.operation === 'refine';
        recordArtifact(thread.id, resumedArtifact);
        setThreads((previous) => {
          const current = previous.find((item) => item.id === thread.id);
          if (!current) return previous;
          const next = previous.map((item) =>
            item.id === thread.id
              ? {
                  ...item,
                  messages: [
                    ...item.messages,
                    {
                      id: crypto.randomUUID(),
                      role: 'assistant' as const,
                      text: isRefinement
                        ? `Done. I updated “${resumedArtifact.title}” and prepared a new downloadable version.`
                        : completionMessage(resumedArtifact),
                      artifact: resumedArtifact
                    }
                  ],
                  runStatus: 'completed' as const,
                  pendingRequest: undefined,
                  pendingInstructions: [],
                  updatedAt: Date.now()
                }
              : item
          );
          persistThreads(next);
          return next;
        });
      })
      .catch((err) => {
        if (err instanceof RunRecoveryCredentialsError) {
          updateThread(thread.id, { runStatus: 'interrupted' });
          promptForConnection(err.message);
          return;
        }
        updateThread(thread.id, { runStatus: 'failed' });
        const message = friendlyRunError(err);
        setError(message);
      })
      .finally(() => {
        resumingRunRef.current = '';
        endClientStream(thread.id);
        if (activeThreadIdRef.current === thread.id) {
          syncActiveThreadUI(
            threads.find((item) => item.id === thread.id) ?? null
          );
        }
      });
  }, [activeThread, endpoint, hasConnection, model, sessionKey]);

  // Keep the transcript pinned to the latest turn (composer-adjacent).
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }, [messages.length, isGenerating, liveStatus]);

  function setWorkbenchTheme(next: WorkbenchTheme) {
    setTheme(next);
    persistTheme(next);
    applyWorkbenchTheme(next);
  }

  function persistSettings(
    nextEndpoint = endpoint,
    nextModel = model,
    nextKey = sessionKey,
    nextRemember = rememberForTab
  ) {
    localStorage.setItem('dw:endpoint', nextEndpoint);
    localStorage.setItem('dw:model', nextModel);
    if (nextRemember) {
      sessionStorage.setItem('dw:sessionKey', nextKey);
    } else {
      sessionStorage.removeItem('dw:sessionKey');
    }
  }

  function updateThread(id: string, patch: Partial<WorkThread>) {
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
      );
      persistThreads(next);
      return next;
    });
  }

  function pushThreadActivity(threadId: string, message: string) {
    setThreads((prev) => {
      const next = prev.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              activityLog: appendActivityLog(thread.activityLog, message),
              updatedAt: Date.now()
            }
          : thread
      );
      persistThreads(next);
      return next;
    });
    if (activeThreadIdRef.current === threadId) {
      setLiveStatus(message);
    }
  }

  function syncActiveThreadUI(thread: WorkThread | null) {
    if (!thread || !isThreadWorking(thread)) {
      setLiveStatus('');
      setPlanTitle('');
      setPlanItems([]);
      return;
    }
    setLiveStatus(latestActivityMessage(thread.activityLog, thread.planTitle));
    setPlanTitle(thread.planTitle ?? '');
    setPlanItems(thread.planItems ?? []);
  }

  useEffect(() => {
    if (!threadsReady) return;
    syncActiveThreadUI(activeThread);
  }, [threadsReady, activeThread]);

  const activeActivityLog = useMemo(
    () =>
      (activeThread?.activityLog ?? []).filter(
        (line) => typeof line === 'string'
      ),
    [activeThread?.activityLog]
  );

  function beginClientStream(threadId: string): AbortController {
    activeClientStreams.current.add(threadId);
    const existing = runStreamAbortControllers.current.get(threadId);
    existing?.abort();
    const controller = new AbortController();
    runStreamAbortControllers.current.set(threadId, controller);
    return controller;
  }

  function endClientStream(threadId: string) {
    activeClientStreams.current.delete(threadId);
    runStreamAbortControllers.current.delete(threadId);
  }

  function makeRunHandlers(threadId: string): WorkbenchRunHandlers {
    return {
      onRun: (runId) => updateThread(threadId, { runId, runStatus: 'queued' }),
      onRunStatus: (status) => updateThread(threadId, { runStatus: status }),
      onStatus: (message) => pushThreadActivity(threadId, message),
      onPlan: (title, items) => {
        updateThread(threadId, { planTitle: title, planItems: items });
        if (activeThreadIdRef.current === threadId) {
          setPlanTitle(title);
          setPlanItems(items);
        }
      },
      onChecklist: (items) => {
        setThreads((prev) => {
          const next = prev.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  planItems: mergeProgressItems(thread.planItems, items),
                  updatedAt: Date.now()
                }
              : thread
          );
          persistThreads(next);
          return next;
        });
        if (activeThreadIdRef.current === threadId) {
          setPlanItems((current) => mergeProgressItems(current, items));
        }
      },
      onMessage: (text) => appendAssistantNote(threadId, text),
      onQuestion: startClarification
    };
  }

  function rememberPendingInstruction(threadId: string, instruction: string) {
    setThreads((previous) => {
      const next = previous.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              pendingInstructions: [
                ...(thread.pendingInstructions ?? []),
                instruction
              ],
              updatedAt: Date.now()
            }
          : thread
      );
      persistThreads(next);
      return next;
    });
  }

  async function restartSavedRun(
    thread: WorkThread,
    handlers: WorkbenchRunHandlers,
    signal?: AbortSignal
  ): Promise<{ artifact: ArtifactDocument; runId: string }> {
    if (!thread.pendingRequest) {
      throw new Error(
        'This artifact task is missing its recovery context. Please send the request again.'
      );
    }
    if (!endpoint.trim() || !sessionKey.trim() || !model.trim()) {
      throw new RunRecoveryCredentialsError(
        'Reconnect the endpoint, API key, and model to resume this artifact task.'
      );
    }

    setClarificationFlow(null);
    setLiveStatus('Restarting your artifact task');
    const request: CreateWorkbenchRunRequest = {
      ...thread.pendingRequest,
      endpoint: endpoint.trim(),
      sessionKey: sessionKey.trim(),
      model: model.trim()
    } as CreateWorkbenchRunRequest;

    return postArtifactRun(
      request,
      {
        ...handlers,
        onRun: async (runId) => {
          updateThread(thread.id, { runId, runStatus: 'queued' });
          for (const instruction of thread.pendingInstructions ?? []) {
            await postRunInstruction(runId, instruction);
          }
        }
      },
      { signal }
    );
  }

  function ensureActiveThread(): WorkThread {
    if (activeThread) return activeThread;
    const id = crypto.randomUUID();
    const fresh: WorkThread = {
      id,
      title: 'New workspace',
      messages: [],
      artifact: null,
      versions: [],
      activeVersion: 0,
      updatedAt: Date.now()
    };
    setThreads((prev) => {
      const next = [fresh, ...prev];
      persistThreads(next);
      return next;
    });
    setActiveThreadId(id);
    localStorage.setItem('dw:activeThread', id);
    return fresh;
  }

  const newThread = useCallback(() => {
    const id = crypto.randomUUID();
    const fresh: WorkThread = {
      id,
      title: 'New workspace',
      messages: [],
      artifact: null,
      versions: [],
      activeVersion: 0,
      updatedAt: Date.now()
    };
    setThreads((prev) => {
      const next = [fresh, ...prev];
      persistThreads(next);
      return next;
    });
    setActiveThreadId(id);
    localStorage.setItem('dw:activeThread', id);
    setPrompt('');
    setReferences([]);
    setError('');
    setMenuOpen(false);
    setReferenceDragActive(false);
    setPlanTitle('');
    setPlanItems([]);
    setLiveStatus('');
    setClarificationFlow(null);
    setArtifactTab('preview');
    syncActiveThreadUI(null);
  }, []);

  function switchThread(id: string) {
    setActiveThreadId(id);
    localStorage.setItem('dw:activeThread', id);
    setError('');
    setPrompt('');
    setReferences([]);
    setMenuOpen(false);
    setReferenceDragActive(false);
    setClarificationFlow(null);
    setArtifactTab('preview');
    const next = threads.find((thread) => thread.id === id) ?? null;
    syncActiveThreadUI(next);
  }

  function deleteThread(id: string, e: MouseEvent) {
    e.stopPropagation();
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persistThreads(next);
      return next;
    });
    if (activeThreadId === id) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        switchThread(remaining[0].id);
      } else {
        setActiveThreadId('');
        localStorage.removeItem('dw:activeThread');
      }
    }
  }

  function insertSkill(skill: SkillDefinition) {
    setPrompt((current) => {
      const withoutTrailingPartial = current
        .replace(/(^|\s)@[a-zA-Z0-9-]*$/, ' ')
        .trimStart();
      if (resolveSkillFromText(withoutTrailingPartial))
        return withoutTrailingPartial;
      return `${skill.tag} ${withoutTrailingPartial}`.trimStart();
    });
    textareaRef.current?.focus();
  }

  function clearActiveTemplate(threadId = activeThreadId) {
    if (!threadId) return;
    updateThread(threadId, { activeTemplate: undefined });
  }

  function applyWorkbenchTemplate(template: WorkbenchTemplate) {
    const thread = ensureActiveThread();
    const enriched = resolveTemplateMetadata(template);
    const preview = buildTemplatePreviewArtifact(template);
    recordArtifact(thread.id, preview);
    updateThread(thread.id, {
      activeTemplate: templateSessionFromTemplate(template)
    });
    setTemplateGalleryOpen(false);
    setSidebarOpen(false);
    setArtifactPanelOpen(true);
    setArtifactTab('preview');
    setMenuOpen(false);
    setPrompt('');
    appendAssistantNote(thread.id, buildTemplateWelcomeMessage(enriched));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function onComposerChange(value: string, caret: number) {
    if (selectedSkill) {
      setPrompt(promptWithSkill(selectedSkill, value));
      setMenuOpen(false);
      return;
    }
    setPrompt(value);
    const q = detectAtQuery(value, caret);
    if (q.active) {
      setMenuQuery(q);
      setMenuIndex(0);
      setMenuOpen(true);
    } else if (menuOpen) {
      setMenuOpen(false);
    }
  }

  function insertVoiceTranscript(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const existing = visiblePrompt.trim();
    const next = existing ? `${existing} ${trimmed}` : trimmed;
    onComposerChange(next, next.length);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function toggleVoiceInput() {
    if (voicePhase === 'transcribing') return;
    if (clarificationFlow) return;

    if (voicePhase === 'listening') {
      const connectionIssue = connectionError();
      if (connectionIssue) {
        voiceRecorderRef.current.cancel();
        setVoicePhase('idle');
        promptForConnection(connectionIssue);
        return;
      }
      setVoicePhase('transcribing');
      try {
        const recording = await voiceRecorderRef.current.stop();
        const transcribeStarted = Date.now();
        const result = await transcribeVoice(
          recording.wavBase64,
          recording.durationSeconds
        );
        const transcribeWait =
          MIN_VOICE_TRANSCRIBING_MS - (Date.now() - transcribeStarted);
        if (transcribeWait > 0) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, transcribeWait)
          );
        }
        insertVoiceTranscript(result.text);
      } catch (err) {
        voiceRecorderRef.current.cancel();
        setError(
          err instanceof Error ? err.message : 'Voice transcription failed.'
        );
      } finally {
        setVoicePhase('idle');
      }
      return;
    }

    try {
      setError('');
      // Permission prompt must fire on this click — request the mic before any other async work.
      const stream = await requestMicrophoneAccess();
      const connectionIssue = connectionError();
      if (connectionIssue) {
        stream.getTracks().forEach((track) => track.stop());
        promptForConnection(connectionIssue);
        return;
      }
      await voiceRecorderRef.current.start(stream);
      setVoicePhase('listening');
    } catch (err) {
      voiceRecorderRef.current.cancel();
      setError(
        err instanceof Error ? err.message : 'Could not access the microphone.'
      );
    }
  }

  useEffect(() => {
    if (voicePhase !== 'listening') return;
    let frame = 0;
    const tick = () => {
      setVoiceLevels(voiceRecorderRef.current.sampleLevels());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [voicePhase]);

  useEffect(() => {
    voiceRecorderRef.current.setMaxDurationHandler(() => {
      if (voicePhase === 'listening') void toggleVoiceInput();
    });
  });

  useEffect(() => () => voiceRecorderRef.current.cancel(), []);

  function chooseSkill(skill: SkillDefinition) {
    const ta = textareaRef.current;
    const caret = menuQuery.active
      ? menuQuery.start + menuQuery.query.length + 1
      : (ta?.selectionStart ?? prompt.length);
    const q = menuQuery.active ? menuQuery : detectAtQuery(prompt, caret);
    const out = applySkillSelection(prompt, q, skill, caret);
    setPrompt(out.text);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        const visibleCaret = visiblePromptForSkill(
          out.text.slice(0, out.caret),
          skill
        ).length;
        ta.setSelectionRange(visibleCaret, visibleCaret);
      }
    });
  }

  async function attachReferenceFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const next: WorkbenchReferenceInput[] = [];

    for (const file of Array.from(files)) {
      if (references.length + next.length >= 8) {
        setError('You can attach up to 8 files per message.');
        break;
      }
      if (file.size > maxReferenceBytes) {
        setError(`${file.name} is too large. Attach files up to 8 MB.`);
        continue;
      }
      const dataBase64 = await fileToBase64(file);
      next.push({
        id: crypto.randomUUID(),
        kind: 'file',
        name: file.name,
        mimeType: file.type || undefined,
        size: file.size,
        dataBase64
      });
    }
    if (!next.length) return;
    setReferences((current) =>
      reindexImageReferences([...current, ...next].slice(0, 8))
    );
    if (fileInputRef.current) fileInputRef.current.value = '';
    textareaRef.current?.focus();
  }

  function removeComposerReference(id: string | undefined) {
    if (!id) return;
    setReferences((current) =>
      reindexImageReferences(current.filter((reference) => reference.id !== id))
    );
  }

  function outgoingMessageText(userText = prompt): string {
    const userDetails = stripSkillTags(userText).trim();
    if (activeTemplate) {
      const turn = resolveTemplateTurnRouting(
        activeTemplate,
        userDetails,
        versions
      );
      if (turn === 'generate') {
        return buildSubmitPrompt(
          buildGenerationBrief(activeTemplate, userDetails, versions),
          references
        );
      }
      return buildSubmitPrompt(
        buildTemplateTurnMessage(activeTemplate, userDetails, turn, versions),
        references
      );
    }
    return buildSubmitPrompt(userText, references);
  }

  async function attachPastedImages(files: File[]) {
    if (!files.length) return;
    const list = {
      length: files.length,
      item: (index: number) => files[index] ?? null,
      [Symbol.iterator]: function* () {
        yield* files;
      }
    } as FileList;
    await attachReferenceFiles(list);
  }

  function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (clarificationFlow) return;
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    const imageFiles = Array.from(items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!imageFiles.length) return;
    event.preventDefault();
    void attachPastedImages(imageFiles);
  }

  function handleReferenceDragEnter(event: DragEvent<HTMLDivElement>) {
    if (clarificationFlow || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setReferenceDragActive(true);
  }

  function handleReferenceDragOver(event: DragEvent<HTMLDivElement>) {
    if (clarificationFlow || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setReferenceDragActive(true);
  }

  function handleReferenceDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!referenceDragActive) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
      return;
    setReferenceDragActive(false);
  }

  async function handleReferenceDrop(event: DragEvent<HTMLDivElement>) {
    if (clarificationFlow || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setReferenceDragActive(false);
    setMenuOpen(false);
    await attachReferenceFiles(event.dataTransfer.files);
  }

  function startClarification(question: WorkbenchQuestion) {
    const fallback: WorkbenchQuestionItem = {
      id: 'clarification-1',
      question: question.question,
      options: [],
      allowCustom: true
    };
    const questions = (
      question.questions?.length ? question.questions : [fallback]
    ).map((item, index) => ({
      ...item,
      id: item.id || `clarification-${index + 1}`,
      options: item.options ?? [],
      allowCustom: item.allowCustom ?? true
    }));
    setPrompt('');
    setMenuOpen(false);
    setClarificationFlow({ questions, index: 0, answers: {}, sending: false });
    setLiveStatus('Waiting for your artifact choices');
  }

  function setClarificationAnswer(answer: string) {
    setClarificationFlow((current) => {
      if (!current) return current;
      const question = current.questions[current.index];
      if (!question) return current;
      return {
        ...current,
        answers: { ...current.answers, [question.id]: answer }
      };
    });
  }

  function chooseClarificationOption(answer: string) {
    setClarificationFlow((current) => {
      if (!current) return current;
      const question = current.questions[current.index];
      if (!question) return current;
      const isLast = current.index === current.questions.length - 1;
      return {
        ...current,
        index: isLast ? current.index : current.index + 1,
        answers: { ...current.answers, [question.id]: answer }
      };
    });
  }

  function moveClarification(delta: number) {
    setClarificationFlow((current) =>
      current
        ? {
            ...current,
            index: Math.max(
              0,
              Math.min(current.questions.length - 1, current.index + delta)
            )
          }
        : current
    );
  }

  async function submitClarificationAnswers() {
    if (!clarificationFlow) return;
    const lines = clarificationFlow.questions.map((question, index) => {
      const answer =
        clarificationFlow.answers[question.id]?.trim() ||
        'No strong preference; choose what best serves the artifact.';
      return `Q${index + 1}: ${question.question}\nA${index + 1}: ${answer}`;
    });
    setClarificationFlow((current) =>
      current ? { ...current, sending: true } : current
    );
    try {
      await sendRunInstruction(`Clarification answers:\n${lines.join('\n\n')}`);
      setClarificationFlow(null);
      setLiveStatus('Continuing with your answers');
    } catch (err) {
      setClarificationFlow((current) =>
        current ? { ...current, sending: false } : current
      );
      setError(
        err instanceof Error ? err.message : 'Could not send these answers.'
      );
    }
  }

  // Mid-run assistant prose (preflight reply, post-answer follow-up): lands in
  // the transcript immediately so the run reads as a conversation, not a spinner.
  function appendAssistantNote(threadId: string, text: string) {
    const trimmed = formatAssistantProse(text).trim();
    if (!trimmed) return;
    if (isTransientDelegatorsError(error)) setError('');
    setThreads((prev) => {
      const thread = prev.find((t) => t.id === threadId);
      if (!thread) return prev;
      if (
        thread.messages.some(
          (m) => m.role === 'assistant' && m.text === trimmed
        )
      )
        return prev;
      const note: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: trimmed
      };
      const next = prev.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, note], updatedAt: Date.now() }
          : t
      );
      persistThreads(next);
      return next;
    });
  }

  function recordArtifact(threadId: string, next: ArtifactDocument) {
    setArtifactPanelOpen(true);
    setThreads((prev) => {
      const thread = prev.find((t) => t.id === threadId);
      if (!thread) return prev;
      const newVersions = appendArtifactHistory(thread.versions, next);
      const title =
        thread.title === 'New workspace'
          ? next.title.slice(0, 48)
          : thread.title;
      const next2 = prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              artifact: next,
              versions: newVersions,
              activeVersion: newVersions.length - 1,
              title,
              updatedAt: Date.now()
            }
          : t
      );
      persistThreads(next2);
      return next2;
    });
  }

  function viewVersion(index: number) {
    if (!activeThread) return;
    const doc = activeThread.versions[index];
    if (!doc) return;
    updateThread(activeThread.id, { artifact: doc, activeVersion: index });
  }

  async function resumePendingArtifact(thread: WorkThread, text: string) {
    persistSettings();
    setMenuOpen(false);
    const resumedSkill =
      thread.pendingRequest?.operation === 'generate' &&
      thread.pendingRequest.skillId
        ? findSkillById(thread.pendingRequest.skillId)
        : undefined;
    const cleanedMessages = thread.messages.map((message) =>
      message.role === 'assistant'
        ? { ...message, text: formatAssistantProse(message.text) }
        : message
    );
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      skill: resumedSkill
    };
    updateThread(thread.id, { messages: [...cleanedMessages, userMsg] });
    setPrompt('');
    setReferences([]);
    updateThread(thread.id, {
      runStatus: 'running',
      activityLog: [],
      planTitle: '',
      planItems: []
    });
    pushThreadActivity(thread.id, 'Restarting your artifact task');
    setClarificationFlow(null);
    setPlanTitle('');
    setPlanItems([]);
    const streamSignal = beginClientStream(thread.id);
    const handlers = makeRunHandlers(thread.id);

    try {
      const { artifact: nextArtifact, runId } = await restartSavedRun(
        thread,
        handlers,
        streamSignal.signal
      );
      updateThread(thread.id, {
        runId,
        runStatus: 'completed',
        pendingRequest: undefined,
        pendingInstructions: []
      });
      recordArtifact(thread.id, nextArtifact);
      setLiveStatus('Artifact ready');
      setError('');
      setThreads((previous) => {
        const next = previous.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    text: completionMessage(nextArtifact),
                    skill: resumedSkill,
                    artifact: nextArtifact
                  }
                ],
                updatedAt: Date.now()
              }
            : item
        );
        persistThreads(next);
        return next;
      });
    } catch (err) {
      const message = friendlyRunError(err);
      updateThread(thread.id, { runStatus: 'failed' });
      setLiveStatus('');
      setError(message);
      setThreads((previous) => {
        const next = previous.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    text: message,
                    skill: resumedSkill
                  }
                ],
                updatedAt: Date.now()
              }
            : item
        );
        persistThreads(next);
        return next;
      });
    } finally {
      endClientStream(thread.id);
      if (activeThreadIdRef.current === thread.id) {
        syncActiveThreadUI(
          threads.find((item) => item.id === thread.id) ?? null
        );
      }
    }
  }

  function connectionError(): string | null {
    if (planBlocked) {
      return account.enabled
        ? 'No active Workbench plan. Open the plans page to continue.'
        : 'No active Workbench session. Open Workbench plans to purchase or paste a live sess_ key.';
    }
    if (!endpoint.trim() || !sessionKey.trim() || !model.trim()) {
      return account.enabled
        ? 'Workbench credentials are still loading. Retry in a moment.'
        : 'Add endpoint, API key, and model before sending.';
    }
    if (!isValidWorkbenchSessionKey(sessionKey)) {
      return 'Paste a valid sess_ or wb_ API key from your Workbench purchase.';
    }
    return null;
  }

  function openPlansPage() {
    if (account.enabled) {
      account.openPlans();
      return;
    }
    openWorkbenchPlans();
  }

  function promptForConnection(issue: string) {
    setError(issue);
    if (account.enabled) return;
    // Legacy manual-key mode: steer to the store instead of auto-opening Settings.
  }

  async function submitPrompt() {
    const trimmed = prompt.trim();
    const messageText = outgoingMessageText();
    setError('');
    if (!messageText.trim()) return;

    if (planBlocked) {
      promptForConnection(
        connectionError() ||
          'No active Workbench plan. Open the plans page to continue.'
      );
      return;
    }

    const connectionIssue = connectionError();
    if (connectionIssue) {
      promptForConnection(connectionIssue);
      return;
    }

    const thread = ensureActiveThread();
    const template = resolveActiveTemplate(thread.activeTemplate);
    const skill =
      resolveSkillFromText(trimmed) ??
      (template ? findSkillById(template.skillId) : undefined) ??
      inferSkillFromThreadRequest(trimmed, thread.versions);
    const userDetails = stripSkillTags(trimmed).trim();
    const templateTurn = template
      ? resolveTemplateTurnRouting(template, userDetails, thread.versions)
      : null;

    if (template && templateTurn === 'chat') {
      setPrompt('');
      setReferences([]);
      void chatTurn(
        buildTemplateTurnMessage(template, userDetails, 'chat', thread.versions)
      );
      return;
    }

    if (template && templateTurn === 'refine' && artifact) {
      setPrompt('');
      setReferences([]);
      void refineArtifact(
        buildTemplateTurnMessage(
          template,
          userDetails || 'Refine the loaded template preview.',
          'refine',
          thread.versions
        )
      );
      return;
    }

    if (template && templateTurn === 'generate' && artifact) {
      setPrompt('');
      setReferences([]);
      void refineArtifact(
        buildTemplateTurnMessage(
          template,
          userDetails,
          'generate',
          thread.versions
        )
      );
      return;
    }

    const wantsNewArtifact =
      template && templateTurn === 'generate'
        ? true
        : Boolean(skill) || shouldGenerateNewArtifact(trimmed, thread.versions);

    if (!wantsNewArtifact) {
      if (
        activeThread &&
        isArtifactContinuation(trimmed) &&
        canRestartSavedArtifact(
          Boolean(activeThread.pendingRequest),
          activeThread.runStatus,
          activeThread.runId
        )
      ) {
        void resumePendingArtifact(activeThread, trimmed);
        return;
      }
      if (artifact) {
        if (trimmed.length < 4) {
          void chatTurn(trimmed);
          return;
        }
        void refineArtifact(trimmed);
        return;
      }
      // No skill tag and no artifact yet: a normal conversation turn.
      void chatTurn(trimmed);
      return;
    }

    persistSettings();
    setMenuOpen(false);

    const resolvedSkill =
      skill ?? inferSkillFromThreadRequest(trimmed, thread.versions);
    if (!resolvedSkill) {
      void chatTurn(trimmed);
      return;
    }

    const activeReferences = references;
    const harnessMeta = template
      ? templateHarnessMetadata(template)
      : undefined;
    const request: GenerateArtifactRequest = {
      endpoint: endpoint.trim(),
      sessionKey: sessionKey.trim(),
      threadId: thread.id,
      model: model.trim(),
      skill: resolvedSkill.kind,
      skillId: resolvedSkill.id,
      outputFormat: resolvedSkill.primaryOutput,
      style: defaultStyle,
      brief: messageText,
      conversation: recentConversation(thread.messages),
      priorArtifacts: recentArtifacts(thread.versions),
      references: activeReferences.length ? activeReferences : undefined,
      templateId: harnessMeta?.templateId,
      scaffoldId: harnessMeta?.scaffoldId,
      designPreset: harnessMeta?.designPreset
    };
    const runRequest: CreateWorkbenchRunRequest = {
      operation: 'generate',
      ...request
    };
    const chatDisplayText = template
      ? templateComposerDisplayMessage(template, stripSkillTags(prompt).trim())
      : messageText;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: chatDisplayText,
      skill: resolvedSkill,
      attachments: messageAttachmentsFromReferences(activeReferences)
    };
    updateThread(thread.id, {
      messages: [...thread.messages, userMsg],
      runId: undefined,
      runStatus: undefined,
      pendingRequest: withoutRunCredentials(runRequest),
      pendingInstructions: []
    });
    setPrompt('');
    setReferences([]);
    updateThread(thread.id, {
      runStatus: 'running',
      activityLog: [],
      planTitle: '',
      planItems: [],
      activeTemplate: undefined
    });
    pushThreadActivity(thread.id, 'Planning your artifact');
    setClarificationFlow(null);
    setPlanTitle('');
    setPlanItems([]);
    const streamSignal = beginClientStream(thread.id);
    const handlers = makeRunHandlers(thread.id);

    try {
      const { artifact: nextArtifact, runId } = await postArtifactRun(
        runRequest,
        handlers,
        { signal: streamSignal.signal }
      );
      updateThread(thread.id, {
        runId,
        runStatus: 'completed',
        pendingRequest: undefined,
        pendingInstructions: []
      });
      recordArtifact(thread.id, nextArtifact);
      setLiveStatus('Artifact ready');
      setError('');

      setThreads((prev) => {
        const t = prev.find((x) => x.id === thread.id);
        if (!t) return prev;
        const assistMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: completionMessage(nextArtifact),
          skill,
          artifact: nextArtifact
        };
        const next = prev.map((x) =>
          x.id === thread.id
            ? {
                ...x,
                messages: [...x.messages, assistMsg],
                updatedAt: Date.now()
              }
            : x
        );
        persistThreads(next);
        return next;
      });
    } catch (err) {
      const message = friendlyRunError(err);
      updateThread(thread.id, { runStatus: 'failed' });
      setLiveStatus('');
      setError(message);
      setThreads((prev) => {
        const t = prev.find((x) => x.id === thread.id);
        if (!t) return prev;
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: message,
          skill
        };
        const next = prev.map((x) =>
          x.id === thread.id
            ? { ...x, messages: [...x.messages, errMsg], updatedAt: Date.now() }
            : x
        );
        persistThreads(next);
        return next;
      });
    } finally {
      endClientStream(thread.id);
      if (activeThreadIdRef.current === thread.id) {
        syncActiveThreadUI(
          threads.find((item) => item.id === thread.id) ?? null
        );
      }
    }
  }

  async function refineArtifact(instruction: string) {
    const trimmedInstruction = instruction.trim();
    const messageText = buildSubmitPrompt(trimmedInstruction, references);
    if (messageText.trim().length < 4) {
      void chatTurn(trimmedInstruction);
      return;
    }
    const connectionIssue = connectionError();
    if (connectionIssue) {
      promptForConnection(connectionIssue);
      return;
    }
    if (!artifact || !activeThread) return;
    persistSettings();
    setMenuOpen(false);
    const threadId = activeThread.id;
    const activeReferences = references;
    const template = resolveActiveTemplate(activeThread.activeTemplate);
    const harnessMeta = template
      ? templateHarnessMetadata(template)
      : undefined;
    const runRequest: CreateWorkbenchRunRequest = {
      operation: 'refine',
      endpoint: endpoint.trim(),
      sessionKey: sessionKey.trim(),
      threadId,
      model: model.trim(),
      instruction: messageText,
      artifact,
      conversation: recentConversation(activeThread.messages),
      priorArtifacts:
        activeThread.versions.length > 1
          ? recentArtifacts(activeThread.versions.slice(0, -1))
          : undefined,
      references: activeReferences.length ? activeReferences : undefined,
      templateId: harnessMeta?.templateId,
      scaffoldId: harnessMeta?.scaffoldId,
      designPreset: harnessMeta?.designPreset
    };
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: messageText,
      attachments: messageAttachmentsFromReferences(activeReferences)
    };
    updateThread(threadId, {
      messages: [...activeThread.messages, userMsg],
      runId: undefined,
      runStatus: undefined,
      pendingRequest: withoutRunCredentials(runRequest),
      pendingInstructions: []
    });
    setPrompt('');
    setReferences([]);
    updateThread(threadId, {
      runStatus: 'running',
      activityLog: [],
      planTitle: '',
      planItems: []
    });
    pushThreadActivity(threadId, 'Revising artifact');
    setError('');
    setClarificationFlow(null);
    setPlanTitle('');
    setPlanItems([]);
    const streamSignal = beginClientStream(threadId);
    const handlers = makeRunHandlers(threadId);
    try {
      const { artifact: next, runId } = await postArtifactRun(
        runRequest,
        handlers,
        { signal: streamSignal.signal }
      );
      updateThread(threadId, {
        runId,
        runStatus: 'completed',
        pendingRequest: undefined,
        pendingInstructions: []
      });
      recordArtifact(threadId, next);
      setLiveStatus('Artifact ready');
      setError('');
      setThreads((prev) => {
        const t = prev.find((x) => x.id === threadId);
        if (!t) return prev;
        const assistMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `Done. I updated “${next.title}” and prepared a new downloadable version.`,
          artifact: next
        };
        const next2 = prev.map((x) =>
          x.id === threadId
            ? {
                ...x,
                messages: [...x.messages, assistMsg],
                updatedAt: Date.now()
              }
            : x
        );
        persistThreads(next2);
        return next2;
      });
    } catch (err) {
      const message = friendlyRunError(err);
      updateThread(threadId, { runStatus: 'failed' });
      setLiveStatus('');
      setError(message);
      setThreads((prev) => {
        const t = prev.find((x) => x.id === threadId);
        if (!t) return prev;
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: message
        };
        const next2 = prev.map((x) =>
          x.id === threadId
            ? { ...x, messages: [...x.messages, errMsg], updatedAt: Date.now() }
            : x
        );
        persistThreads(next2);
        return next2;
      });
    } finally {
      endClientStream(threadId);
      if (activeThreadIdRef.current === threadId) {
        syncActiveThreadUI(
          threads.find((item) => item.id === threadId) ?? null
        );
      }
    }
  }

  async function chatTurn(text: string) {
    if (planBlocked) {
      promptForConnection(
        connectionError() ||
          'No active Workbench plan. Open the plans page to continue.'
      );
      return;
    }
    const connectionIssue = connectionError();
    if (connectionIssue) {
      promptForConnection(connectionIssue);
      return;
    }
    persistSettings();
    setMenuOpen(false);
    setError('');
    const thread = ensureActiveThread();
    const messageText = buildSubmitPrompt(text, references);
    const activeReferences = references;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: messageText,
      attachments: messageAttachmentsFromReferences(activeReferences)
    };
    const history = [...thread.messages, userMsg]
      .filter((message) => message.text.trim())
      .slice(-12)
      .map((message) => ({ role: message.role, text: message.text }));
    updateThread(thread.id, {
      messages: [...thread.messages, userMsg],
      runStatus: 'running',
      chatStreaming: true,
      activityLog: []
    });
    setPrompt('');
    setReferences([]);
    pushThreadActivity(thread.id, 'Thinking');
    const controller = new AbortController();
    chatAbortControllers.current.set(thread.id, controller);
    try {
      const response = await quietWorkbenchFetch(
        '/api/agent/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            endpoint: endpoint.trim(),
            sessionKey: sessionKey.trim(),
            model: model.trim(),
            threadId: thread.id,
            messages: history,
            references: activeReferences.length ? activeReferences : undefined,
            artifact: activeThread?.artifact ?? undefined,
            templateId: resolveActiveTemplate(thread.activeTemplate)?.id
          })
        },
        { signal: controller.signal }
      );
      const payload = (await response.json()) as { reply?: string };
      const reply = formatAssistantProse(
        (payload.reply ?? '').trim() ||
          'I could not produce a reply for that - try rephrasing.'
      );
      setError('');
      setThreads((prev) => {
        const next = prev.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    text: reply
                  }
                ],
                updatedAt: Date.now()
              }
            : item
        );
        persistThreads(next);
        return next;
      });
      setSessionLive(true);
      void account.refreshWallet();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        pushThreadActivity(thread.id, 'Stopped');
        updateThread(thread.id, {
          runStatus: 'cancelled',
          chatStreaming: false
        });
        return;
      }
      const message = friendlyRunError(err);
      setError(message);
      pushThreadActivity(thread.id, 'Could not complete');
      updateThread(thread.id, { runStatus: 'failed', chatStreaming: false });
      setThreads((previous) => {
        const next = previous.map((item) =>
          item.id === thread.id
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    text: message
                  }
                ],
                updatedAt: Date.now()
              }
            : item
        );
        persistThreads(next);
        return next;
      });
    } finally {
      chatAbortControllers.current.delete(thread.id);
      if (activeThreadIdRef.current === thread.id) {
        const current = threads.find((item) => item.id === thread.id);
        if (current?.chatStreaming || current?.runStatus === 'running') {
          updateThread(thread.id, {
            runStatus: undefined,
            chatStreaming: false
          });
        }
      }
      if (activeThreadIdRef.current === thread.id) {
        syncActiveThreadUI(
          threads.find((item) => item.id === thread.id) ?? null
        );
      }
    }
  }

  async function openUsageDashboard() {
    if (planBlocked) {
      openPlansPage();
      return;
    }
    setUsageOpen(true);
    setUsageError('');
    try {
      setUsage(await fetchWorkbenchUsage());
    } catch (usageLoadError) {
      setUsageError(
        usageLoadError instanceof Error
          ? usageLoadError.message
          : 'Could not load usage.'
      );
    }
  }

  async function exportArtifact(format: ArtifactExportFormat) {
    if (!artifact) return;
    setError('');
    setExporting(format);
    try {
      await downloadArtifact(artifact, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  }

  async function cancelCurrentRun() {
    const thread = activeThread;
    if (!thread || !isThreadWorking(thread)) return;

    const chatAbort = chatAbortControllers.current.get(thread.id);
    if (chatAbort) {
      chatAbort.abort();
      return;
    }

    runStreamAbortControllers.current.get(thread.id)?.abort();
    pushThreadActivity(thread.id, 'Stopping…');
    updateThread(thread.id, { runStatus: 'cancelling' });

    const runId = thread.runId;
    if (!runId) {
      endClientStream(thread.id);
      updateThread(thread.id, { runStatus: undefined });
      if (activeThreadIdRef.current === thread.id) syncActiveThreadUI(null);
      return;
    }

    try {
      const response = await workbenchFetch(
        `/api/v2/runs/${encodeURIComponent(runId)}/cancel`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(
          payload.details ||
            payload.error ||
            `Stop failed with HTTP ${response.status}.`
        );
      }
      updateThread(thread.id, { runStatus: 'cancelled', runId: undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop this run.');
    } finally {
      endClientStream(thread.id);
      if (activeThreadIdRef.current === thread.id) {
        syncActiveThreadUI(
          threads.find((item) => item.id === thread.id) ?? null
        );
      }
    }
  }

  async function stopThreadIfWorking(threadId: string) {
    if (threadId === activeThreadId && isGenerating) {
      await cancelCurrentRun();
      return;
    }
    const thread = threads.find((item) => item.id === threadId);
    if (!thread || !isThreadWorking(thread)) return;
    chatAbortControllers.current.get(threadId)?.abort();
    runStreamAbortControllers.current.get(threadId)?.abort();
    if (thread.runId) {
      try {
        await workbenchFetch(
          `/api/v2/runs/${encodeURIComponent(thread.runId)}/cancel`,
          { method: 'POST' }
        );
      } catch {
        // best-effort when editing or branching away from a background run
      }
    }
    updateThread(threadId, { runStatus: 'cancelled', runId: undefined });
    endClientStream(threadId);
  }

  async function copyMessageText(text: string) {
    try {
      await navigator.clipboard.writeText(stripSkillTags(text) || text);
    } catch {
      setError('Could not copy to clipboard.');
    }
  }

  async function editUserPrompt(messageId: string) {
    const thread = activeThread;
    if (!thread) return;
    const index = thread.messages.findIndex(
      (message) => message.id === messageId
    );
    if (index < 0 || thread.messages[index]?.role !== 'user') return;
    await stopThreadIfWorking(thread.id);
    const message = thread.messages[index]!;
    const trimmed = stripSkillTags(message.text) || message.text;
    setPrompt(trimmed);
    updateThread(thread.id, {
      messages: thread.messages.slice(0, index),
      runStatus: undefined,
      runId: undefined
    });
    textareaRef.current?.focus();
  }

  function branchFromMessage(messageId: string) {
    const thread = activeThread;
    if (!thread) return;
    const index = thread.messages.findIndex(
      (message) => message.id === messageId
    );
    if (index < 0) return;
    const id = crypto.randomUUID();
    const sourceMessages = thread.messages.slice(0, index + 1);
    const titleSeed =
      sourceMessages.findLast((message) => message.role === 'user')?.text ??
      sourceMessages.at(-1)?.text ??
      'Branched workspace';
    const fresh: WorkThread = {
      id,
      title: `${titleSeed.slice(0, 42).trim() || 'Branched workspace'}`,
      messages: sourceMessages.map((message) => ({
        ...message,
        id: crypto.randomUUID()
      })),
      artifact: thread.artifact,
      versions: [...thread.versions],
      activeVersion: thread.activeVersion,
      updatedAt: Date.now()
    };
    setThreads((prev) => {
      const next = [fresh, ...prev];
      persistThreads(next);
      return next;
    });
    switchThread(id);
  }

  async function sendRunInstruction(instruction: string) {
    const runId = activeThread?.runId;
    const threadId = activeThread?.id;
    const cleanInstruction = instruction.trim();
    if (!runId || !threadId || !cleanInstruction) return;
    if (cleanInstruction.length < 4) {
      throw new Error(
        'Write at least 4 characters to add a mid-run instruction.'
      );
    }
    await postRunInstruction(runId, cleanInstruction);
    rememberPendingInstruction(threadId, cleanInstruction);
    setPrompt('');
    setLiveStatus('Added your instruction to the active run');
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen && menuItems.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMenuIndex((i) => (i + 1) % menuItems.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMenuIndex((i) => (i - 1 + menuItems.length) % menuItems.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const choice = menuItems[menuIndex];
        if (choice) chooseSkill(choice);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (clarificationFlow) return;
      if (isGenerating && prompt.trim()) {
        void sendRunInstruction(prompt).catch((err) => {
          setError(
            err instanceof Error ? err.message : 'Could not add instruction.'
          );
        });
      } else if (prompt.trim() || references.length) {
        void submitPrompt();
      }
    }
  }

  const sortedThreads = useMemo(() => {
    const query = threadQuery.trim().toLowerCase();
    return [...threads]
      .filter((thread) => !query || thread.title.toLowerCase().includes(query))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [threadQuery, threads]);

  return (
    <div
      className={`workbench-shell ${artifact && artifactPanelOpen ? 'artifact-visible' : ''} ${sidebarOpen ? 'sidebar-open' : ''} ${templateGalleryOpen ? 'template-gallery-open' : ''}`}
    >
      <TemplateGallery
        open={templateGalleryOpen}
        onClose={() => setTemplateGalleryOpen(false)}
        onApplyTemplate={applyWorkbenchTemplate}
      />
      <RunProgressPanel
        open={workspacePanel === 'progress'}
        onClose={closeWorkspacePanel}
        title={activeThread?.title ?? 'Current task'}
        planTitle={planTitle || activeThread?.planTitle}
        planItems={
          planItems.length > 0 ? planItems : (activeThread?.planItems ?? [])
        }
        activityLog={activeActivityLog}
      />
      <AnimatePresence initial={false}>
        {sidebarOpen ? (
          <>
            <motion.button
              type="button"
              className="sidebar-scrim"
              aria-label="Close workspace history"
              onClick={() => setSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="workbench-sidebar"
              aria-label="Workspace history"
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -18, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="sidebar-brand-row">
                <div className="brand-lockup">
                  <DelegatorsMark className="brand-mark" />
                  <span>Delegators</span>
                </div>
                <button
                  type="button"
                  className="quiet-icon"
                  onClick={() => setSidebarOpen(false)}
                  title="Close sidebar"
                >
                  <PanelLeftClose size={18} aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                className="sidebar-primary"
                onClick={newThread}
              >
                <MessageSquarePlus size={16} aria-hidden="true" />
                New task
              </button>

              <div
                className="sidebar-nav-list"
                aria-label="Workspace navigation"
              >
                <button
                  type="button"
                  className={`sidebar-nav-item ${templateGalleryOpen ? 'active' : ''}`}
                  onClick={() => {
                    setTemplateGalleryOpen(true);
                  }}
                  title="Browse artifact templates"
                >
                  <LayoutTemplate size={16} aria-hidden="true" />
                  Templates
                </button>
                <button
                  type="button"
                  className={`sidebar-nav-item ${artifact && artifactPanelOpen ? 'active' : ''}`}
                  onClick={() => {
                    if (artifact) {
                      setArtifactPanelOpen(true);
                    } else {
                      textareaRef.current?.focus();
                    }
                  }}
                  title={
                    artifact
                      ? 'Open artifact panel'
                      : 'Create an artifact first'
                  }
                >
                  <Layers size={16} aria-hidden="true" />
                  Artifacts
                </button>
              </div>

              <label className="thread-search" htmlFor="thread-search">
                <Search size={15} aria-hidden="true" />
                <input
                  id="thread-search"
                  value={threadQuery}
                  onChange={(event) => setThreadQuery(event.target.value)}
                  placeholder="Search tasks"
                />
              </label>

              <div className="sidebar-section-label">Recent tasks</div>
              <nav className="thread-list" aria-label="Recent tasks">
                {!threadsReady ? (
                  <p className="thread-empty">Loading your workspaces…</p>
                ) : sortedThreads.length === 0 ? (
                  <p className="thread-empty">
                    {threadQuery ? 'No matching tasks' : 'No recent tasks'}
                  </p>
                ) : (
                  sortedThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className={`thread-item ${thread.id === activeThreadId ? 'active' : ''} ${isThreadWorking(thread) ? 'working' : ''}`}
                      onClick={() => switchThread(thread.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) =>
                        event.key === 'Enter' && switchThread(thread.id)
                      }
                    >
                      <span className="thread-leading" aria-hidden="true">
                        {isThreadWorking(thread) ? (
                          <span className="thread-working-dot" />
                        ) : (
                          <FolderOpen size={15} />
                        )}
                      </span>
                      <span className="thread-copy">
                        <span>{thread.title}</span>
                        <small>{timeAgo(thread.updatedAt)}</small>
                      </span>
                      <button
                        type="button"
                        className="thread-delete"
                        onClick={(event) => deleteThread(thread.id, event)}
                        title="Delete task"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </nav>

              <div className="sidebar-footer">
                {artifact ? (
                  <button
                    type="button"
                    onClick={() => setArtifactPanelOpen(true)}
                  >
                    <Layers size={16} aria-hidden="true" />
                    Current artifact
                  </button>
                ) : null}
                <button type="button" onClick={() => setSettingsOpen(true)}>
                  <Settings size={16} aria-hidden="true" />
                  Settings
                </button>
                {account.enabled ? (
                  <>
                    <button
                      type="button"
                      onClick={
                        account.needsCredits
                          ? account.openPlans
                          : () => void openUsageDashboard()
                      }
                    >
                      <BarChart3 size={16} aria-hidden="true" />
                      Usage dashboard
                    </button>
                    <div className="sidebar-account">
                      <UserButton />
                      <button
                        type="button"
                        onClick={
                          account.needsCredits
                            ? account.openPlans
                            : () => void openUsageDashboard()
                        }
                      >
                        <strong>
                          {account.needsCredits
                            ? 'Free workspace'
                            : formatWorkbenchPlan(account.planCode)}
                        </strong>
                        <small>
                          {account.needsCredits
                            ? 'Choose a plan to create'
                            : `${account.remainingPercent ?? 0}% credits left`}
                        </small>
                      </button>
                      {account.needsCredits ? (
                        <CreditCard size={15} aria-hidden="true" />
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className="chat-stage">
        <header className="topbar">
          <div className="topbar-title-area">
            <div className="topbar-sidebar-slot">
              <button
                type="button"
                className={`quiet-icon ${sidebarOpen ? 'invisible' : ''}`}
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                tabIndex={sidebarOpen ? -1 : 0}
                aria-hidden={sidebarOpen}
              >
                <PanelLeft size={19} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="task-title"
              onClick={() => setSidebarOpen(true)}
            >
              <span>{activeThread?.title ?? 'New AI task'}</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
          </div>
          <div className="topbar-actions">
            <span
              className={`connection-state ${hasConnection ? 'ready' : ''} ${planBlocked ? 'blocked' : ''}`}
            >
              <span />
              {planBlocked
                ? 'No active plan'
                : hasConnection
                  ? account.enabled && !account.needsCredits
                    ? formatWorkbenchPlan(account.planCode)
                    : manualPlan?.planCode
                      ? formatWorkbenchPlan(manualPlan.planCode)
                      : 'Workbench ready'
                  : 'Connection required'}
            </span>
            <button
              type="button"
              className={`quiet-icon ${templateGalleryOpen ? 'active' : ''}`}
              onClick={() => setTemplateGalleryOpen(true)}
              title="Browse templates"
            >
              <LayoutTemplate size={18} aria-hidden="true" />
            </button>
            {isGenerating ? (
              <button
                type="button"
                className={`quiet-icon topbar-badge-button ${workspacePanel === 'progress' ? 'active' : ''}`}
                onClick={() => openWorkspacePanel('progress')}
                title="Open run progress"
              >
                <GitBranch size={18} aria-hidden="true" />
                <span className="topbar-nav-badge active" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className={`quiet-icon topbar-badge-button ${workspacePanel === 'integrations' ? 'active' : ''}`}
              onClick={() => openWorkspacePanel('integrations')}
              title="Cloud integrations"
            >
              <Link2 size={18} aria-hidden="true" />
              {integrationsBadgeLabel ? (
                <span
                  className={`topbar-nav-badge ${connectedIntegrationCount > 0 ? 'connected' : 'idle'}`}
                >
                  {integrationsBadgeLabel}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`quiet-icon topbar-badge-button ${workspacePanel === 'knowledge' ? 'active' : ''}`}
              onClick={() => openWorkspacePanel('knowledge')}
              title="Personal knowledge"
            >
              <Brain size={18} aria-hidden="true" />
              {knowledgeBadgeLabel ? (
                <span
                  className={`topbar-nav-badge ${knowledgeItemCount && knowledgeItemCount > 0 ? 'connected' : 'idle'}`}
                >
                  {knowledgeBadgeLabel}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="quiet-icon"
              onClick={newThread}
              title="New task"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            {artifact ? (
              <button
                type="button"
                className={`quiet-icon ${artifactPanelOpen ? 'active' : ''}`}
                onClick={() => setArtifactPanelOpen((value) => !value)}
                title={artifactPanelOpen ? 'Close artifact' : 'Open artifact'}
              >
                <PanelRight size={18} aria-hidden="true" />
              </button>
            ) : null}
            <ThemeToggle
              theme={theme}
              onToggle={() =>
                setWorkbenchTheme(theme === 'dark' ? 'light' : 'dark')
              }
            />
            <button
              type="button"
              className="quiet-icon"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {planBlocked ? (
          <div className="no-plan-banner" role="alert">
            <AlertTriangle size={17} aria-hidden="true" />
            <div>
              <strong>No active Workbench plan</strong>
              <span>
                {account.enabled
                  ? 'Draft in the composer below — activate a plan when you are ready to generate.'
                  : 'Purchase a Workbench session on the client site, or paste a live sess_ key in Settings.'}
              </span>
            </div>
            <div className="no-plan-banner-actions">
              {account.enabled ? (
                <button
                  type="button"
                  onClick={() => void account.refreshWallet()}
                >
                  Refresh plan
                </button>
              ) : (
                <button type="button" onClick={() => setSettingsOpen(true)}>
                  Open settings
                </button>
              )}
              <button type="button" onClick={openPlansPage}>
                View plans
              </button>
            </div>
          </div>
        ) : null}

        <div
          ref={messagesWrapRef}
          className={`conversation ${messages.length ? 'active' : 'empty'}`}
          aria-live="polite"
        >
          <div className="conversation-inner">
            {messages.length === 0 && !isGenerating ? (
              <ChatWelcome
                onInsert={insertSkill}
                onOpenTemplates={() => {
                  setSidebarOpen(true);
                  setTemplateGalleryOpen(true);
                }}
              />
            ) : null}
            <div className="messages-thread">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onCopy={() => void copyMessageText(message.text)}
                    onEdit={
                      message.role === 'user'
                        ? () => void editUserPrompt(message.id)
                        : undefined
                    }
                    onBranch={() => branchFromMessage(message.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {isGenerating ? (
                <motion.section
                  className="thinking"
                  aria-label="Working"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="thinking-row">
                    <LoadingBreadcrumb
                      text={liveStatus || planTitle || 'Thinking'}
                    />
                    <button
                      type="button"
                      className="thinking-progress-link"
                      onClick={() => openWorkspacePanel('progress')}
                    >
                      View progress
                    </button>
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>
            <div ref={conversationEndRef} className="conversation-end" />
          </div>
        </div>

        <div className="composer-dock">
          <div className="composer-stack">
            <AnimatePresence>
              {clarificationFlow && !menuOpen ? (
                <ClarificationCard
                  flow={clarificationFlow}
                  onAnswer={setClarificationAnswer}
                  onOption={chooseClarificationOption}
                  onBack={() => moveClarification(-1)}
                  onNext={() => moveClarification(1)}
                  onSubmit={() => void submitClarificationAnswers()}
                />
              ) : null}
            </AnimatePresence>

            {error ? (
              <div className="alert" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  className="alert-dismiss"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {menuOpen && menuItems.length > 0 ? (
              <div
                className="command-menu"
                role="listbox"
                aria-label="Skill commands"
              >
                <div className="command-menu-head">
                  <span>Artifact skills</span>
                  <small>↑↓ navigate · enter select · esc close</small>
                </div>
                {menuItems.map((skill, index) => (
                  <button
                    key={skill.id}
                    type="button"
                    role="option"
                    aria-selected={index === menuIndex}
                    className={index === menuIndex ? 'active' : ''}
                    onMouseEnter={() => setMenuIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      chooseSkill(skill);
                    }}
                  >
                    <SkillToolIcon skill={skill} />
                    <span className="command-copy">
                      <strong>{skill.label}</strong>
                      <small>{skill.description}</small>
                    </span>
                    <span className="command-tag">{skill.tag}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div
              className={`composer-frame ${composerFocused ? 'focused' : ''} ${clarificationFlow ? 'locked' : ''} ${planBlocked ? 'plan-hint' : ''} ${referenceDragActive ? 'reference-dragging' : ''}`}
              onDragEnter={handleReferenceDragEnter}
              onDragOver={handleReferenceDragOver}
              onDragLeave={handleReferenceDragLeave}
              onDrop={(event) => void handleReferenceDrop(event)}
            >
              {composerFocused ? (
                <span className="composer-glow" aria-hidden="true" />
              ) : null}
              <div className="composer-surface">
                {activeTemplate ? (
                  <div
                    className="composer-context composer-template-context"
                    style={
                      {
                        '--tool-accent': toolMetaForSkill(
                          selectedSkill ??
                            findSkillById(activeTemplate.skillId) ??
                            skillCatalog[0]
                        ).accent
                      } as CSSProperties
                    }
                  >
                    <span className="composer-template-icon" aria-hidden="true">
                      <LayoutTemplate size={16} />
                    </span>
                    <span className="composer-context-copy">
                      <strong>{activeTemplate.name}</strong>
                      <small>
                        {activeTemplate.category}
                        {activeTemplate.designPreset
                          ? ` · ${activeTemplate.designPreset}`
                          : ''}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => clearActiveTemplate()}
                      aria-label={`Remove ${activeTemplate.name} template`}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : selectedSkill ? (
                  <div
                    className="composer-context"
                    style={
                      {
                        '--tool-accent': toolMetaForSkill(selectedSkill).accent
                      } as CSSProperties
                    }
                  >
                    <SkillToolIcon skill={selectedSkill} />
                    <span className="composer-context-copy">
                      <strong>{toolMetaForSkill(selectedSkill).name}</strong>
                      <small>{selectedSkill.label}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrompt(stripSkillTags(prompt))}
                      aria-label="Remove selected skill"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}

                {references.length ? (
                  <div
                    className="composer-attachment-tray"
                    data-image-count={
                      composerImageReferences.length || undefined
                    }
                    aria-label="Attached files and images"
                  >
                    {composerImageReferences.map((reference) => (
                      <div
                        key={reference.id}
                        className="composer-attachment-thumb"
                        style={
                          {
                            '--preview-size': `${composerPreviewHeight(composerImageReferences.length)}px`
                          } as CSSProperties
                        }
                      >
                        <img
                          src={referencePreviewUrl(reference)}
                          alt={
                            reference.name ??
                            `Image #${reference.imageIndex ?? ''}`
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeComposerReference(reference.id)}
                          aria-label={`Remove image ${reference.imageIndex ?? ''}`}
                        >
                          <X size={10} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {composerFileReferences.map((reference) => (
                      <span
                        key={reference.id}
                        className="composer-attachment-file"
                      >
                        <span aria-hidden="true">📁</span>
                        <span>{reference.name ?? 'file'}</span>
                        <button
                          type="button"
                          onClick={() => removeComposerReference(reference.id)}
                          aria-label={`Remove ${reference.name ?? 'file'}`}
                        >
                          <X size={10} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="composer-input-wrap">
                  <textarea
                    ref={textareaRef}
                    value={visiblePrompt}
                    onFocus={() => setComposerFocused(true)}
                    onChange={(event) =>
                      onComposerChange(
                        event.target.value,
                        event.target.selectionStart ?? event.target.value.length
                      )
                    }
                    onPaste={handleComposerPaste}
                    onKeyDown={handleComposerKeyDown}
                    onBlur={() => {
                      setComposerFocused(false);
                      window.setTimeout(() => setMenuOpen(false), 120);
                    }}
                    placeholder={
                      clarificationFlow
                        ? 'Answer the question above to continue...'
                        : isGenerating
                          ? 'Add an instruction while it works...'
                          : activeTemplate
                            ? `Tell me what to create, change, or ask about ${activeTemplate.name}…`
                            : artifact
                              ? 'Ask for a revision...'
                              : 'Ask Delegators to create an artifact...'
                    }
                    rows={references.length ? 1 : 2}
                    disabled={Boolean(clarificationFlow)}
                    aria-label={
                      clarificationFlow
                        ? 'Clarification answers are above'
                        : isGenerating
                          ? 'Add an instruction to the active run'
                          : 'Artifact request'
                    }
                  />

                  {referenceDragActive ? (
                    <div className="reference-drop-hint" aria-hidden="true">
                      <Paperclip size={16} />
                      <span>Drop reference files</span>
                    </div>
                  ) : null}

                  {voicePhase === 'listening' ||
                  voicePhase === 'transcribing' ? (
                    <VoiceRecordingStrip
                      levels={voiceLevels}
                      phase={
                        voicePhase === 'listening'
                          ? 'listening'
                          : 'transcribing'
                      }
                    />
                  ) : null}
                </div>

                <div className="composer-toolbar">
                  <div className="composer-options">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="reference-input"
                      accept=".txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={(event) =>
                        void attachReferenceFiles(event.target.files)
                      }
                      aria-label="Attach reference files"
                    />
                    <button
                      type="button"
                      className="tool-pill"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        Boolean(clarificationFlow) || voicePhase !== 'idle'
                      }
                      title="Attach reference files"
                    >
                      <Paperclip size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`tool-pill voice-pill ${voicePhase === 'listening' ? 'listening' : ''}`}
                      onClick={() => void toggleVoiceInput()}
                      disabled={
                        Boolean(clarificationFlow) ||
                        voicePhase === 'transcribing'
                      }
                      title={
                        voicePhase === 'listening'
                          ? 'Stop and transcribe'
                          : voicePhase === 'transcribing'
                            ? 'Transcribing…'
                            : 'Voice input'
                      }
                      aria-pressed={voicePhase === 'listening'}
                    >
                      {voicePhase === 'transcribing' ? (
                        <Loader2
                          size={13}
                          className="voice-spinner"
                          aria-hidden="true"
                        />
                      ) : (
                        <Mic size={13} aria-hidden="true" />
                      )}
                    </button>
                    {planBlocked ? (
                      <button type="button" className="model-pill" disabled>
                        <span>Plan required</span>
                      </button>
                    ) : composerAllowedModels.length > 0 ? (
                      <ComposerModelPicker
                        models={composerAllowedModels}
                        value={model}
                        onChange={(nextModel) => {
                          setModel(nextModel);
                          persistSettings(
                            endpoint,
                            nextModel,
                            sessionKey,
                            rememberForTab
                          );
                        }}
                        disabled={
                          Boolean(clarificationFlow) || voicePhase !== 'idle'
                        }
                      />
                    ) : (
                      <button
                        type="button"
                        className="model-pill"
                        onClick={() => setSettingsOpen(true)}
                        title="Model settings"
                      >
                        <span>{model || fallbackModel}</span>
                        <ChevronDown size={11} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="send-button"
                    onClick={() =>
                      isGenerating
                        ? void cancelCurrentRun()
                        : void submitPrompt()
                    }
                    disabled={
                      !isGenerating &&
                      !visiblePrompt.trim() &&
                      !references.length &&
                      !activeTemplate
                    }
                    title={isGenerating ? 'Stop run' : 'Send'}
                  >
                    {isGenerating ? (
                      <Square
                        size={14}
                        fill="currentColor"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowUp size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence initial={false}>
        {artifact && artifactPanelOpen ? (
          <motion.aside
            className="artifact-drawer"
            aria-label="Artifact preview"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="artifact-toolbar">
              <div className="artifact-title">
                <small>{artifact.kind}</small>
                <strong>{artifact.title}</strong>
              </div>
              <button
                type="button"
                className="quiet-icon"
                onClick={() => setArtifactPanelOpen(false)}
                title="Close artifact"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </header>

            <div className="artifact-controls">
              {versions.length > 1 ? (
                <div className="version-track" aria-label="Artifact versions">
                  {versions.map((version, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === activeVersion ? 'active' : ''}
                      onClick={() => viewVersion(index)}
                      title={`${artifactFormatLabel(version)} · ${version.title}`}
                    >
                      {artifactFormatLabel(version)}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="single-version">
                  {artifactFormatLabel(artifact)}
                </span>
              )}
              <div className="export-actions">
                {exportFormats.map((format) => (
                  <ExportButton
                    key={format}
                    format={format}
                    icon={exportIcon(format)}
                    exporting={exporting}
                    onExport={exportArtifact}
                    primary={format === primaryExport}
                  />
                ))}
              </div>
              <CloudSaveActions
                artifact={artifact}
                disabled={exporting !== null}
              />
            </div>

            <div
              className="artifact-tabs"
              role="tablist"
              aria-label="Artifact views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={artifactTab === 'preview'}
                className={artifactTab === 'preview' ? 'active' : ''}
                onClick={() => setArtifactTab('preview')}
              >
                Preview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={artifactTab === 'sources'}
                className={artifactTab === 'sources' ? 'active' : ''}
                onClick={() => setArtifactTab('sources')}
              >
                Sources
                <span>{artifact.citations.length}</span>
              </button>
            </div>

            <div className="artifact-scroll">
              {artifactTab === 'preview' ? (
                <ArtifactPreview
                  artifact={artifact}
                  variant="template-gallery"
                />
              ) : (
                <SourceList artifact={artifact} />
              )}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen ? (
          <motion.div
            className="settings-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Workbench settings"
            onClick={(event) =>
              event.target === event.currentTarget && setSettingsOpen(false)
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="settings-panel"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
            >
              <div className="settings-head">
                <div>
                  <small>Workbench settings</small>
                  <h2>
                    {account.enabled ? 'Account and model' : 'Endpoint and key'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="quiet-icon"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close settings"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              {account.enabled ? (
                <>
                  <WorkbenchAccountProfile />
                  <div className="account-settings-summary">
                    <div>
                      <span>Plan</span>
                      <strong>
                        {account.needsCredits
                          ? 'No active plan'
                          : formatWorkbenchPlan(account.planCode)}
                      </strong>
                    </div>
                    <div>
                      <span>Credits</span>
                      <strong>
                        {account.needsCredits
                          ? 'Required to create'
                          : `${account.remainingPercent ?? 0}% remaining`}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={
                        account.needsCredits
                          ? account.openPlans
                          : () => void openUsageDashboard()
                      }
                    >
                      {account.needsCredits
                        ? 'View Workbench plans'
                        : 'Open usage dashboard'}
                    </button>
                  </div>
                </>
              ) : null}
              {!account.enabled ? (
                <>
                  <label htmlFor="endpoint">
                    Endpoint
                    <input
                      id="endpoint"
                      value={endpoint}
                      onChange={(event) => {
                        setEndpoint(event.target.value);
                        persistSettings(
                          event.target.value,
                          model,
                          sessionKey,
                          rememberForTab
                        );
                      }}
                      placeholder={
                        config?.delegatorsBaseURL ?? fallbackEndpoint
                      }
                      autoComplete="url"
                      spellCheck={false}
                    />
                  </label>
                  <label htmlFor="sess-key">
                    API key
                    <input
                      id="sess-key"
                      value={sessionKey}
                      onChange={(event) => {
                        setSessionKey(event.target.value);
                        persistSettings(
                          endpoint,
                          model,
                          event.target.value,
                          rememberForTab
                        );
                      }}
                      placeholder="sess_xxxxxxxxxxxxxxxx"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                </>
              ) : null}
              {account.enabled ? (
                <div className="settings-model-field">
                  <span>Model</span>
                  <ModelPicker
                    value={model}
                    models={account.allowedModels}
                    variant="settings"
                    onChange={(nextModel) => {
                      setModel(nextModel);
                      persistSettings(
                        endpoint,
                        nextModel,
                        sessionKey,
                        rememberForTab
                      );
                    }}
                  />
                </div>
              ) : (
                <label htmlFor="model-alias">
                  Model
                  <input
                    id="model-alias"
                    value={model}
                    onChange={(event) => {
                      setModel(event.target.value);
                      persistSettings(
                        endpoint,
                        event.target.value,
                        sessionKey,
                        rememberForTab
                      );
                    }}
                    placeholder={config?.defaultModel ?? fallbackModel}
                    spellCheck={false}
                  />
                </label>
              )}
              {!account.enabled ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={rememberForTab}
                    onChange={(event) => {
                      setRememberForTab(event.target.checked);
                      persistSettings(
                        endpoint,
                        model,
                        sessionKey,
                        event.target.checked
                      );
                    }}
                  />
                  Keep session key for this tab only
                </label>
              ) : null}
              <div className="theme-field">
                <span>Appearance</span>
                <div
                  className="theme-toggle"
                  role="group"
                  aria-label="Workbench theme"
                >
                  <button
                    type="button"
                    className={theme === 'dark' ? 'active' : ''}
                    onClick={() => setWorkbenchTheme('dark')}
                  >
                    <Moon size={14} aria-hidden="true" />
                    Dark
                  </button>
                  <button
                    type="button"
                    className={theme === 'light' ? 'active' : ''}
                    onClick={() => setWorkbenchTheme('light')}
                  >
                    <Sun size={14} aria-hidden="true" />
                    Light
                  </button>
                </div>
              </div>
              <p className="settings-note">
                {account.enabled
                  ? 'Your account supplies the Workbench credential automatically. The research key remains optional.'
                  : 'Keys remain in memory unless tab storage is enabled. The research key is optional and used only for better live source retrieval.'}
              </p>
              <button
                type="button"
                className="settings-save"
                onClick={() => setSettingsOpen(false)}
              >
                Save settings
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {workspacePanel === 'integrations' || workspacePanel === 'knowledge' ? (
          <motion.div
            className="settings-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={
              workspacePanel === 'integrations'
                ? 'Cloud integrations'
                : 'Personal knowledge'
            }
            onClick={(event) =>
              event.target === event.currentTarget && closeWorkspacePanel()
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="settings-panel workspace-feature-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <button
                type="button"
                className="quiet-icon workspace-feature-close"
                onClick={closeWorkspacePanel}
                title="Close"
                aria-label="Close panel"
              >
                <X size={16} aria-hidden="true" />
              </button>
              {workspacePanel === 'integrations' ? (
                <IntegrationsPanel accountEnabled={account.enabled} />
              ) : (
                <PersonalKnowledgePanel accountEnabled={account.enabled} />
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {usageOpen ? (
          <motion.div
            className="settings-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Workbench usage dashboard"
            onClick={(event) =>
              event.target === event.currentTarget && setUsageOpen(false)
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="settings-panel usage-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <div className="settings-head">
                <div>
                  <small>Workbench account</small>
                  <h2>Usage dashboard</h2>
                </div>
                <button
                  type="button"
                  className="quiet-icon"
                  onClick={() => setUsageOpen(false)}
                  aria-label="Close usage"
                >
                  <X size={18} />
                </button>
              </div>
              {usageError ? <p className="usage-error">{usageError}</p> : null}
              {!usage && !usageError ? (
                <p className="usage-loading">Loading plan usage…</p>
              ) : null}
              {usage ? (
                <UsageDashboard usage={usage} onTopUp={account.openPlans} />
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function formatWorkbenchPlan(code?: string): string {
  const labels: Record<string, string> = {
    dlg_lite: 'Pro Pass',
    dlg_pro: 'Retired ₹99 Pro',
    dlg_pro_t: 'Retired ₹119 Pro Thinking',
    dlg_ultra: 'UltraSpeed Beta',
    wb_29: 'Workbench Mini',
    wb_49: 'Workbench Starter',
    wb_99: 'Workbench Plus',
    wb_199: 'Workbench Pro'
  };
  return code ? labels[code] || code : 'Delegators pass';
}

function WorkbenchAccountProfile() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return (
    <div className="account-profile">
      <UserButton />
      <div>
        <strong>
          {user?.fullName || user?.firstName || 'Delegators account'}
        </strong>
        <span>{email || 'Signed in'}</span>
      </div>
    </div>
  );
}

function UsageDashboard({
  usage,
  onTopUp
}: {
  usage: WorkbenchUsage;
  onTopUp: () => void;
}) {
  const credit = workbenchCreditUsage(usage.status);
  const percentLabel =
    credit.percentUsed > 0 && credit.percentUsed < 0.01
      ? '<0.01%'
      : `${credit.percentUsed.toFixed(credit.percentUsed < 1 ? 2 : 1)}%`;
  const recent = usage.events.slice(0, 8);
  return (
    <div className="usage-dashboard">
      <div className="usage-metrics">
        <div>
          <span>Plan</span>
          <strong>{formatWorkbenchPlan(usage.status.plan)}</strong>
        </div>
        <div>
          <span>Credits used</span>
          <strong>{percentLabel}</strong>
        </div>
        <div>
          <span>Metered spend</span>
          <strong>
            {formatMicroPaise(credit.usedMicroPaise)} /{' '}
            {formatMicroPaise(credit.limitMicroPaise)}
          </strong>
        </div>
      </div>
      <div className="usage-progress">
        <span
          style={{
            width: `${credit.percentUsed > 0 ? Math.max(0.5, credit.percentUsed) : 0}%`
          }}
        />
      </div>
      <div className="usage-events">
        <div className="usage-events-head">
          <span>Recent activity</span>
          <span>{usage.events.length} events</span>
        </div>
        {recent.length ? (
          recent.map((event) => (
            <div
              className="usage-event"
              key={`${event.timestamp}-${event.model}-${event.latency_ms}`}
            >
              <div>
                <strong>{event.model}</strong>
                <small>{new Date(event.timestamp).toLocaleString()}</small>
              </div>
              <span>
                {formatMicroPaise(event.cost_micro_paise)} ·{' '}
                {event.completion_tokens.toLocaleString()} output
              </span>
            </div>
          ))
        ) : (
          <p className="usage-empty">
            No usage yet. Your first artifact run will appear here.
          </p>
        )}
      </div>
      <button type="button" className="settings-save" onClick={onTopUp}>
        Add more credits
      </button>
    </div>
  );
}

function formatMicroPaise(value: number): string {
  const rupees = Math.max(0, value) / 100_000_000;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees > 0 && rupees < 0.01 ? 4 : 2,
    maximumFractionDigits: rupees > 0 && rupees < 0.01 ? 4 : 2
  })}`;
}

function ChatWelcome({
  onInsert,
  onOpenTemplates
}: {
  onInsert: (skill: SkillDefinition) => void;
  onOpenTemplates: () => void;
}) {
  const featured = skillCatalog.filter((skill) =>
    ['ppt', 'pdf', 'word', 'resume', 'xlsx'].includes(skill.id)
  );
  return (
    <motion.section
      className="chat-welcome"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <h1>What should we make?</h1>
      <div className="welcome-actions">
        <button
          type="button"
          className="welcome-template-button"
          onClick={onOpenTemplates}
        >
          <LayoutTemplate size={17} aria-hidden="true" />
          <span>Browse templates</span>
        </button>
        {featured.map((skill) => (
          <button key={skill.id} type="button" onClick={() => onInsert(skill)}>
            <SkillToolIcon skill={skill} />
            <span>{skill.label}</span>
          </button>
        ))}
      </div>
    </motion.section>
  );
}

function SkillToolIcon({ skill }: { skill: SkillDefinition }) {
  const tool = toolMetaForSkill(skill);
  return (
    <span className="skill-tool-icon" aria-hidden="true">
      <img src={tool.icon} alt="" />
    </span>
  );
}

function DelegatorsMark({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src="/delegators-mark.png"
      alt=""
      aria-hidden="true"
    />
  );
}

function MessageToolbar({
  onCopy,
  onEdit,
  onBranch,
  className
}: {
  onCopy?: () => void;
  onEdit?: () => void;
  onBranch?: () => void;
  className: string;
}) {
  if (!onCopy && !onEdit && !onBranch) return null;
  return (
    <div className={className} aria-label="Message actions">
      {onCopy ? (
        <button
          type="button"
          className="message-action"
          onClick={onCopy}
          title="Copy message"
        >
          <Copy size={12} aria-hidden="true" />
        </button>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          className="message-action"
          onClick={onEdit}
          title="Edit and resend"
        >
          <Pencil size={12} aria-hidden="true" />
        </button>
      ) : null}
      {onBranch ? (
        <button
          type="button"
          className="message-action"
          onClick={onBranch}
          title="Branch in new chat"
        >
          <GitBranch size={12} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function MessageBubble({
  message,
  onCopy,
  onEdit,
  onBranch
}: {
  message: ChatMessage;
  onCopy?: () => void;
  onEdit?: () => void;
  onBranch?: () => void;
}) {
  if (message.role === 'user') {
    const bubbleText = stripSkillTags(message.text) || message.text;

    return (
      <motion.div
        className="message-user"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
      >
        <div className="message-user-bubble">
          {message.skill ? (
            <span className="message-tag">
              <SkillToolIcon skill={message.skill} />
              <span>{toolMetaForSkill(message.skill).name}</span>
            </span>
          ) : null}
          {bubbleText ? <ChatMarkdown text={bubbleText} /> : null}
        </div>
        <MessageToolbar
          onCopy={onCopy}
          onEdit={onEdit}
          onBranch={onBranch}
          className="message-user-toolbar"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`message-assistant ${message.isSearch ? 'search-note' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
    >
      <span className="assistant-mark" aria-hidden="true">
        {message.isSearch ? <Search size={16} /> : '›'}
      </span>
      <div className="message-assistant-content">
        <div className="message-assistant-body">
          <ChatMarkdown text={message.text} variant="assistant" />
          {message.artifact ? <small>{message.artifact.title}</small> : null}
        </div>
        <MessageToolbar
          onCopy={onCopy}
          onEdit={onEdit}
          onBranch={onBranch}
          className="message-assistant-toolbar"
        />
      </div>
    </motion.div>
  );
}

function ExportButton({
  format,
  icon,
  exporting,
  onExport,
  primary = false
}: {
  format: ArtifactExportFormat;
  icon: ReactNode;
  exporting: ArtifactExportFormat | null;
  onExport: (format: ArtifactExportFormat) => Promise<void>;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={primary ? 'primary-export' : ''}
      onClick={() => void onExport(format)}
      disabled={exporting !== null}
      title={`Export ${format.toUpperCase()}`}
    >
      {exporting === format ? (
        <Loader2 className="spin" aria-hidden="true" />
      ) : (
        icon
      )}
      <span>
        {format.toUpperCase()}
        {primary ? ' primary' : ''}
      </span>
    </button>
  );
}

function exportIcon(format: ArtifactExportFormat): ReactNode {
  if (format === 'pptx') return <Presentation />;
  if (format === 'docx') return <FileText />;
  if (format === 'xlsx') return <FileSpreadsheet />;
  if (format === 'zip') return <FileArchive />;
  return <Download />;
}

function SourceList({ artifact }: { artifact: ArtifactDocument }) {
  return (
    <section className="source-list">
      {artifact.citations.length ? (
        artifact.citations.map((citation, index) => (
          <article key={`${citation.label}-${citation.url ?? index}`}>
            <small>{String(index + 1).padStart(2, '0')}</small>
            <div>
              <strong>{citation.label}</strong>
              {citation.url ? (
                <a href={citation.url} target="_blank" rel="noreferrer">
                  {sourceHostname(citation.url)}
                </a>
              ) : (
                <span>Source URL unavailable</span>
              )}
            </div>
          </article>
        ))
      ) : (
        <div className="source-empty">
          <Search size={18} aria-hidden="true" />
          <p>This artifact did not use external sources.</p>
        </div>
      )}
    </section>
  );
}

function ClarificationCard({
  flow,
  onAnswer,
  onOption,
  onBack,
  onNext,
  onSubmit
}: {
  flow: ClarificationFlow;
  onAnswer: (answer: string) => void;
  onOption: (answer: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const current = flow.questions[flow.index];
  if (!current) return null;
  const answer = flow.answers[current.id] ?? '';
  const isLast = flow.index === flow.questions.length - 1;
  return (
    <motion.section
      className="clarification-card"
      aria-label="Clarification question"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <div className="clarification-head">
        <span>Before I continue</span>
        <small>
          {flow.index + 1} / {flow.questions.length}
        </small>
      </div>
      <p>{current.question}</p>
      {current.options.length ? (
        <div
          className="clarification-options"
          role="group"
          aria-label="Suggested answers"
        >
          {current.options.map((option) => (
            <button
              key={option}
              type="button"
              className={answer === option ? 'active' : ''}
              onClick={() => onOption(option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      {current.allowCustom ? (
        <textarea
          value={answer && !current.options.includes(answer) ? answer : ''}
          onChange={(event) => onAnswer(event.target.value)}
          placeholder="Or type a specific answer..."
          rows={2}
          aria-label="Custom clarification answer"
        />
      ) : null}
      <div className="clarification-actions">
        <button
          type="button"
          onClick={onBack}
          disabled={flow.index === 0 || flow.sending}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() =>
            onOption(
              'No strong preference; choose what best serves the artifact.'
            )
          }
          disabled={flow.sending}
        >
          No preference
        </button>
        {isLast ? (
          <button
            type="button"
            className="primary"
            onClick={onSubmit}
            disabled={flow.sending}
          >
            {flow.sending ? 'Sending...' : 'Send answers'}
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={onNext}
            disabled={flow.sending}
          >
            Next <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </motion.section>
  );
}

function sourceHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

type WorkbenchRunHandlers = {
  onRun?: (runId: string) => void | Promise<void>;
  onRunStatus?: (status: WorkbenchRunStatus) => void;
  onStatus?: (message: string) => void;
  onPlan?: (title: string, items: WorkbenchProgressItem[]) => void;
  onChecklist?: (items: WorkbenchProgressItem[]) => void;
  onMessage?: (text: string) => void;
  onQuestion?: (question: WorkbenchQuestion) => void;
};

async function postArtifactRun(
  body: unknown,
  handlers: WorkbenchRunHandlers,
  options?: { signal?: AbortSignal }
): Promise<{ artifact: ArtifactDocument; runId: string }> {
  const response = await quietWorkbenchFetch(
    '/api/v2/runs',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal
    },
    { signal: options?.signal }
  );

  const payload = (await response.json()) as { run?: unknown };
  const run = WorkbenchRunSchema.parse(payload.run);
  await handlers.onRun?.(run.id);
  handlers.onRunStatus?.(run.status);
  return streamWorkbenchRun(run.id, handlers, options);
}

async function streamWorkbenchRun(
  runId: string,
  handlers: WorkbenchRunHandlers,
  options?: { signal?: AbortSignal }
): Promise<{ artifact: ArtifactDocument; runId: string }> {
  let cursor = '';
  let artifact: ArtifactDocument | null = null;
  let attempts = 0;
  let lastError: unknown = null;

  while (!artifact && attempts < 60) {
    if (options?.signal?.aborted) {
      throw new RunTerminalError('Artifact run cancelled.');
    }
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const response = await workbenchFetch(
        `/api/v2/runs/${encodeURIComponent(runId)}/events${query}`,
        {
          headers: cursor ? { 'Last-Event-ID': cursor } : undefined,
          signal: options?.signal
        }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(
          payload.details ||
            payload.error ||
            `Event stream failed with HTTP ${response.status}.`
        );
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new Error(
          'Workbench server did not return a readable event stream.'
        );
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const lines = block.split('\n');
          const idLine = lines.find((line) => line.startsWith('id:'));
          const dataLine = lines.find((line) => line.startsWith('data:'));
          if (idLine) cursor = idLine.slice(3).trim();
          if (!dataLine) continue;
          const parsed = WorkbenchRunEventSchema.safeParse(
            JSON.parse(dataLine.slice(5).trim())
          );
          if (!parsed.success) continue;
          const event = parsed.data.event;
          if (event.type === 'status') handlers.onStatus?.(event.message);
          if (event.type === 'plan')
            handlers.onPlan?.(event.title, event.items);
          if (event.type === 'checklist') handlers.onChecklist?.(event.items);
          if (event.type === 'message') handlers.onMessage?.(event.text);
          if (event.type === 'question')
            handlers.onQuestion?.({
              question: event.question,
              questions: event.questions
            });
          if (event.type === 'error') {
            handlers.onRunStatus?.('failed');
            throw new RunTerminalError(event.message);
          }
          if (event.type === 'artifact') artifact = event.artifact;
        }
        if (done) break;
      }

      if (artifact) break;
      const snapshotResponse = await workbenchFetch(
        `/api/v2/runs/${encodeURIComponent(runId)}`
      );
      if (!snapshotResponse.ok) {
        throw new Error(
          `Run snapshot failed with HTTP ${snapshotResponse.status}.`
        );
      }
      const snapshotPayload = (await snapshotResponse
        .json()
        .catch(() => ({}))) as { run?: unknown };
      const snapshot = WorkbenchRunSchema.safeParse(snapshotPayload.run);
      if (snapshot.success) {
        handlers.onRunStatus?.(snapshot.data.status);
        if (snapshot.data.artifact) artifact = snapshot.data.artifact;
        if (snapshot.data.status === 'cancelled')
          throw new RunTerminalError('Artifact run cancelled.');
        if (snapshot.data.status === 'failed')
          throw new RunTerminalError(
            snapshot.data.error || 'Workbench run failed.'
          );
        if (snapshot.data.status === 'interrupted')
          throw new RunInterruptedError(runId);
      }
      if (!artifact) {
        attempts += 1;
        if (attempts < 60) {
          handlers.onStatus?.('Reconnecting to your artifact task');
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(1500, 300 * attempts))
          );
        }
      }
    } catch (error) {
      if (
        error instanceof RunInterruptedError ||
        error instanceof RunTerminalError
      )
        throw error;
      lastError = error;
      attempts += 1;
      if (attempts >= 60) break;
      handlers.onStatus?.('Reconnecting to your artifact task');
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1500, 300 * attempts))
      );
    }
  }

  if (!artifact) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Workbench server did not return a final artifact.');
  }
  handlers.onRunStatus?.('completed');
  return { artifact, runId };
}

async function postRunInstruction(
  runId: string,
  instruction: string
): Promise<void> {
  const response = await workbenchFetch(
    `/api/v2/runs/${encodeURIComponent(runId)}/instructions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction })
    }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(
      payload.details ||
        payload.error ||
        `Instruction failed with HTTP ${response.status}.`
    );
  }
}

function hasDraggedFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      resolve(
        value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
      );
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function withoutRunCredentials(
  request: CreateWorkbenchRunRequest
): PendingRunRequest {
  const { sessionKey: _sessionKey, ...pending } = request;
  return pending as PendingRunRequest;
}

class RunInterruptedError extends Error {
  constructor(readonly runId: string) {
    super('Artifact task was interrupted.');
  }
}

class RunTerminalError extends Error {}

class RunRecoveryCredentialsError extends Error {}

function completionMessage(artifact: ArtifactDocument): string {
  const primaryFormat =
    artifact.primaryFormat ??
    (artifact.kind === 'deck'
      ? 'pptx'
      : artifact.kind === 'sheet'
        ? 'xlsx'
        : artifact.kind === 'report'
          ? 'pdf'
          : 'docx');
  if (primaryFormat === 'pptx') {
    const count = artifact.slides?.length ?? artifact.sections.length;
    return `Done. I created a ${count}-slide presentation and prepared the PowerPoint export.`;
  }
  if (primaryFormat === 'xlsx') {
    const count = artifact.sheet?.sheets.length ?? 1;
    return `Done. I created ${count === 1 ? 'the workbook' : `${count} workbook sheets`} and prepared the Excel export.`;
  }
  if (primaryFormat === 'pdf') {
    const sourceText = artifact.citations.length
      ? ` using ${artifact.citations.length} cited source${artifact.citations.length === 1 ? '' : 's'}`
      : '';
    return `Done. I created the report${sourceText} and prepared the PDF export.`;
  }
  if (primaryFormat === 'docx') {
    return `Done. I created “${artifact.title}” and prepared the editable Word export.`;
  }
  return `Done. I created “${artifact.title}” and prepared the downloadable files.`;
}

function isValidWorkbenchSessionKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed.length >= 16 &&
    (trimmed.startsWith('sess_') ||
      trimmed.startsWith('wb_') ||
      trimmed.startsWith('sk-'))
  );
}
