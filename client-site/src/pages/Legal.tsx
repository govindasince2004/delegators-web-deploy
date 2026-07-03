import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MarkdownView } from '../components/MarkdownView';
import { legalOperatorReady, renderLegalMarkdown } from '../lib/legalConfig';
import termsMd from '../content/legal/terms.md?raw';
import privacyMd from '../content/legal/privacy.md?raw';
import refundMd from '../content/legal/refund.md?raw';
import contactMd from '../content/legal/contact.md?raw';
import acceptableUseMd from '../content/legal/acceptable-use.md?raw';
import deliveryMd from '../content/legal/delivery.md?raw';

const DOCS = {
  terms: termsMd,
  privacy: privacyMd,
  refund: refundMd,
  contact: contactMd,
  'acceptable-use': acceptableUseMd,
  delivery: deliveryMd,
} as const;

const NAV: { to: keyof typeof DOCS; label: string }[] = [
  { to: 'terms', label: 'Terms' },
  { to: 'privacy', label: 'Privacy' },
  { to: 'acceptable-use', label: 'Acceptable Use' },
  { to: 'refund', label: 'Refunds' },
  { to: 'delivery', label: 'Delivery' },
  { to: 'contact', label: 'Contact' },
];

export function LegalPage({ doc }: { doc: keyof typeof DOCS }) {
  const source = renderLegalMarkdown(DOCS[doc]);

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Delegators
        </Link>
        {!legalOperatorReady() ? (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Operator details are not configured yet. Set <code className="text-xs">VITE_LEGAL_OPERATOR_*</code> in{' '}
            <code className="text-xs">client-site/.env.local</code> before launch (see{' '}
            <code className="text-xs">legal/operator.env.example</code>).
          </p>
        ) : null}
        <MarkdownView source={source} />
        <div className="mt-10 flex flex-wrap gap-4 border-t border-zinc-200 pt-5 text-sm text-zinc-500">
          {NAV.map(({ to, label }) => (
            <Link key={to} to={`/${to}`} className={to === doc ? 'text-indigo-600' : 'hover:text-indigo-600'}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
