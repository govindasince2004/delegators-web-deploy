import type { ArtifactDesign } from './shared.js';
import { microsoftDeckDesignPresets } from './peakArtifacts/archetypes/microsoftDesignPresets.js';

export type DesignPresetTokens = {
  template: NonNullable<ArtifactDesign['template']>;
  headingFont: string;
  bodyFont: string;
  visualDirection: string;
  palette: NonNullable<ArtifactDesign['palette']>;
  slideAspect?: ArtifactDesign['slideAspect'];
  density?: ArtifactDesign['density'];
};

const presets: Record<string, DesignPresetTokens> = {
  'midnight-aurora': {
    template: 'midnight-aurora',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Cinematic dark-space briefing with restrained typography and high-contrast evidence blocks.',
    palette: {
      background: '#0B1220',
      surface: '#16203A',
      text: '#E6EAF2',
      muted: '#8B94A8',
      primary: '#101A30',
      accent: '#2DD4BF'
    },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'executive-slate': {
    template: 'executive-slate',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Boardroom executive slate with calm hierarchy and sourced metrics.',
    palette: {
      background: '#F8FAFC',
      surface: '#E7EDF4',
      text: '#0F172A',
      muted: '#64748B',
      primary: '#1E293B',
      accent: '#2563EB'
    },
    slideAspect: 'wide',
    density: 'airy'
  },
  'editorial-ivory': {
    template: 'editorial-ivory',
    headingFont: 'Georgia',
    bodyFont: 'Georgia',
    visualDirection: 'Editorial ivory surfaces with citation-friendly structure.',
    palette: {
      background: '#FBF8F1',
      surface: '#F0E9DB',
      text: '#221D15',
      muted: '#7A715F',
      primary: '#433A2B',
      accent: '#B5562C'
    },
    density: 'balanced'
  },
  'consulting-mono': {
    template: 'consulting-mono',
    headingFont: 'Arial',
    bodyFont: 'Arial',
    visualDirection: 'Consulting-grade monochrome with evidence-first layouts.',
    palette: {
      background: '#FFFFFF',
      surface: '#F2F2F1',
      text: '#121212',
      muted: '#6B6B6B',
      primary: '#1A1A1A',
      accent: '#C8102E'
    },
    density: 'compact'
  },
  'modern-indigo': {
    template: 'modern-indigo',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Modern indigo system with crisp evidence blocks.',
    palette: {
      background: '#FFFFFF',
      surface: '#EEF2FF',
      text: '#111827',
      muted: '#6B7280',
      primary: '#312E81',
      accent: '#4F46E5'
    },
    slideAspect: 'wide'
  },
  'bold-pop': {
    template: 'bold-pop',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Bold color-block deck with one idea per slide.',
    palette: {
      background: '#FFFFFF',
      surface: '#F3EFFF',
      text: '#14101F',
      muted: '#6E6781',
      primary: '#5B2EFF',
      accent: '#FF5C00'
    },
    slideAspect: 'wide'
  },
  'cobalt-bold': {
    template: 'cobalt-bold',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Enterprise cobalt deck with confident hierarchy.',
    palette: {
      background: '#FFFFFF',
      surface: '#E8EDFB',
      text: '#0A1633',
      muted: '#5A6685',
      primary: '#1D3FD8',
      accent: '#4D6FFF'
    },
    slideAspect: 'wide'
  },
  'noir-lumina': {
    template: 'noir-lumina',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Premium noir keynote with luminous accent panels.',
    palette: {
      background: '#0A0A0C',
      surface: '#17171C',
      text: '#F2EFE9',
      muted: '#9A958C',
      primary: '#141419',
      accent: '#E8A33D'
    },
    slideAspect: 'wide'
  },
  'editorial-warm': {
    template: 'editorial-warm',
    headingFont: 'Georgia',
    bodyFont: 'Aptos',
    visualDirection: 'Warm editorial document with photo-friendly sections.',
    palette: {
      background: '#F7F3EC',
      surface: '#EDE5D8',
      text: '#262220',
      muted: '#857B6E',
      primary: '#3E372F',
      accent: '#C96F4A'
    }
  },
  'signal-orange': {
    template: 'signal-orange',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'High-energy orange accent system for marketing collateral.',
    palette: {
      background: '#FFFFFF',
      surface: '#FFF1E8',
      text: '#23234B',
      muted: '#6F6F95',
      primary: '#FF5A1F',
      accent: '#32327A'
    }
  },
  'classic-ats': {
    template: 'classic-ats',
    headingFont: 'Cambria',
    bodyFont: 'Cambria',
    visualDirection: 'Clean ATS-friendly resume with scannable headings.',
    palette: {
      background: '#FFFFFF',
      surface: '#F5F5F2',
      text: '#111111',
      muted: '#555555',
      primary: '#111111',
      accent: '#1F4E79'
    },
    density: 'compact'
  },
  'teal-momentum': {
    template: 'editorial-warm',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Navy and teal chapter PDF with numbered sections and photo bands.',
    palette: {
      background: '#0A1F3D',
      surface: '#123B5C',
      text: '#F8FAFC',
      muted: '#94A3B8',
      primary: '#0F2D4D',
      accent: '#14B8A6'
    }
  },
  'rose-editorial': {
    template: 'editorial-ivory',
    headingFont: 'Georgia',
    bodyFont: 'Aptos',
    visualDirection: 'Soft rose lifestyle guide with elegant line-art accents.',
    palette: {
      background: '#FFF5F8',
      surface: '#FCE7F3',
      text: '#3F2D33',
      muted: '#9D7486',
      primary: '#831843',
      accent: '#F472B6'
    }
  },
  'wellness-signal': {
    template: 'signal-orange',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Orange and cobalt wellness guide with product cards and progress grids.',
    palette: {
      background: '#FFFFFF',
      surface: '#FFF1E8',
      text: '#0F172A',
      muted: '#64748B',
      primary: '#FF5A1F',
      accent: '#1D4ED8'
    }
  },
  'spreadsheet-forest': {
    template: 'executive-slate',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Excel forest-green header bands with zebra table rows.',
    palette: {
      background: '#FFFFFF',
      surface: '#ECFDF5',
      text: '#052E1B',
      muted: '#4B6B5A',
      primary: '#217346',
      accent: '#34D399'
    },
    density: 'compact'
  },
  'spreadsheet-royal': {
    template: 'modern-indigo',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Royal purple spreadsheet headers with lavender surfaces.',
    palette: {
      background: '#FFFFFF',
      surface: '#F5F3FF',
      text: '#2E1065',
      muted: '#7C6F9A',
      primary: '#6B46C1',
      accent: '#A78BFA'
    },
    density: 'compact'
  },
  'lime-metric': {
    template: 'bold-pop',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Lime metric dashboard tiles with bold chart bands.',
    palette: {
      background: '#FFFFFF',
      surface: '#F7FEE7',
      text: '#1A2E05',
      muted: '#4D7C0F',
      primary: '#65A30D',
      accent: '#F97316'
    },
    density: 'compact'
  },
  // —— Peak deck archetype presets (unique palettes per layout fingerprint) ——
  'sequoia-editorial': {
    template: 'editorial-ivory',
    headingFont: 'Georgia',
    bodyFont: 'Georgia',
    visualDirection: 'Sequoia-style editorial ivory with oversized serif statements and sparse chart proof.',
    palette: { background: '#FBF8F1', surface: '#F0E9DB', text: '#1C1917', muted: '#78716C', primary: '#292524', accent: '#B45309' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'airbnb-story': {
    template: 'editorial-warm',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Warm narrative deck with geometric shape panels and story-driven split slides.',
    palette: { background: '#FFFFFF', surface: '#FEE2E2', text: '#1F2937', muted: '#6B7280', primary: '#FF385C', accent: '#2563EB' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'apple-keynote': {
    template: 'noir-lumina',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Cinematic dark keynote with huge white type and restrained luminous accents.',
    palette: { background: '#000000', surface: '#1C1C1E', text: '#F5F5F7', muted: '#86868B', primary: '#0A0A0A', accent: '#2997FF' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'stripe-fintech': {
    template: 'modern-indigo',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Stripe-clean fintech grid with precise indigo metrics and white proof bands.',
    palette: { background: '#FFFFFF', surface: '#F6F9FC', text: '#0A2540', muted: '#697386', primary: '#635BFF', accent: '#00D4FF' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'mckinsey-pyramid': {
    template: 'consulting-mono',
    headingFont: 'Arial',
    bodyFont: 'Arial',
    visualDirection: 'McKinsey pyramid consulting deck with evidence grids and sourced metric blocks.',
    palette: { background: '#FFFFFF', surface: '#F2F2F1', text: '#121212', muted: '#6B6B6B', primary: '#1A1A1A', accent: '#C8102E' },
    slideAspect: 'wide',
    density: 'compact'
  },
  'dribbble-colorblock': {
    template: 'bold-pop',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Dribbble-inspired saturated color panels with playful grid blocks.',
    palette: { background: '#FFFFFF', surface: '#FDF2F8', text: '#18181B', muted: '#71717A', primary: '#EA4C89', accent: '#8B5CF6' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'notion-minimal': {
    template: 'editorial-ivory',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Notion-soft neutrals with quiet hierarchy and breathable whitespace.',
    palette: { background: '#FFFFFF', surface: '#F7F6F3', text: '#37352F', muted: '#9B9A97', primary: '#2F2F2F', accent: '#2383E2' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'linear-dark': {
    template: 'midnight-aurora',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Linear dark product launch with crisp splits and neon workflow accents.',
    palette: { background: '#0B0C0E', surface: '#16181D', text: '#EEEFF1', muted: '#8A8F98', primary: '#5E6AD2', accent: '#26D7A8' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'figma-creative': {
    template: 'bold-pop',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Figma vibrant dual-tone splits with creative multi-hue grid panels.',
    palette: { background: '#FFFFFF', surface: '#F3E8FF', text: '#1E1E1E', muted: '#6B7280', primary: '#7C3AED', accent: '#F24E1E' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'spotify-bold': {
    template: 'midnight-aurora',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Spotify neon-on-dark growth deck with bold grids and lime accent pulses.',
    palette: { background: '#121212', surface: '#1E1E1E', text: '#FFFFFF', muted: '#B3B3B3', primary: '#191414', accent: '#1DB954' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'yc-seed': {
    template: 'executive-slate',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'YC seed deck with list agenda and proof-first metric slides on clean white.',
    palette: { background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A', muted: '#64748B', primary: '#F26522', accent: '#2563EB' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'uber-momentum': {
    template: 'noir-lumina',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Uber momentum deck stacking dual charts and bold black metric tiles.',
    palette: { background: '#000000', surface: '#141414', text: '#FFFFFF', muted: '#9CA3AF', primary: '#111111', accent: '#FFFFFF' },
    slideAspect: 'wide',
    density: 'compact'
  },
  'slack-playful': {
    template: 'bold-pop',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Slack playful conversational deck with quote interludes and candy accent panels.',
    palette: { background: '#FFFFFF', surface: '#F4EDE4', text: '#1D1C1D', muted: '#616061', primary: '#4A154B', accent: '#E01E5A' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'openai-research': {
    template: 'midnight-aurora',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'OpenAI research-grade dark deck with evidence grids and chart-led insights.',
    palette: { background: '#0D0D0D', surface: '#1A1A1A', text: '#ECECEC', muted: '#8E8E8E', primary: '#10A37F', accent: '#74AA9C' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'canva-vibrant': {
    template: 'signal-orange',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Canva vibrant multi-hue grids with energetic orange-pink-lime accent rotation.',
    palette: { background: '#FFFFFF', surface: '#FFF7ED', text: '#1F2937', muted: '#6B7280', primary: '#7D2AE8', accent: '#00C4CC' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'intercom-conversation': {
    template: 'modern-indigo',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Intercom conversation-led flow with customer quotes and support metric proof.',
    palette: { background: '#FFFFFF', surface: '#EEF2FF', text: '#1F2937', muted: '#6B7280', primary: '#286EFA', accent: '#FF6B00' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'shopify-commerce': {
    template: 'executive-slate',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Shopify commerce green metrics with comparison tables and process grids.',
    palette: { background: '#FFFFFF', surface: '#ECFDF5', text: '#052E1B', muted: '#4B6B5A', primary: '#008060', accent: '#5C6AC4' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'robinhood-finance': {
    template: 'midnight-aurora',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Robinhood chart-dense finance deck with neon lime metrics on graphite.',
    palette: { background: '#0E0E0E', surface: '#1B1B1B', text: '#F5F5F5', muted: '#9CA3AF', primary: '#111111', accent: '#00C805' },
    slideAspect: 'wide',
    density: 'compact'
  },
  'nike-athletic': {
    template: 'noir-lumina',
    headingFont: 'Arial Black',
    bodyFont: 'Arial',
    visualDirection: 'Nike athletic statement deck with timeline momentum and bold orange accents.',
    palette: { background: '#111111', surface: '#1A1A1A', text: '#FFFFFF', muted: '#A3A3A3', primary: '#000000', accent: '#FF6B00' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'tesla-future': {
    template: 'midnight-aurora',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Tesla future-forward dark deck with process reveals and timeline milestones.',
    palette: { background: '#0A0A0A', surface: '#171717', text: '#F5F5F5', muted: '#737373', primary: '#E82127', accent: '#3B82F6' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'bloomberg-data': {
    template: 'consulting-mono',
    headingFont: 'Arial',
    bodyFont: 'Arial',
    visualDirection: 'Bloomberg data-wall deck with stacked charts and dense cobalt metric grids.',
    palette: { background: '#0B1628', surface: '#142238', text: '#E8EDF5', muted: '#8B9BB4', primary: '#1E3A5F', accent: '#F58220' },
    slideAspect: 'wide',
    density: 'compact'
  },
  'hubspot-inbound': {
    template: 'signal-orange',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'HubSpot inbound orange deck with list agenda and GTM process close.',
    palette: { background: '#FFFFFF', surface: '#FFF1E8', text: '#33475B', muted: '#7C98B6', primary: '#FF7A59', accent: '#0091AE' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'pitch-classic': {
    template: 'cobalt-bold',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Pitch classic eight-slide investor arc with early comparison and metric ask.',
    palette: { background: '#FFFFFF', surface: '#E8EDFB', text: '#0A1633', muted: '#5A6685', primary: '#1D3FD8', accent: '#4D6FFF' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'bessemer-cloud': {
    template: 'executive-slate',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Bessemer cloud metrics pyramid with layered proof and investor quote.',
    palette: { background: '#FFFFFF', surface: '#E7EDF4', text: '#0F172A', muted: '#64748B', primary: '#1E40AF', accent: '#0EA5E9' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'a16z-thesis': {
    template: 'noir-lumina',
    headingFont: 'Georgia',
    bodyFont: 'Aptos',
    visualDirection: 'a16z thesis-first dark narrative with stacked statements and split market proof.',
    palette: { background: '#0C0C0C', surface: '#1A1A1A', text: '#F0EDE8', muted: '#9A958C', primary: '#ED4C2F', accent: '#F5C842' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'duolingo-growth': {
    template: 'bold-pop',
    headingFont: 'Aptos Display',
    bodyFont: 'Aptos',
    visualDirection: 'Duolingo playful growth loops with lime-yellow process and dual grid proof.',
    palette: { background: '#FFFFFF', surface: '#DCFCE7', text: '#14532D', muted: '#4D7C0F', primary: '#58CC02', accent: '#FFC800' },
    slideAspect: 'wide',
    density: 'airy'
  },
  'asana-workflow': {
    template: 'modern-indigo',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Asana workflow deck with process and timeline planning as hero layouts.',
    palette: { background: '#FFFFFF', surface: '#F9F5FF', text: '#3F3F46', muted: '#71717A', primary: '#F06A6A', accent: '#5DA9F6' },
    slideAspect: 'wide',
    density: 'balanced'
  },
  'dropbox-simple': {
    template: 'cobalt-bold',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    visualDirection: 'Dropbox radically simple list-driven deck with minimal cobalt hierarchy.',
    palette: { background: '#FFFFFF', surface: '#F0F9FF', text: '#1E293B', muted: '#64748B', primary: '#0061FF', accent: '#7C3AED' },
    slideAspect: 'wide',
    density: 'airy'
  },
  ...microsoftDeckDesignPresets
};

const formatFallbacks: Partial<Record<string, DesignPresetTokens>> = {
  deck: presets['cobalt-bold'],
  report: presets['editorial-ivory'],
  sheet: presets['spreadsheet-forest'],
  resume: presets['classic-ats'],
  email: presets['consulting-mono'],
  assignment: presets['editorial-ivory']
};

export function presetAccentColor(presetId: string | undefined, format: keyof typeof formatFallbacks): string {
  return resolveDesignPreset(presetId, format).palette.accent ?? '#52B3FF';
}

export function resolveDesignPreset(
  presetId: string | undefined,
  format: keyof typeof formatFallbacks
): DesignPresetTokens {
  if (presetId && presets[presetId]) return presets[presetId];
  return formatFallbacks[format] ?? presets['executive-slate'];
}