/** Kingsoft WPS Office template gallery — design reference for peak archetypes. */
export type KingsoftTemplateRef = {
  id: string;
  product: 'powerpoint' | 'excel' | 'word';
  category: string;
  wpsUrl: string;
  designMood: string;
};

export const kingsoftPowerPointRefs: KingsoftTemplateRef[] = [
  { id: 'work-summary', product: 'powerpoint', category: 'Work summary', wpsUrl: 'https://template.wps.com/templates/category/ppt/Work%20Summary-0/', designMood: 'Blue gradient fluid headers with milestone bands and KPI tiles' },
  { id: 'business-report', product: 'powerpoint', category: 'Business report', wpsUrl: 'https://template.wps.com/templates/category/ppt/Business%20Report-0/', designMood: 'Minimal purple summary blocks with chart bridges' },
  { id: 'social-media', product: 'powerpoint', category: 'Social media', wpsUrl: 'https://template.wps.com/templates/category/ppt/Social%20Media-0/', designMood: 'Fresh campaign grids with engagement metrics and icon rows' },
  { id: 'education', product: 'powerpoint', category: 'Education', wpsUrl: 'https://template.wps.com/templates/category/ppt/Education-0/', designMood: 'Playful flat stationery with step process slides' },
  { id: 'business-proposal', product: 'powerpoint', category: 'Business proposal', wpsUrl: 'https://template.wps.com/templates/category/ppt/Business%20Proposal-0/', designMood: 'Warm ivory proposal arc with scope and pricing blocks' },
  { id: 'album', product: 'powerpoint', category: 'Album', wpsUrl: 'https://template.wps.com/templates/category/ppt/Album-82/', designMood: 'Green minimal photo grid with quote proof slides' },
  { id: 'roadshow', product: 'powerpoint', category: 'Roadshow', wpsUrl: 'https://template.wps.com/templates/category/ppt/Roadshow-23/', designMood: 'Premium business pacing with investor metric walls' },
  { id: 'product', product: 'powerpoint', category: 'Product', wpsUrl: 'https://template.wps.com/templates/category/ppt/Product-140/', designMood: 'Feature grid showcase with launch timeline' },
  { id: 'medical', product: 'powerpoint', category: 'Medical', wpsUrl: 'https://template.wps.com/templates/category/ppt/Medical-93/', designMood: 'Clinical cobalt trust slides with outcomes chart' },
  { id: 'nature', product: 'powerpoint', category: 'Nature', wpsUrl: 'https://template.wps.com/templates/category/ppt/Nature-10/', designMood: 'Watercolor organic backgrounds with soft serif headings' },
  { id: 'activity-plan', product: 'powerpoint', category: 'Activity plan', wpsUrl: 'https://template.wps.com/templates/category/ppt/Activity%20Plan-0/', designMood: 'Cactus-fresh teaching plan with checklist grids' },
  { id: 'wedding', product: 'powerpoint', category: 'Wedding', wpsUrl: 'https://template.wps.com/templates/category/ppt/Wedding-80/', designMood: 'Romantic blush album pacing with timeline moments' }
];

export const kingsoftExcelRefs: KingsoftTemplateRef[] = [
  { id: 'invoices', product: 'excel', category: 'Invoices', wpsUrl: 'https://template.wps.com/templates/category/excel/Invoices-74/', designMood: 'Purple invoice tracker with status chips' },
  { id: 'income-expenditure', product: 'excel', category: 'Income & expenditure', wpsUrl: 'https://template.wps.com/templates/category/excel/Income%20%26%20Expenditure-75/', designMood: 'Cash flow bridge with variance columns' },
  { id: 'inventories', product: 'excel', category: 'Inventories', wpsUrl: 'https://template.wps.com/templates/category/excel/Inventories-98/', designMood: 'SKU reorder alerts with stock bands' },
  { id: 'charts', product: 'excel', category: 'Charts', wpsUrl: 'https://template.wps.com/templates/category/excel/Charts-119/', designMood: 'Blue sales data chart tiles with sparkline rows' },
  { id: 'plan-schedule', product: 'excel', category: 'Plan schedule', wpsUrl: 'https://template.wps.com/templates/category/excel/Plan%20Schedule-0/', designMood: 'Green work-study weekly grid with totals' },
  { id: 'financial-statement', product: 'excel', category: 'Financial statement', wpsUrl: 'https://template.wps.com/templates/category/excel/Financial%20Statement-0/', designMood: 'Simple cash flow chart with quarterly bands' },
  { id: 'sales', product: 'excel', category: 'Sales', wpsUrl: 'https://template.wps.com/templates/category/excel/Sales-0/', designMood: 'Annual performance analysis with target columns' },
  { id: 'employee', product: 'excel', category: 'Employee', wpsUrl: 'https://template.wps.com/templates/category/excel/Employee-0/', designMood: 'Mobilization approval form with role rollup' }
];

export const kingsoftWordRefs: KingsoftTemplateRef[] = [
  { id: 'resume', product: 'word', category: 'Resume', wpsUrl: 'https://template.wps.com/templates/category/word/Resume-0/', designMood: 'Simple blue ATS hierarchy with skill sidebar' },
  { id: 'letters', product: 'word', category: 'Letters', wpsUrl: 'https://template.wps.com/templates/category/word/Letters-3/', designMood: 'Fresh letterhead with ornamental header band' },
  { id: 'brochures', product: 'word', category: 'Brochures', wpsUrl: 'https://template.wps.com/templates/category/word/Brochures-29/', designMood: 'Marketing fold sections with hero imagery blocks' },
  { id: 'class-schedule', product: 'word', category: 'Class schedule', wpsUrl: 'https://template.wps.com/templates/category/word/Class%20Schedule-34/', designMood: 'Course curriculum table with week bands' },
  { id: 'poster', product: 'word', category: 'Poster', wpsUrl: 'https://template.wps.com/templates/category/word/Poster%20%26%20Wallpaper-28/', designMood: 'Bold event poster with oversized display type' },
  { id: 'study-plan', product: 'word', category: 'Study plan', wpsUrl: 'https://template.wps.com/templates/category/word/Study%20Plan-0/', designMood: 'Reading list rhythm with checklist sections' },
  { id: 'business-cards', product: 'word', category: 'Business cards', wpsUrl: 'https://template.wps.com/templates/category/word/Business%20Cards-30/', designMood: 'Light red card grid with contact hierarchy' },
  { id: 'social-media-doc', product: 'word', category: 'Social media', wpsUrl: 'https://template.wps.com/templates/category/word/Social%20Media-160/', designMood: 'Editorial social column layout with CTA blocks' }
];

const WPS_PPT_HUB = 'https://template.wps.com/templates/category/ppt/0/';
const WPS_XLS_HUB = 'https://template.wps.com/templates/category/excel/0/';
const WPS_WORD_HUB = 'https://template.wps.com/templates/category/word/0/';

export function resolveKingsoftDeckUrl(refId: string): string {
  return kingsoftPowerPointRefs.find((ref) => ref.id === refId)?.wpsUrl ?? WPS_PPT_HUB;
}

export function resolveKingsoftSheetUrl(refId: string): string {
  return kingsoftExcelRefs.find((ref) => ref.id === refId)?.wpsUrl ?? WPS_XLS_HUB;
}

export function resolveKingsoftWordUrl(refId: string): string {
  return kingsoftWordRefs.find((ref) => ref.id === refId)?.wpsUrl ?? WPS_WORD_HUB;
}