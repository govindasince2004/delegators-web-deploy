import { describe, expect, it } from 'vitest';
import { renderLegalMarkdown } from './legalConfig';

describe('renderLegalMarkdown', () => {
  it('resolves policy cross-links to site routes', () => {
    const out = renderLegalMarkdown('See [Privacy Policy] and [Terms of Service].');
    expect(out).toContain('[Privacy Policy](/privacy)');
    expect(out).toContain('[Terms of Service](/terms)');
  });

  it('leaves unknown tokens when env is unset', () => {
    const out = renderLegalMarkdown('Operator: {{LEGAL_NAME}}');
    expect(out).toMatch(/Operator: ({{LEGAL_NAME}}|.+)/);
  });
});