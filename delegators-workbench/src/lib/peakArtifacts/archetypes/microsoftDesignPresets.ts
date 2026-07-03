import type { DesignPresetTokens } from '../../designPresets.js';
import { microsoftPowerPointRefs } from './microsoftInspiredCatalog.js';

const MS_PALETTES: Record<string, DesignPresetTokens['palette']> = {
  'pitch-deck': { background: '#FFFFFF', surface: '#EFF6FF', text: '#0F172A', muted: '#64748B', primary: '#1D4ED8', accent: '#3B82F6' },
  'business-presentation': { background: '#F8FAFC', surface: '#E2E8F0', text: '#0F172A', muted: '#64748B', primary: '#334155', accent: '#0EA5E9' },
  'timeline-slides': { background: '#FFFFFF', surface: '#F0FDF4', text: '#14532D', muted: '#4D7C0F', primary: '#15803D', accent: '#22C55E' },
  'marketing-deck': { background: '#FFFFFF', surface: '#FFF1F2', text: '#881337', muted: '#BE123C', primary: '#E11D48', accent: '#FB7185' },
  'academic-presentation': { background: '#FFFBEB', surface: '#FEF3C7', text: '#78350F', muted: '#B45309', primary: '#92400E', accent: '#D97706' },
  'sales-deck': { background: '#FFFFFF', surface: '#ECFDF5', text: '#064E3B', muted: '#047857', primary: '#059669', accent: '#10B981' },
  'product-launch': { background: '#0A0A0A', surface: '#171717', text: '#FAFAFA', muted: '#A3A3A3', primary: '#262626', accent: '#F97316' },
  'proposal-presentation': { background: '#FFFFFF', surface: '#F5F3FF', text: '#2E1065', muted: '#7C3AED', primary: '#5B21B6', accent: '#8B5CF6' },
  keynote: { background: '#000000', surface: '#0C0C0C', text: '#FFFFFF', muted: '#737373', primary: '#171717', accent: '#FFFFFF' },
  portfolio: { background: '#FFFFFF', surface: '#FDF4FF', text: '#581C87', muted: '#9333EA', primary: '#7E22CE', accent: '#C084FC' },
  'copilot-pitch': { background: '#FFFFFF', surface: '#EEF2FF', text: '#1E1B4B', muted: '#6366F1', primary: '#4338CA', accent: '#818CF8' },
  'financial-review': { background: '#F1F5F9', surface: '#CBD5E1', text: '#0F172A', muted: '#475569', primary: '#1E293B', accent: '#0369A1' },
  'board-briefing': { background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A', muted: '#64748B', primary: '#0F172A', accent: '#DC2626' },
  'quarterly-review': { background: '#FFFFFF', surface: '#DBEAFE', text: '#1E3A8A', muted: '#3B82F6', primary: '#1D4ED8', accent: '#60A5FA' },
  'brand-guidelines-deck': { background: '#FFFBF5', surface: '#F5EDE3', text: '#292524', muted: '#A8A29E', primary: '#57534E', accent: '#D97706' },
  'training-deck': { background: '#FFFFFF', surface: '#ECFEFF', text: '#164E63', muted: '#0891B2', primary: '#0E7490', accent: '#22D3EE' },
  'webinar-deck': { background: '#0F172A', surface: '#1E293B', text: '#F8FAFC', muted: '#94A3B8', primary: '#0F766E', accent: '#14B8A6' },
  'case-study-deck': { background: '#FFFFFF', surface: '#FFF7ED', text: '#7C2D12', muted: '#C2410C', primary: '#EA580C', accent: '#FB923C' },
  'roadmap-deck': { background: '#FFFFFF', surface: '#F0F9FF', text: '#0C4A6E', muted: '#0284C7', primary: '#0369A1', accent: '#38BDF8' },
  'okr-review': { background: '#FFFFFF', surface: '#F0FDFA', text: '#134E4A', muted: '#0F766E', primary: '#115E59', accent: '#2DD4BF' },
  'all-hands': { background: '#FFFFFF', surface: '#FEF9C3', text: '#713F12', muted: '#CA8A04', primary: '#A16207', accent: '#FACC15' },
  'customer-success': { background: '#FFFFFF', surface: '#DCFCE7', text: '#14532D', muted: '#16A34A', primary: '#15803D', accent: '#4ADE80' },
  'partner-pitch': { background: '#FFFFFF', surface: '#EDE9FE', text: '#4C1D95', muted: '#7C3AED', primary: '#6D28D9', accent: '#A78BFA' },
  'grant-pitch': { background: '#F0FDF4', surface: '#DCFCE7', text: '#14532D', muted: '#166534', primary: '#15803D', accent: '#86EFAC' },
  'nonprofit-pitch': { background: '#ECFDF5', surface: '#D1FAE5', text: '#064E3B', muted: '#047857', primary: '#065F46', accent: '#34D399' },
  'real-estate-pitch': { background: '#FAFAF9', surface: '#F5F5F4', text: '#44403C', muted: '#78716C', primary: '#57534E', accent: '#D97706' },
  'healthcare-pitch': { background: '#FFFFFF', surface: '#E0F2FE', text: '#0C4A6E', muted: '#0369A1', primary: '#075985', accent: '#0EA5E9' },
  'education-pitch': { background: '#FFFBEB', surface: '#FEF08A', text: '#713F12', muted: '#A16207', primary: '#CA8A04', accent: '#EAB308' },
  'startup-pitch': { background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A', muted: '#64748B', primary: '#F26522', accent: '#2563EB' },
  'investor-update': { background: '#FFFFFF', surface: '#EEF2FF', text: '#312E81', muted: '#6366F1', primary: '#4338CA', accent: '#4F46E5' },
  'competitive-analysis': { background: '#FFFFFF', surface: '#F1F5F9', text: '#0F172A', muted: '#64748B', primary: '#1E40AF', accent: '#EF4444' },
  'event-pitch': { background: '#FFFFFF', surface: '#FCE7F3', text: '#831843', muted: '#BE185D', primary: '#DB2777', accent: '#F472B6' }
};

const MS_FONTS: Record<string, { heading: string; body: string; density?: DesignPresetTokens['density'] }> = {
  keynote: { heading: 'Aptos Display', body: 'Aptos', density: 'airy' },
  'brand-guidelines-deck': { heading: 'Georgia', body: 'Georgia', density: 'airy' },
  'academic-presentation': { heading: 'Georgia', body: 'Aptos', density: 'balanced' },
  'financial-review': { heading: 'Arial', body: 'Arial', density: 'compact' },
  'board-briefing': { heading: 'Arial', body: 'Arial', density: 'compact' }
};

export const microsoftDeckDesignPresets: Record<string, DesignPresetTokens> = Object.fromEntries(
  microsoftPowerPointRefs.map((ref) => {
    const presetId = `ms-${ref.id}`;
    const palette = MS_PALETTES[ref.id];
    const fonts = MS_FONTS[ref.id] ?? { heading: 'Aptos Display', body: 'Aptos', density: 'balanced' as const };
    return [
      presetId,
      {
        template: 'modern-indigo',
        headingFont: fonts.heading,
        bodyFont: fonts.body,
        visualDirection: ref.designMood,
        palette,
        slideAspect: 'wide' as const,
        density: fonts.density
      } satisfies DesignPresetTokens
    ];
  })
);