import type { ArtifactDocument, Slide } from '../shared.js';

type CobaltVertical = {
  id: string;
  product: string;
  tagline: string;
};

const cobaltVerticals: CobaltVertical[] = [
  { id: 'scheduling', product: 'Zonely', tagline: 'Scheduling intelligence for distributed teams' },
  { id: 'crm', product: 'Northstar', tagline: 'Revenue workspace for modern GTM teams' },
  { id: 'support', product: 'Helpline', tagline: 'Customer support with proactive resolution' },
  { id: 'analytics', product: 'Pulseboard', tagline: 'Self-serve analytics without the warehouse tax' },
  { id: 'security', product: 'Sentinel', tagline: 'Security operations with automated response playbooks' },
  { id: 'billing', product: 'Meterbase', tagline: 'Usage billing for API-first products' },
  { id: 'collab', product: 'Threadline', tagline: 'Async collaboration for product and design teams' },
  { id: 'compliance', product: 'Auditpath', tagline: 'Compliance automation for regulated SaaS' }
];

function buildCobaltSlides(vertical: CobaltVertical): Slide[] {
  return [
    {
      title: vertical.tagline,
      role: 'opener',
      layout: 'cover',
      theme: 'dark',
      tone: 'cobalt',
      eyebrow: vertical.product,
      subtitle: 'Enterprise SaaS narrative · 2026',
      bullets: ['Product overview', 'Security', 'Customers', 'Roadmap']
    },
    {
      title: 'Table of contents',
      role: 'context',
      layout: 'list',
      theme: 'light',
      tone: 'white',
      bullets: ['Problem', 'Platform', 'Proof', 'Business model', 'Plan', 'Team', 'Ask']
    },
    {
      title: 'The workflow gap',
      role: 'tension',
      layout: 'split',
      theme: 'light',
      tone: 'ivory',
      subtitle: 'Teams still stitch together five tools to run one process',
      bullets: ['Manual reporting', 'Context switching', 'Slow approvals', 'No single source of truth']
    },
    {
      title: 'Platform overview',
      role: 'solution',
      layout: 'grid',
      theme: 'light',
      tone: 'cobalt',
      bullets: ['Unified dashboard', 'Automation layer', 'Audit trail', 'Enterprise SSO']
    },
    {
      title: 'Customer proof',
      role: 'proof',
      layout: 'metric',
      theme: 'light',
      tone: 'white',
      metrics: [
        { value: '128%', label: 'Net retention', detail: 'Enterprise cohort' },
        { value: '61', label: 'NPS', detail: 'Support satisfaction' },
        { value: '4.2x', label: 'ROI', detail: 'Year-one payback' }
      ],
      bullets: ['Reference logos available under NDA']
    },
    {
      title: 'ARR momentum',
      role: 'evidence',
      layout: 'chart',
      theme: 'light',
      tone: 'cobalt',
      chart: {
        type: 'area',
        title: 'ARR ($M)',
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [{ name: 'ARR', values: [2.1, 3.4, 5.2, 7.8] }],
        unit: '$M'
      },
      bullets: ['Expansion-led growth across enterprise accounts']
    },
    {
      title: 'Why now',
      role: 'insight',
      layout: 'comparison',
      theme: 'light',
      tone: 'white',
      columns: [
        { heading: 'Before', bullets: ['Spreadsheet ops', 'Email approvals', 'Opaque reporting'] },
        { heading: 'After', bullets: ['Live dashboards', 'Automated routing', 'Executive-ready exports'] }
      ],
      bullets: ['Category tailwinds accelerating enterprise adoption']
    },
    {
      title: 'Go-to-market plan',
      role: 'plan',
      layout: 'timeline',
      theme: 'light',
      tone: 'ivory',
      bullets: ['Q1 · Enterprise design partners', 'Q2 · Self-serve expansion', 'Q3 · Partner channel', 'Q4 · International rollout']
    },
    {
      title: 'The ask',
      role: 'close',
      layout: 'statement',
      theme: 'dark',
      tone: 'cobalt',
      subtitle: 'Series A to scale GTM and platform engineering',
      bullets: ['Use of funds mapped to milestones', 'Monthly investor reporting cadence']
    }
  ];
}

export function buildCobaltSaasDeck(verticalId: string): ArtifactDocument | undefined {
  const vertical = cobaltVerticals.find((item) => item.id === verticalId);
  if (!vertical) return undefined;
  return {
    kind: 'deck',
    primaryFormat: 'pptx',
    title: `${vertical.product} SaaS Pitch`,
    audience: 'B2B SaaS investors and enterprise buyers',
    tone: 'professional',
    executiveSummary: vertical.tagline,
    sections: [{ heading: 'Deck system', body: 'Cobalt gradient SaaS deck with white proof slides and enterprise metric rhythm.', bullets: [] }],
    slides: buildCobaltSlides(vertical),
    citations: [{ id: 'S1', label: 'Peak reference family: Cobalt SaaS gradient', url: 'https://powerpoint.cloud.microsoft/create/en/' }],
    nextQuestions: [],
    design: {
      template: 'cobalt-bold',
      headingFontFamily: 'Aptos Display',
      bodyFontFamily: 'Aptos',
      slideAspect: 'wide',
      density: 'balanced',
      palette: {
        background: '#FFFFFF',
        surface: '#E8EDFB',
        text: '#0A1633',
        muted: '#5A6685',
        primary: '#1D3FD8',
        accent: '#4D6FFF'
      }
    },
    assets: []
  };
}

export const cobaltSaasVerticals = cobaltVerticals;