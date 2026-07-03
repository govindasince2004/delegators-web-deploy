// Canonical public plan catalog for the landing/pricing pages.
//
// IMPORTANT: this pricing was decided after long deliberation. The backend
// (internal/sessions/plans.go) is the source of truth for the actual charged
// amount in paise; this catalog is the marketing surface that must stay in
// lockstep with it. plans.test.ts pins every code/price so a typo in either the
// code or the displayed price fails CI instead of charging the wrong amount.
//
// THE PRODUCT — two launch passes. Pro is the public ₹49 self-serve pass;
// UltraSpeed is an invite-only beta while the ultra-speed MiMo account pool is
// small. A pass is a single time-boxed window (250 minutes) with a fixed ₹
// budget. SWE clients and Workbench studio exports work from the same session.
// It is NOT a credit wallet — it is access, rationed by a budget, until the
// window or budget is spent.
//
// Unlike the legacy SWE plans, the rupee price is NOT encoded in the plan code
// (the codes are dlg_lite / dlg_ultra), so each plan
// carries its price explicitly and `priceFromCode` is no longer the price source.

export interface PublicPlan {
    /** Backend plan code (e.g. "dlg_lite"). */
    code: string;
    /** Display name, must match internal/sessions/plans.go. */
    name: string;
    /** Display price in rupees (e.g. "₹99"). */
    price: string;
    /** Numeric rupee price — the source of truth for the price-pin test. */
    priceInr: number;
    /** Whether this pass includes extended thinking. */
    thinking: boolean;
    /** The model aliases this pass unlocks at the gateway. */
    models: string[];
    /** Short marketing copy. */
    copy: string;
    /** Optional ribbon label. */
    tag?: string;
    /**
     * When true the pass is PRIVATE BETA — invite-only, not publicly purchasable.
     * Ultra (ultraspeed) is here because the ultra-speed model is enabled on only one
     * MiMo account and cannot scale horizontally, so it ships as a gated beta until we
     * have more ultra-capable accounts. The card renders a "Request access" CTA instead
     * of checkout, and the backend rejects a direct purchase (see IsBetaPlan in plans.go).
     */
    beta?: boolean;
}

// One public pass plus one invite-only beta — both cover SWE clients and Workbench studio files.
export const PASS_TAGLINE =
    'One ₹49 Pro pass for SWE agents, web search, image analysis, and Workbench studio files. UltraSpeed is invite-only beta.';

/** Plan codes that unlock Workbench downloadable artifacts. Mirrors internal/sessions/plans.go WorkbenchEligiblePlans(). */
export const WORKBENCH_STUDIO_PLAN_CODES = ['dlg_lite', 'dlg_ultra'] as const;

export function workbenchStudioEligible(code: string): boolean {
    return (WORKBENCH_STUDIO_PLAN_CODES as readonly string[]).includes(code);
}

/** Pricing-card bullets aligned with gateway tier gates (chat vs studio files). */
export function passCardFeatureBullets(plan: PublicPlan): string[] {
    if (plan.beta) {
        return [
            'Ultra-speed lane (~600 tok/s) + Pro features',
            'One 250-minute pass — SWE clients + Workbench studio files',
            'Invite only while we scale ultra-speed capacity',
        ];
    }
    return [
        'One 250-minute pass, fixed ₹ budget',
        'SWE agents, multi-file edits, web search, and image analysis',
        'Workbench studio files (@ppt, @xls, @pdf) — decks, sheets, exports',
        `Models: ${plan.models.join(', ')}`,
    ];
}

// Where the "Request beta access" CTA points. Swap for your real beta intake
// (form, Tally, or support inbox) — kept in one place so it never drifts.
export const BETA_REQUEST_URL = 'mailto:beta@delegators.dev?subject=Ultra%20pass%20%E2%80%94%20beta%20access%20request';

/** Delegators Flow — voice dictation desktop pass (dlg_flow). */
export interface FlowPlan {
    code: string;
    name: string;
    price: string;
    priceInr: number;
    durationMin: number;
    copy: string;
    features: string[];
    inviteOnly?: boolean;
}

export const FLOW_PLANS: FlowPlan[] = [
    {
        code: 'dlg_flow',
        name: 'Flow Free',
        price: 'Free',
        priceInr: 0,
        durationMin: 150,
        copy: 'Hindi, Hinglish, and English dictation through the MiMo beta pipeline.',
        features: [
            'MiMo V2.5 ASR with coding-prompt polish',
            'Mandatory review for Hindi and Hinglish',
            'Deterministic @file tagging and XML/JSON/HTML output',
        ],
    },
    {
        code: 'dlg_flow_pro',
        name: 'Flow Pro+',
        price: 'Invite beta',
        priceInr: 0,
        durationMin: 150,
        copy: 'Smarter multimodal recognition for higher Hindi and Hinglish accuracy.',
        features: [
            'Multimodal understand-first recognition on every language',
            'Direct Hindi-to-English intent before coding polish',
            'Private beta with measured quality and cost telemetry',
        ],
        inviteOnly: true,
    },
];

export const FLOW_PLAN = FLOW_PLANS[0];

export const PUBLIC_PLANS: PublicPlan[] = [
    {
        code: 'dlg_lite',
        name: 'Pro',
        price: '₹49',
        priceInr: 49,
        thinking: true,
        models: ['dlg-pro', 'dlg-light'],
        copy: 'Default Pro thinking for SWE agents and Workbench files in one fixed-budget pass.',
        tag: 'Popular',
    },
    {
        code: 'dlg_ultra',
        name: 'UltraSpeed Beta',
        price: '₹199',
        priceInr: 199,
        thinking: true,
        models: ['dlg-pro', 'dlg-light', 'swe-ultra-thinking', 'swe-ultra'],
        copy: 'The ultra-speed lane for testers while the premium key pool scales.',
        tag: 'Beta',
        beta: true,
    },
];

/** The rupee price a plan code implies. Legacy convention only (suffix). */
export function priceFromCode(code: string): number {
    const suffix = code.split('_').pop() ?? '';
    return Number.parseInt(suffix, 10);
}

/** True when a plan code is one of the unified `dlg_*` passes. */
export function isUnifiedPass(code: string): boolean {
    return code.startsWith('dlg_');
}
