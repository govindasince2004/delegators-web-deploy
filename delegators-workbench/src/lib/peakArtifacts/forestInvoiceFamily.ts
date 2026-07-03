import type { ArtifactDocument } from '../shared.js';

const invoiceVariants = [
  { id: 'consulting', title: 'Consulting Invoice', client: 'Northwind Labs' },
  { id: 'agency', title: 'Agency Invoice', client: 'Brightline Studio' },
  { id: 'freelance', title: 'Freelance Invoice', client: 'Avery Chen' },
  { id: 'vendor', title: 'Vendor Invoice', client: 'SupplyCo Partners' },
  { id: 'retainer', title: 'Retainer Invoice', client: 'Summit Legal' },
  { id: 'services', title: 'Services Invoice', client: 'Harbor Health' },
  { id: 'product', title: 'Product Invoice', client: 'Atlas Devices' },
  { id: 'maintenance', title: 'Maintenance Invoice', client: 'Metro Facilities' }
];

export function buildForestInvoiceArtifact(variantId: string): ArtifactDocument | undefined {
  const variant = invoiceVariants.find((item) => item.id === variantId);
  if (!variant) return undefined;
  return {
    kind: 'sheet',
    primaryFormat: 'xlsx',
    title: variant.title,
    audience: 'Finance and billing teams',
    tone: 'professional',
    executiveSummary: 'Forest-green header invoice with line items, tax, and totals.',
    sections: [{
      heading: 'Invoice workbook',
      body: 'Editable invoice sheet with bill-to block, itemized rows, and summary formulas.',
      bullets: ['Keep header band green', 'Use formula rows for subtotal, tax, and total due']
    }],
    sheet: {
      sheets: [{
        name: 'Invoice',
        columns: ['Description', 'Qty', 'Rate', 'Amount'],
        rows: [
          ['Bill to', variant.client, '', ''],
          ['Invoice date', '2026-06-18', 'Due', '2026-07-02'],
          ['', '', '', ''],
          ['Professional services', '24', '$175', '=B5*C5'],
          ['Platform subscription', '1', '$1,200', '=B6*C6'],
          ['Expense reimbursement', '1', '$420', '=B7*C7'],
          ['Subtotal', '', '', '=SUM(D5:D7)'],
          ['Tax (8.5%)', '', '', '=D8*0.085'],
          ['Total due', '', '', '=D8+D9']
        ]
      }]
    },
    citations: [{ id: 'S1', label: 'Peak reference family: Forest Excel invoice', url: 'https://excel.cloud.microsoft/create/en/templates/' }],
    nextQuestions: [],
    design: {
      template: 'executive-slate',
      headingFontFamily: 'Aptos',
      bodyFontFamily: 'Aptos',
      density: 'compact',
      palette: {
        background: '#FFFFFF',
        surface: '#ECFDF5',
        text: '#052E1B',
        muted: '#4B6B5A',
        primary: '#217346',
        accent: '#34D399'
      }
    },
    assets: []
  };
}

export const forestInvoiceVariants = invoiceVariants;