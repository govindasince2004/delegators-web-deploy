import type { ReferencePack } from './references.js';

export type ReferenceAnalysisMessage = {
  role: 'system' | 'user';
  content: string;
};

export type ReferenceAnalysisJob = {
  referenceId: string;
  name: string;
  messages: ReferenceAnalysisMessage[];
};

export type CompletedReferenceAnalysis = {
  referenceId: string;
  name: string;
  analysis: string;
};

const maxAnalysisInputChars = 90_000;
const maxAnalysisChars = 30_000;
const maxSynthesisInputPerReference = 10_000;

const analysisSystemPrompt = [
  'You are the grounded upload-analysis stage of Delegators Workbench.',
  'Read the extracted reference material before artifact planning.',
  'Return concise Markdown with these headings: Verified facts, Visual system, Structure and hierarchy, Contradictions, Missing information, Artifact implications.',
  'Separate direct observation from interpretation. Preserve exact numbers, dates, names, labels, and quoted requirements.',
  'For visual material, capture typography or typeface class, approximate font scale and weight, color palette with approximate hex values when supportable, grid, spacing, alignment, density, contrast, imagery, logos, chart encodings, and table structure.',
  'When a deterministic OOXML presentation design profile is present, preserve its exact fonts, rendered colors, slide aspect, and composition counts as facts; do not replace them with visual estimates.',
  'Never claim an exact font family or color value unless the evidence supports it; label estimates as estimates.',
  'Call out unreadable, unsupported, stale, or conflicting material explicitly.',
  'Do not invent facts. No generic advice, generic praise, filler, or artifact drafting.',
  'Keep only observations that materially affect the requested artifact.'
].join('\n');

export function buildReferenceAnalysisMessages(
  pack: ReferencePack,
  brief: string
): ReferenceAnalysisMessage[] {
  return [
    {
      role: 'system',
      content: analysisSystemPrompt
    },
    {
      role: 'user',
      content: [
        `Requested artifact:\n${brief.trim()}`,
        `Extracted reference material:\n${pack.markdown.slice(0, maxAnalysisInputChars)}`
      ].join('\n\n')
    }
  ];
}

export function buildReferenceAnalysisJobs(
  pack: ReferencePack,
  brief: string
): ReferenceAnalysisJob[] {
  return pack.references.map((reference) => ({
    referenceId: reference.id,
    name: reference.name,
    messages: [
      { role: 'system', content: analysisSystemPrompt },
      {
        role: 'user',
        content: [
          `Requested artifact:\n${brief.trim()}`,
          [
            `Reference: ${reference.id}: ${reference.name}`,
            `Kind: ${reference.kind}`,
            reference.mimeType ? `MIME: ${reference.mimeType}` : '',
            `Extractor: ${reference.extractor}`,
            reference.warnings.length ? `Warnings: ${reference.warnings.join(' | ')}` : ''
          ].filter(Boolean).join('\n'),
          `Extracted content:\n${reference.text.slice(0, maxAnalysisInputChars)}`
        ].join('\n\n')
      }
    ]
  }));
}

export function buildReferenceSynthesisMessages(
  analyses: CompletedReferenceAnalysis[],
  brief: string
): ReferenceAnalysisMessage[] {
  return [
    {
      role: 'system',
      content: [
        'Synthesize independent upload analyses into one grounded planning brief.',
        'Return Markdown with: Verified facts, Visual system, Structure and hierarchy, Cross-reference contradictions, Missing information, Artifact implications.',
        'Preserve exact facts and clearly distinguish observation, estimate, and interpretation.',
        'Resolve duplication, but do not erase disagreements between files.',
        'No generic advice, praise, filler, or artifact drafting.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Requested artifact:\n${brief.trim()}`,
        ...analyses.map((entry) => [
          `## ${entry.referenceId}: ${entry.name}`,
          entry.analysis.slice(0, maxSynthesisInputPerReference)
        ].join('\n'))
      ].join('\n\n').slice(0, maxAnalysisInputChars)
    }
  ];
}

export function buildReferenceGenerationContext(
  pack: ReferencePack,
  maxChars = 56_000
): string {
  const safeLimit = Math.max(4_000, maxChars);
  const intro = [
    '# Grounded Upload Context',
    '',
    'Full original uploads and full extracted files remain available in the private workspace under references/uploads and references/extracted.',
    'Use workspace_read when exact detail beyond these excerpts is needed.',
    pack.analysis ? `\n## Cross-reference analysis\n\n${pack.analysis.trim()}\n` : ''
  ].join('\n');
  let output = intro.slice(0, safeLimit);
  const remaining = Math.max(0, safeLimit - output.length);
  const perReference = Math.max(700, Math.floor(remaining / Math.max(1, pack.references.length)));

  for (const reference of pack.references) {
    if (output.length >= safeLimit) break;
    const header = [
      `\n## ${reference.id}: ${reference.name}`,
      `Extractor: ${reference.extractor}`,
      reference.warnings.length ? `Warnings: ${reference.warnings.join(' | ')}` : '',
      'Evidence excerpt:'
    ].filter(Boolean).join('\n');
    const available = Math.max(0, Math.min(perReference, safeLimit - output.length) - header.length - 2);
    output += `${header}\n${balancedExcerpt(reference.text, available)}\n`;
  }

  return output.slice(0, safeLimit);
}

export function attachReferenceAnalysis(pack: ReferencePack, analysis: string): ReferencePack {
  const clean = analysis.trim().slice(0, maxAnalysisChars);
  if (!clean) return pack;
  return {
    ...pack,
    analysis: clean,
    markdown: `${pack.markdown.trim()}\n\n# Grounded Upload Analysis\n\n${clean}\n`,
    seedFiles: [
      ...pack.seedFiles.filter((file) => file.path !== 'references/analysis.md'),
      { path: 'references/analysis.md', content: clean }
    ]
  };
}

function balancedExcerpt(value: string, maxChars: number): string {
  const clean = value.trim();
  if (maxChars <= 0) return '';
  if (clean.length <= maxChars) return clean;
  const marker = '\n\n[... middle omitted; read the full extracted file in the workspace ...]\n\n';
  const usable = Math.max(0, maxChars - marker.length);
  const head = Math.ceil(usable * 0.6);
  return `${clean.slice(0, head)}${marker}${clean.slice(clean.length - (usable - head))}`;
}
