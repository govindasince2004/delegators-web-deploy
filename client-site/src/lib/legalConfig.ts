// Operator identity for public legal pages. Set in client-site/.env.local before launch.
// See legal/operator.env.example for the full checklist.

export type LegalOperator = {
  name: string;
  email: string;
  city: string;
  state: string;
  address: string;
  gstin: string;
  updated: string;
  siteUrl: string;
};

function env(key: string): string {
  return (import.meta.env[key] as string | undefined)?.trim() ?? '';
}

export function legalOperator(): LegalOperator {
  const city = env('VITE_LEGAL_OPERATOR_CITY');
  const state = env('VITE_LEGAL_OPERATOR_STATE');
  const address = env('VITE_LEGAL_OPERATOR_ADDRESS') || [city, state, 'India'].filter(Boolean).join(', ');
  return {
    name: env('VITE_LEGAL_OPERATOR_NAME'),
    email: env('VITE_LEGAL_OPERATOR_EMAIL'),
    city,
    state,
    address,
    gstin: env('VITE_LEGAL_GSTIN'),
    updated: env('VITE_LEGAL_UPDATED') || '17 June 2026',
    siteUrl: env('VITE_SITE_URL') || 'https://delegators.in',
  };
}

export function legalOperatorReady(): boolean {
  const o = legalOperator();
  return Boolean(o.name && o.email && o.city && o.state);
}

const POLICY_LINKS: Record<string, string> = {
  'Terms of Service': '/terms',
  Terms: '/terms',
  'Privacy Policy': '/privacy',
  'Refund & Cancellation Policy': '/refund',
  'Refund Policy': '/refund',
  'Digital Delivery & Shipping Policy': '/delivery',
  'Delivery Policy': '/delivery',
  'Shipping Policy': '/delivery',
  'Acceptable Use Policy': '/acceptable-use',
  'Grievance Redressal': '/contact',
  Contact: '/contact',
};

export function renderLegalMarkdown(source: string): string {
  const o = legalOperator();
  let out = source
    .replaceAll('{{LEGAL_NAME}}', o.name || '{{LEGAL_NAME}}')
    .replaceAll('{{LEGAL_EMAIL}}', o.email || '{{LEGAL_EMAIL}}')
    .replaceAll('{{LEGAL_CITY}}', o.city || '{{LEGAL_CITY}}')
    .replaceAll('{{LEGAL_STATE}}', o.state || '{{LEGAL_STATE}}')
    .replaceAll('{{LEGAL_ADDRESS}}', o.address || '{{LEGAL_ADDRESS}}')
    .replaceAll('{{LEGAL_UPDATED}}', o.updated)
    .replaceAll('{{SITE_URL}}', o.siteUrl);

  if (o.gstin) {
    out = out.replaceAll('{{LEGAL_GSTIN}}', o.gstin);
    out = out.replaceAll('{{LEGAL_GSTIN_LINE}}', `GSTIN: ${o.gstin}`);
  } else {
    out = out.replaceAll('{{LEGAL_GSTIN}}', '');
    out = out.replaceAll('{{LEGAL_GSTIN_LINE}}', '');
  }

  for (const [label, href] of Object.entries(POLICY_LINKS)) {
    out = out.replaceAll(`[${label}]`, `[${label}](${href})`);
  }

  return out;
}
