import type { ArtifactDocument, Slide } from '../shared.js';

export type XboardVertical = {
  id: string;
  product: string;
  category: string;
  thesis: string;
  marketSize: string;
  askAmount: string;
  tractionCount: string;
  tractionGrowth: string;
};

export const xboardVerticals: XboardVertical[] = [
  {
    id: 'hr',
    product: 'Xboard',
    category: 'HR platform',
    thesis: 'Empowering HR with seamless employee management',
    marketSize: '$30 Billion',
    askAmount: '$2B',
    tractionCount: '9,500+ companies',
    tractionGrowth: '+38%'
  },
  {
    id: 'fintech',
    product: 'Ledgerlane',
    category: 'Fintech ops',
    thesis: 'Modern treasury workflows for finance teams',
    marketSize: '$48 Billion',
    askAmount: '$1.8B',
    tractionCount: '2,400+ finance teams',
    tractionGrowth: '+44%'
  },
  {
    id: 'edtech',
    product: 'Campusflow',
    category: 'EdTech platform',
    thesis: 'Campus operations with one connected student record',
    marketSize: '$22 Billion',
    askAmount: '$900M',
    tractionCount: '180+ institutions',
    tractionGrowth: '+31%'
  },
  {
    id: 'health',
    product: 'Caregrid',
    category: 'HealthTech',
    thesis: 'Clinical staffing and patient flow in one command center',
    marketSize: '$36 Billion',
    askAmount: '$1.2B',
    tractionCount: '640+ clinics',
    tractionGrowth: '+29%'
  },
  {
    id: 'logistics',
    product: 'Routewise',
    category: 'Logistics SaaS',
    thesis: 'Fleet visibility with dispatch automation built in',
    marketSize: '$41 Billion',
    askAmount: '$1.5B',
    tractionCount: '1,100+ fleets',
    tractionGrowth: '+35%'
  },
  {
    id: 'commerce',
    product: 'Shelfstack',
    category: 'Retail ops',
    thesis: 'Inventory, staffing, and store analytics in one surface',
    marketSize: '$27 Billion',
    askAmount: '$750M',
    tractionCount: '3,200+ stores',
    tractionGrowth: '+26%'
  },
  {
    id: 'climate',
    product: 'Gridpulse',
    category: 'Climate tech',
    thesis: 'Energy usage intelligence for commercial portfolios',
    marketSize: '$19 Billion',
    askAmount: '$600M',
    tractionCount: '420+ buildings',
    tractionGrowth: '+41%'
  },
  {
    id: 'ai',
    product: 'Promptline',
    category: 'AI workflow',
    thesis: 'Agent orchestration with audit-ready enterprise controls',
    marketSize: '$52 Billion',
    askAmount: '$2.4B',
    tractionCount: '7,800+ workspaces',
    tractionGrowth: '+52%'
  },
  {
    id: 'devtools',
    product: 'Shipyard',
    category: 'Developer platform',
    thesis: 'Release intelligence for platform engineering teams',
    marketSize: '$33 Billion',
    askAmount: '$1.1B',
    tractionCount: '5,100+ engineering teams',
    tractionGrowth: '+47%'
  },
  {
    id: 'proptech',
    product: 'Leaseflow',
    category: 'PropTech',
    thesis: 'Leasing operations with tenant experience automation',
    marketSize: '$24 Billion',
    askAmount: '$850M',
    tractionCount: '960+ properties',
    tractionGrowth: '+33%'
  }
];

export function buildXboardLimeDeck(vertical: XboardVertical): ArtifactDocument {
  const slides: Slide[] = [
    {
      title: 'Agenda',
      role: 'opener',
      layout: 'list',
      theme: 'light',
      tone: 'lime',
      eyebrow: `${vertical.product} · Investor deck`,
      bullets: [
        '01 · Introduction and team',
        '02 · Inefficiencies in legacy workflows',
        '03 · Streamlining operations end-to-end',
        '04 · Market and competition',
        '05 · Business model',
        '06 · Traction',
        '07 · Use of funds',
        '08 · Join us on the next chapter'
      ],
      takeaway: 'One narrative arc from tension to ask'
    },
    {
      title: vertical.thesis,
      role: 'opener',
      layout: 'cover',
      theme: 'light',
      tone: 'white',
      eyebrow: vertical.product,
      subtitle: `${vertical.category} · 2026 investor narrative`,
      bullets: ['Investor deck', '2026', '2025', '2024']
    },
    {
      title: 'Use of funds',
      role: 'close',
      layout: 'metric',
      theme: 'light',
      tone: 'orange',
      eyebrow: 'The ask',
      subtitle: 'Geographic expansion, product velocity, and enterprise acquisition',
      metrics: [
        { value: vertical.askAmount, label: 'Round target', detail: '18-month runway' },
        { value: '40%', label: 'Product', detail: 'Platform and AI workflows' },
        { value: '35%', label: 'GTM', detail: 'Enterprise expansion' }
      ],
      bullets: ['Expand US and EU enterprise sales', 'Accelerate AI-native workflow roadmap']
    },
    {
      title: 'Operating metrics at a glance',
      role: 'evidence',
      layout: 'grid',
      theme: 'light',
      tone: 'white',
      eyebrow: 'Proof',
      metrics: [
        { value: vertical.tractionGrowth, label: 'QoQ growth', detail: 'Net new ARR' },
        { value: '128%', label: 'Net retention', detail: 'Enterprise cohort' },
        { value: '61', label: 'NPS', detail: 'Support satisfaction' },
        { value: '94%', label: 'Activation', detail: 'Day-30 active teams' }
      ],
      bullets: ['ARR velocity', 'Logo expansion', 'Support efficiency']
    },
    {
      title: 'Our traction',
      role: 'proof',
      layout: 'chart',
      theme: 'light',
      tone: 'pink',
      eyebrow: 'Momentum',
      subtitle: `Gaining traction with ${vertical.tractionCount}`,
      bullets: [vertical.tractionGrowth, 'Logo velocity improving quarter over quarter'],
      chart: {
        type: 'column',
        title: 'Monthly active accounts',
        labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
        series: [{ name: 'Accounts', values: [42, 58, 71, 84, 96, 112] }]
      }
    },
    {
      title: 'Why we win',
      role: 'insight',
      layout: 'comparison',
      theme: 'light',
      tone: 'white',
      eyebrow: 'Differentiation',
      columns: [
        {
          heading: 'Legacy stack',
          bullets: ['Manual handoffs', 'Fragmented reporting', 'Slow onboarding', 'Low visibility']
        },
        {
          heading: vertical.product,
          bullets: ['Unified workflow layer', 'Live operational metrics', 'Faster rollout', 'Executive-ready reporting']
        }
      ],
      bullets: ['Replace spreadsheets and swivel-chair ops with one system of record']
    },
    {
      title: 'Team behind the product',
      role: 'proof',
      layout: 'statement',
      theme: 'light',
      tone: 'white',
      eyebrow: 'Operators',
      subtitle: 'Founders with domain depth and enterprise delivery experience',
      bullets: [
        'Previously scaled B2B SaaS from seed to Series C',
        'Built workflow platforms used by Fortune 500 teams',
        'Hiring senior GTM and customer success leaders next'
      ]
    },
    {
      title: 'Market opportunity',
      role: 'context',
      layout: 'metric',
      theme: 'light',
      tone: 'yellow',
      eyebrow: 'TAM',
      subtitle: 'Large, expanding category with urgent workflow modernization',
      metrics: [
        { value: vertical.marketSize, label: 'Total market', detail: 'Global category spend' },
        { value: '$8B', label: 'Serviceable', detail: 'Mid-market and enterprise' },
        { value: '$1.2B', label: 'Obtainable', detail: 'Initial wedge' }
      ],
      bullets: ['Workflow digitization is still early in this category']
    },
    {
      title: 'Just a few facts',
      role: 'evidence',
      layout: 'grid',
      theme: 'light',
      tone: 'orange',
      eyebrow: 'Highlights',
      bullets: [
        '24 months of enterprise delivery',
        '10M workflow events processed',
        '16 countries live or in pilot'
      ]
    },
    {
      title: `Scaling ${vertical.product} to the next level`,
      role: 'close',
      layout: 'statement',
      theme: 'light',
      tone: 'cobalt',
      eyebrow: 'Close',
      subtitle: 'Join the round · Next milestone in 90 days',
      bullets: ['Clear use of funds', 'Named owners for each growth lever', 'Investor updates monthly']
    }
  ];

  return {
    kind: 'deck',
    primaryFormat: 'pptx',
    title: `${vertical.product} Investor Deck`,
    audience: 'Seed and Series A investors',
    tone: 'professional',
    executiveSummary: `${vertical.thesis}. Color-block investor deck with agenda discipline, traction chart, market sizing, and a crisp fundraising ask.`,
    sections: [{
      heading: 'Deck intent',
      body: `Preserve the ${vertical.product} lime-orange-pink-yellow slide rhythm and metric-forward layouts.`,
      bullets: ['One insight per slide', 'Use chart and comparison layouts on proof slides']
    }],
    slides,
    citations: [{ id: 'S1', label: 'Peak reference family: Xboard lime color-block pitch', url: 'https://powerpoint.cloud.microsoft/create/en/pitch-deck-templates/' }],
    nextQuestions: [],
    design: {
      template: 'bold-pop',
      visualDirection: 'Bold geometric investor deck with lime agenda, orange ask, pink traction chart, yellow TAM, and cobalt close.',
      headingFontFamily: 'Arial Black',
      bodyFontFamily: 'Arial',
      slideAspect: 'wide',
      density: 'airy',
      palette: {
        background: '#FFFFFF',
        surface: '#D9F99D',
        text: '#111827',
        muted: '#4B5563',
        primary: '#111827',
        accent: '#F97316'
      }
    },
    assets: []
  };
}