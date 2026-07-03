import type { ArtifactDocument } from '../src/lib/shared.js';
import {
  compileBriefConstraints,
  constraintsViolatedBySlideCount,
  requestedSlideCount
} from './constraintCompiler.js';
import { inspectArtifactLocally } from './artifactInspection.js';
import { countHypeSignals } from './artifactCredibility.js';
import { artifactHasResearchApparatus } from './citationExport.js';
import { designPresetIssue } from './designPreset.js';


export type GoldenEvalCase = {
  id: string;
  brief: string;
  expectedKind: ArtifactDocument['kind'];
  expectedPrimaryFormat: NonNullable<ArtifactDocument['primaryFormat']>;
  minSlides?: number;
  maxSlides?: number;
};

export const goldenEvalCases: GoldenEvalCase[] = [
  {
    id: 'investor-12-slide',
    brief: 'Create a premium 12-slide investor deck on SpaceX with latest sources and charts.',
    expectedKind: 'deck',
    expectedPrimaryFormat: 'pptx',
    minSlides: 12,
    maxSlides: 12
  },
  {
    id: 'board-8-slide',
    brief: 'Build an 8-slide board briefing on AI infrastructure spend with cited evidence.',
    expectedKind: 'deck',
    expectedPrimaryFormat: 'pptx',
    minSlides: 8,
    maxSlides: 8
  },
  {
    id: 'executive-report',
    brief: 'Write an executive report on cloud cost optimization with citations and a recommendation section.',
    expectedKind: 'report',
    expectedPrimaryFormat: 'pdf'
  },
  {
    id: 'student-class-deck',
    brief: 'School class presentation for students on photosynthesis with cited sources.',
    expectedKind: 'deck',
    expectedPrimaryFormat: 'pptx',
    minSlides: 6,
    maxSlides: 12
  },
  {
    id: 'founder-pitch',
    brief: 'Startup founder seed pitch deck with sourced metrics and honest risks.',
    expectedKind: 'deck',
    expectedPrimaryFormat: 'pptx',
    minSlides: 8,
    maxSlides: 14
  },
  {
    id: 'thread-followup-report',
    brief: 'Create a pdf report from our research with sources and methodology appendix.',
    expectedKind: 'report',
    expectedPrimaryFormat: 'pdf'
  },
  {
    id: 'college-assignment',
    brief: '@assignment college project report with references and methodology section.',
    expectedKind: 'assignment',
    expectedPrimaryFormat: 'pdf'
  }
];

export type GoldenEvalScore = {
  caseId: string;
  passed: boolean;
  issues: string[];
  slideCount?: number;
};

export function scoreArtifactAgainstGoldenCase(artifact: ArtifactDocument, testCase: GoldenEvalCase): GoldenEvalScore {
  const issues: string[] = [];
  const slideCount = artifact.slides?.length;
  const constraints = compileBriefConstraints(testCase.brief, testCase.expectedKind);

  if (artifact.kind !== testCase.expectedKind) {
    issues.push(`Expected kind ${testCase.expectedKind}, got ${artifact.kind}.`);
  }
  if (artifact.primaryFormat !== testCase.expectedPrimaryFormat) {
    issues.push(`Expected format ${testCase.expectedPrimaryFormat}, got ${artifact.primaryFormat ?? 'none'}.`);
  }

  const slideViolation = slideCount !== undefined
    ? constraintsViolatedBySlideCount(slideCount, testCase.brief)
    : requestedSlideCount(testCase.brief)
      ? `The user requested ${requestedSlideCount(testCase.brief)} slides, but the artifact contains 0.`
      : undefined;
  if (slideViolation) issues.push(slideViolation);

  if (testCase.minSlides !== undefined && (slideCount ?? 0) < testCase.minSlides) {
    issues.push(`Expected at least ${testCase.minSlides} slides, got ${slideCount ?? 0}.`);
  }
  if (testCase.maxSlides !== undefined && (slideCount ?? 0) > testCase.maxSlides) {
    issues.push(`Expected at most ${testCase.maxSlides} slides, got ${slideCount ?? 0}.`);
  }

  const designIssue = designPresetIssue(artifact, testCase.brief);
  if (designIssue) issues.push(designIssue);

  const inspection = inspectArtifactLocally({
    artifact,
    sourceBrief: testCase.brief,
    expectedKind: testCase.expectedKind,
    expectedPrimaryFormat: testCase.expectedPrimaryFormat
  });
  issues.push(...inspection.issues.filter((issue) =>
    /requested \d+ slides|primary format|artifact kind|institutional hype|anonymous authority|citations\[\]|source appendix|claim confidence|underdesigned template cover/i.test(issue)
  ));

  if (/\b(?:cited|sources?|citations?|research)\b/i.test(testCase.brief) && !artifactHasResearchApparatus(artifact)) {
    issues.push('Researched brief requires citations, sourceIds, or a sources appendix.');
  }
  if (countHypeSignals(artifact) >= 2) {
    issues.push('Artifact carries institutional hype phrasing.');
  }
  if (testCase.id === 'thread-followup-report' && artifact.sections.length < 3) {
    issues.push('Thread follow-up report is too shallow for a sourced deliverable.');
  }

  return {
    caseId: testCase.id,
    passed: issues.length === 0,
    issues,
    slideCount
  };
}