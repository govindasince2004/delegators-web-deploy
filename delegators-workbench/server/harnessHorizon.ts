import type { ArtifactKind } from '../src/lib/shared.js';
import type { RunDepthTier } from './agenticDepth.js';

export type HarnessSeedFile = {
  path: string;
  content: string;
};

export function horizonHarnessPromptLines(tier: RunDepthTier): string[] {
  if (tier === 'fast') return [];
  if (tier === 'standard') {
    return [
      'Follow harness/quality-rubric.md when validating before the final JSON response.',
      'Write drafts/outline.md after research synthesis when the brief has 6+ sections or 8+ slides.'
    ];
  }
  return [
    'LONG-HORIZON HARNESS: follow harness/horizon-plan.md phase-by-phase — do not skip validation.',
    'Read harness/quality-rubric.md before compose and again before artifact_validate.',
    'Checkpoint with workspace_checkpoint after outline lock and after first full draft.',
    'If tool budget is tight, finish the artifact JSON rather than exploratory browsing.'
  ];
}

function marathonHorizonPlan(kind: ArtifactKind): string {
  return [
    '# Marathon horizon plan',
    '',
    '## Phase 1 — Intake',
    '- Parse brief constraints, template harness, personal knowledge, and research/source-pack.md.',
    '- List unknown facts in workspace/unknowns.md instead of guessing.',
    '',
    '## Phase 2 — Research synthesis',
    '- Merge web research, references, cloud imports, and thread memory.',
    '- Write research/synthesis.md with claim → source mapping.',
    '',
    '## Phase 3 — Outline lock',
    '- Write drafts/outline.md with slide roles or section purposes.',
    '- Match requested counts exactly before composing body copy.',
    '',
    '## Phase 4 — Compose',
    '- Fill outline with evidence-bound content, charts, and tables.',
    '- Run terminal_run for any derived numbers.',
    '',
    '## Phase 5 — Validate & export',
    '- artifact_validate against schema and quality rubric.',
    '- Ensure citations, native URLs, and export-safe structure for the target format.',
    '',
    `Deliverable kind: ${kind}`
  ].join('\n');
}

function qualityRubricMarkdown(tier: RunDepthTier, kind: ArtifactKind): string {
  const marathon = tier === 'marathon';
  return [
    '# Artifact quality rubric',
    '',
    '## Evidence',
    marathon ? '- Every major claim cites a source id or honest gap.' : '- Major external claims need sources or explicit gaps.',
    '- No fabricated metrics, dates, funding, or citations.',
    '- Research pack sources preferred over invented URLs.',
    '',
    '## Structure',
    kind === 'deck' ? '- Slide count matches brief; varied layouts; opener + close present.' : '',
    kind === 'report' || kind === 'assignment' ? '- BLUF or executive summary leads; appendix/sources when research-heavy.' : '',
    kind === 'sheet' ? '- Named sheets, header rows, numeric columns where brief implies math.' : '',
    '- No placeholder tokens (TBD, lorem, [Name]).',
    '',
    '## Visual / export',
    '- Charts: labels.length matches every series.values.length.',
    '- Tables: non-empty headers and rows.',
    '- design.template set when brief implies a curated system.',
    marathon ? '- WPS/Microsoft gallery templates: preserve locked layout rhythm.' : '',
    '',
    '## Publish gate',
    '- artifact_validate must pass before final response.',
    '- nextQuestions only for truly missing user facts (max 6).'
  ].filter(Boolean).join('\n');
}

export function buildHorizonHarnessSeeds(
  tier: RunDepthTier,
  kind: ArtifactKind,
  brief: string
): HarnessSeedFile[] {
  if (tier === 'fast') return [];
  const seeds: HarnessSeedFile[] = [
    { path: 'harness/quality-rubric.md', content: qualityRubricMarkdown(tier, kind) }
  ];
  if (tier === 'marathon' || (tier === 'deep' && brief.length >= 400)) {
    seeds.push({ path: 'harness/horizon-plan.md', content: marathonHorizonPlan(kind) });
  }
  if (tier === 'deep' || tier === 'marathon') {
    seeds.push({
      path: 'drafts/outline.md',
      content: [
        '# Outline draft (agent: replace with real structure)',
        '',
        'Lock slide/section roles here before composing final artifact JSON.',
        `Kind: ${kind}`,
        `Depth: ${tier}`
      ].join('\n')
    });
  }
  return seeds;
}

export function artifactQualityBoostLines(tier: RunDepthTier, kind: ArtifactKind): string[] {
  if (tier === 'fast') return [];
  const lines = [
    'Quality pass: bind claims to sources, vary deck layouts, and run the harness quality rubric before finishing.',
    'Prefer one strong revision over multiple shallow tool loops.'
  ];
  if (tier === 'marathon') {
    lines.push(
      'Marathon quality: executive-ready prose, explicit confidence labels on uncertain claims, and complete export structure.',
      kind === 'deck'
        ? 'Deck marathon: include chart or metric slides where data exists; no text-only walls on evidence slides.'
        : kind === 'report'
          ? 'Report marathon: methodology + limitations sections when research pack is present.'
          : ''
    );
  }
  return lines.filter(Boolean);
}