import { describe, expect, it } from 'vitest';
import { parseAssistantLabeledLine } from '../src/lib/artifactContinuation';
import { renderAssistantLineParts, splitAssistantInlineSegments } from '../src/lib/assistantProseRender';

describe('assistant prose rendering', () => {
  it('parses labeled lines for headline styling', () => {
    expect(parseAssistantLabeledLine('Research: market sizing')).toEqual({
      label: 'Research',
      detail: 'market sizing'
    });
    expect(parseAssistantLabeledLine('Plain sentence without a label.')).toBeNull();
  });

  it('splits links and quoted emphasis without over-highlighting', () => {
    expect(splitAssistantInlineSegments('See https://example.com/docs for details.')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', value: 'https://example.com/docs', href: 'https://example.com/docs' },
      { kind: 'text', value: ' for details.' }
    ]);

    expect(splitAssistantInlineSegments('The "key assumption" still holds.')).toEqual([
      { kind: 'text', value: 'The ' },
      { kind: 'emphasis', value: 'key assumption' },
      { kind: 'text', value: ' still holds.' }
    ]);
  });

  it('keeps labels separate from inline highlights in detail text', () => {
    expect(renderAssistantLineParts('Source: https://data.gov/report and "Q2 outlook"')).toEqual({
      labeled: { label: 'Source', detail: 'https://data.gov/report and "Q2 outlook"' },
      segments: [
        { kind: 'link', value: 'https://data.gov/report', href: 'https://data.gov/report' },
        { kind: 'text', value: ' and ' },
        { kind: 'emphasis', value: 'Q2 outlook' }
      ]
    });
  });
});