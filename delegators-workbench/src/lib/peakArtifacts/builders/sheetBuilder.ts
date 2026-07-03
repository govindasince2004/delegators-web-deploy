import type { ArtifactDocument } from '../../shared.js';
import { sheetArchetypes } from '../archetypes/sheetArchetypes.js';
import type { SheetArchetype, SheetStructure } from '../archetypes/types.js';

type SheetTab = {
  name: string;
  columns: string[];
  rows: string[][];
};

function buildSheets(archetype: SheetArchetype): SheetTab[] {
  const { entity, structure } = archetype;
  const builders: Record<SheetStructure, () => SheetTab[]> = {
    dashboard: () => [
      {
        name: 'Summary',
        columns: ['KPI', 'Value', 'Δ WoW', 'Status'],
        rows: [
          ['Revenue MTD', '$1.24M', '+8.2%', 'Above'],
          ['Pipeline', '$4.8M', '+12%', 'Above'],
          ['NPS', '61', '+4', 'Above'],
          ['Uptime', '99.97%', '+0.02pp', 'On track']
        ]
      },
      {
        name: 'KPIs',
        columns: ['Metric', 'Current', 'Target', 'Status', 'Owner', 'Trend'],
        rows: [
          ['Revenue MTD', '$1.24M', '$1.10M', 'Above', 'CFO', '▲'],
          ['Pipeline', '$4.8M', '$4.2M', 'Above', 'Sales', '▲'],
          ['NPS', '61', '55', 'Above', 'CS', '▲'],
          ['Uptime', '99.97%', '99.95%', 'On track', 'SRE', '●'],
          ['Headcount', '142', '140', 'Watch', 'HR', '▼'],
          ['Gross margin', '71%', '68%', 'Above', 'Finance', '▲']
        ]
      }
    ],
    budget: () => [{
      name: 'Annual Budget',
      columns: ['Department', 'Q1', 'Q2', 'Q3', 'Q4', 'Annual', 'Variance'],
      rows: [
        ['Engineering', '$420K', '$440K', '$460K', '$480K', '=SUM(B2:E2)', '=F2-1800000*0.25'],
        ['Sales', '$310K', '$330K', '$350K', '$390K', '=SUM(B3:E3)', '=F3-1380000*0.25'],
        ['Marketing', '$180K', '$200K', '$210K', '$240K', '=SUM(B4:E4)', '=F4-830000*0.25'],
        ['G&A', '$150K', '$150K', '$155K', '$160K', '=SUM(B5:E5)', '=F5-615000*0.25'],
        ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', '=SUM(F2:F5)', '=SUM(G2:G5)']
      ]
    }],
    'pl-statement': () => [{
      name: 'P&L',
      columns: ['Line item', 'Jan', 'Feb', 'Mar', 'Q1 total'],
      rows: [
        ['Revenue', '$820K', '$860K', '$910K', '=SUM(B2:D2)'],
        ['COGS', '$248K', '$258K', '$273K', '=SUM(B3:D3)'],
        ['Gross profit', '=B2-B3', '=C2-C3', '=D2-D3', '=E2-E3'],
        ['OpEx', '$410K', '$420K', '$435K', '=SUM(B5:D5)'],
        ['EBITDA', '=B4-B5', '=C4-C5', '=D4-D5', '=E4-E5']
      ]
    }],
    'cap-table': () => [{
      name: 'Cap Table',
      columns: ['Shareholder', 'Class', 'Shares', '% ownership', 'Investment'],
      rows: [
        ['Founders', 'Common', '6,000,000', '48%', '$0'],
        ['Seed investors', 'Preferred A', '1,500,000', '12%', '$2.5M'],
        ['Series A', 'Preferred B', '3,200,000', '25.6%', '$12M'],
        ['Option pool', 'Common', '1,800,000', '14.4%', 'Reserved'],
        ['Total', '', '=SUM(C2:C5)', '100%', '=SUM(E2:E4)']
      ]
    }],
    'okr-tracker': () => [{
      name: 'OKRs',
      columns: ['Objective', 'Key result', 'Owner', 'Start', 'Current', 'Target', 'Progress'],
      rows: [
        ['Grow enterprise ARR', 'Close 12 enterprise deals', 'Sales', '0', '7', '12', '=F2/E2'],
        ['Grow enterprise ARR', 'NDR above 120%', 'CS', '115%', '118%', '120%', '=(F3-D3)/(E3-D3)'],
        ['Ship platform v2', 'Migrate 80% of tenants', 'Eng', '0%', '52%', '80%', '=(F4-D4)/(E4-D4)']
      ]
    }],
    'sales-pipeline': () => [{
      name: 'Pipeline',
      columns: ['Account', 'Stage', 'Owner', 'Amount', 'Close date', 'Probability', 'Weighted'],
      rows: [
        ['Acme Corp', 'Proposal', 'Jordan', '$180K', '2026-07-15', '60%', '=D2*F2'],
        ['Northwind', 'Discovery', 'Marcus', '$95K', '2026-08-01', '30%', '=D3*F3'],
        ['Brightline', 'Negotiation', 'Taylor', '$240K', '2026-06-30', '80%', '=D4*F4'],
        ['Total', '', '', '=SUM(D2:D4)', '', '', '=SUM(G2:G4)']
      ]
    }],
    inventory: () => [{
      name: 'Inventory',
      columns: ['SKU', 'Product', 'On hand', 'Reserved', 'Reorder point', 'Supplier', 'Status'],
      rows: [
        ['SKU-1001', 'Trail Runner Pro', '420', '38', '200', 'Atlas Supply', 'Healthy'],
        ['SKU-2044', 'Urban Daypack', '86', '22', '120', 'Summit Goods', 'Low'],
        ['SKU-3302', 'Insulated Bottle', '1,240', '110', '400', 'HydroWorks', 'Healthy'],
        ['SKU-4410', 'Merino Sock 3pk', '64', '18', '150', 'FiberCo', 'Reorder']
      ]
    }],
    'expense-tracker': () => [{
      name: 'Expenses',
      columns: ['Date', 'Employee', 'Category', 'Description', 'Amount', 'Receipt', 'Approved'],
      rows: [
        ['2026-06-02', 'Alex M.', 'Travel', 'Client visit SF', '$428.50', 'Yes', 'Yes'],
        ['2026-06-05', 'Jordan L.', 'Software', 'Analytics seat', '$89.00', 'Yes', 'Yes'],
        ['2026-06-11', 'Riley K.', 'Meals', 'Team lunch', '$156.20', 'Yes', 'Pending'],
        ['Total', '', '', '', '=SUM(E2:E4)', '', '']
      ]
    }],
    'project-timeline': () => [{
      name: 'Timeline',
      columns: ['Task', 'Owner', 'Start', 'End', 'Duration (days)', 'Dependency', 'Status'],
      rows: [
        ['Discovery', 'PMO', '2026-06-01', '2026-06-14', '=D2-C2', '-', 'Complete'],
        ['Design', 'Design', '2026-06-15', '2026-07-05', '=D3-C3', 'Discovery', 'In progress'],
        ['Build', 'Eng', '2026-07-06', '2026-08-20', '=D4-C4', 'Design', 'Planned'],
        ['UAT', 'QA', '2026-08-21', '2026-09-05', '=D5-C5', 'Build', 'Planned']
      ]
    }],
    'headcount-plan': () => [{
      name: 'Headcount',
      columns: ['Department', 'Current HC', 'Planned hires', 'Attrition', 'EOY HC', 'Budget impact'],
      rows: [
        ['Engineering', '48', '12', '3', '=B2+C2-D2', '=$F$1*C2'],
        ['Sales', '22', '6', '2', '=B3+C3-D3', '=$F$1*C3'],
        ['Marketing', '14', '3', '1', '=B4+C4-D4', '=$F$1*C4'],
        ['G&A', '18', '2', '1', '=B5+C5-D5', '=$F$1*C5'],
        ['Avg fully loaded cost', '', '', '', '$185K', '']
      ]
    }],
    'cash-flow': () => [{
      name: 'Cash Flow',
      columns: ['Month', 'Opening cash', 'Inflows', 'Outflows', 'Net', 'Closing cash'],
      rows: [
        ['Jul', '$2.40M', '$820K', '$710K', '=C2-D2', '=B2+E2'],
        ['Aug', '=F2', '$860K', '$740K', '=C3-D3', '=B3+E3'],
        ['Sep', '=F3', '$910K', '$760K', '=C4-D4', '=B4+E4'],
        ['Oct', '=F4', '$940K', '$800K', '=C5-D5', '=B5+E5']
      ]
    }],
    'marketing-roi': () => [{
      name: 'ROI',
      columns: ['Channel', 'Spend', 'Leads', 'Opportunities', 'Revenue', 'CAC', 'ROAS'],
      rows: [
        ['Paid search', '$42K', '380', '48', '$310K', '=B2/C2', '=E2/B2'],
        ['Content', '$18K', '220', '31', '$185K', '=B3/C3', '=E3/B3'],
        ['Events', '$65K', '140', '22', '$240K', '=B4/C4', '=E4/B4'],
        ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=B5/C5', '=E5/B5']
      ]
    }],
    'customer-cohort': () => [{
      name: 'Cohorts',
      columns: ['Cohort', 'Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 6', 'Month 12'],
      rows: [
        ['2025-01', '100%', '92%', '88%', '84%', '76%', '68%'],
        ['2025-04', '100%', '94%', '90%', '87%', '79%', ''],
        ['2025-07', '100%', '95%', '91%', '89%', '', ''],
        ['2025-10', '100%', '93%', '90%', '', '', '']
      ]
    }],
    'vendor-scorecard': () => [{
      name: 'Vendors',
      columns: ['Vendor', 'Category', 'On-time %', 'Quality score', 'Cost index', 'Risk', 'Overall'],
      rows: [
        ['SupplyCo', 'Logistics', '96%', '4.6', '0.98', 'Low', 'A'],
        ['FiberCo', 'Materials', '88%', '4.1', '1.05', 'Medium', 'B'],
        ['CloudServe', 'Hosting', '99%', '4.8', '1.02', 'Low', 'A'],
        ['PrintWorks', 'Packaging', '82%', '3.9', '1.12', 'High', 'C']
      ]
    }],
    'sprint-velocity': () => [{
      name: 'Velocity',
      columns: ['Sprint', 'Committed pts', 'Completed pts', 'Carryover', 'Velocity', 'Team'],
      rows: [
        ['Sprint 18', '42', '39', '3', '=C2', 'Platform'],
        ['Sprint 19', '40', '41', '1', '=C3', 'Platform'],
        ['Sprint 20', '44', '38', '6', '=C4', 'Platform'],
        ['Average', '', '', '', '=AVERAGE(E2:E4)', '']
      ]
    }],
    'content-calendar': () => [{
      name: 'Calendar',
      columns: ['Week', 'Channel', 'Topic', 'Owner', 'Status', 'Publish date', 'CTA'],
      rows: [
        ['W26', 'Blog', 'Product launch recap', 'Harbor Press', 'Draft', '2026-06-24', 'Demo'],
        ['W26', 'LinkedIn', 'Customer story', 'Jordan', 'Scheduled', '2026-06-26', 'Case study'],
        ['W27', 'Newsletter', 'Feature digest', 'Taylor', 'Planned', '2026-07-02', 'Trial'],
        ['W27', 'Webinar', 'Analytics deep dive', 'Chris', 'Planned', '2026-07-03', 'Register']
      ]
    }],
    'attendance-log': () => [{
      name: 'Attendance',
      columns: ['Student ID', 'Name', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Total present'],
      rows: [
        ['S-1042', 'A. Johnson', 'P', 'P', 'A', 'P', 'P', '=COUNTIF(C2:G2,"P")'],
        ['S-1088', 'B. Lee', 'P', 'P', 'P', 'P', 'P', '=COUNTIF(C3:G3,"P")'],
        ['S-1120', 'C. Patel', 'P', 'A', 'P', 'P', 'P', '=COUNTIF(C4:G4,"P")']
      ]
    }],
    gradebook: () => [{
      name: 'Grades',
      columns: ['Student', 'Assignment 1', 'Assignment 2', 'Midterm', 'Final proj', 'Weighted avg', 'Letter'],
      rows: [
        ['A. Johnson', '92', '88', '90', '94', '=AVERAGE(B2:E2)', 'A'],
        ['B. Lee', '85', '90', '87', '89', '=AVERAGE(B3:E3)', 'B+'],
        ['C. Patel', '78', '82', '80', '84', '=AVERAGE(B4:E4)', 'B']
      ]
    }],
    'rental-ledger': () => [{
      name: 'Ledger',
      columns: ['Unit', 'Tenant', 'Rent due', 'Paid', 'Balance', 'Late fee', 'Next due'],
      rows: [
        ['Unit 2A', 'M. Santos', '$1,850', '$1,850', '$0', '$0', '2026-07-01'],
        ['Unit 4B', 'J. Foster', '$1,650', '$1,400', '=$C3-D3', '=$E3*0.05', '2026-07-01'],
        ['Unit 7C', 'R. Kim', '$2,100', '$2,100', '$0', '$0', '2026-07-01']
      ]
    }],
    'maintenance-schedule': () => [{
      name: 'Maintenance',
      columns: ['Asset', 'Location', 'Last service', 'Interval (days)', 'Next due', 'Technician', 'Status'],
      rows: [
        ['Compressor A', 'Plant 1', '2026-05-12', '90', '=C2+D2', 'L. Nguyen', 'Scheduled'],
        ['Conveyor 3', 'Plant 1', '2026-04-20', '60', '=C3+D3', 'D. Okonkwo', 'Overdue'],
        ['Boiler 2', 'Plant 2', '2026-06-01', '120', '=C4+D4', 'L. Nguyen', 'On track']
      ]
    }],
    'quote-estimator': () => [{
      name: 'Quote',
      columns: ['Line item', 'Qty', 'Unit cost', 'Markup %', 'Client price', 'Notes'],
      rows: [
        ['Discovery workshop', '2', '$1,200', '25%', '=B2*C2*(1+D2)', 'On-site'],
        ['UI design sprint', '1', '$8,500', '20%', '=B3*C3*(1+D3)', '2-week sprint'],
        ['Build phase', '160', '$175', '30%', '=B4*C4*(1+D4)', 'Engineering hours'],
        ['Total', '', '', '', '=SUM(E2:E4)', entity]
      ]
    }],
    'commission-calc': () => [{
      name: 'Commissions',
      columns: ['Rep', 'Quota', 'Closed', 'Attainment', 'Base commission', 'Accelerator', 'Total payout'],
      rows: [
        ['Jordan Lee', '$500K', '$620K', '=C2/B2', '$31K', '=$F$1*MAX(C2-B2,0)', '=E2+F2'],
        ['Marcus Reed', '$600K', '$540K', '=C3/B3', '$27K', '=$F$1*MAX(C3-B3,0)', '=E3+F3'],
        ['Accelerator rate', '', '', '', '', '8%', '']
      ]
    }],
    'fleet-dispatch': () => [{
      name: 'Dispatch',
      columns: ['Route', 'Driver', 'Vehicle', 'Stops', 'ETA', 'Miles', 'Status'],
      rows: [
        ['R-101', 'K. Adams', 'Van 12', '14', '14:30', '86', 'En route'],
        ['R-102', 'S. Ortiz', 'Van 07', '11', '15:10', '62', 'Loading'],
        ['R-103', 'M. Rao', 'Truck 03', '8', '16:45', '124', 'Delayed']
      ]
    }],
    'recipe-costing': () => [{
      name: 'Recipe',
      columns: ['Ingredient', 'Qty', 'Unit', 'Unit cost', 'Line cost', 'Yield %', 'Adjusted cost'],
      rows: [
        ['Salmon fillet', '6', 'oz', '$4.20', '=B2*D2', '95%', '=E2/F2'],
        ['Seasonal veg', '8', 'oz', '$1.10', '=B3*D3', '100%', '=E3/F3'],
        ['Herb butter', '2', 'oz', '$0.85', '=B4*D4', '100%', '=E4/F4'],
        ['Plate cost', '', '', '', '=SUM(G2:G4)', '', '']
      ]
    }],
    'donation-tracker': () => [{
      name: 'Donations',
      columns: ['Donor', 'Type', 'Amount', 'Date', 'Campaign', 'Receipt sent', 'Notes'],
      rows: [
        ['Riverbend LLC', 'Corporate', '$25,000', '2026-06-03', 'Summer drive', 'Yes', 'Matching gift'],
        ['A. Chen', 'Individual', '$500', '2026-06-08', 'General', 'Yes', ''],
        ['Summit Foundation', 'Grant', '$50,000', '2026-06-15', 'STEM labs', 'Pending', 'Installment 1']
      ]
    }],
    'event-budget': () => [{
      name: 'Event Budget',
      columns: ['Category', 'Budgeted', 'Actual', 'Variance', 'Vendor', 'Owner', 'Status'],
      rows: [
        ['Venue', '$45K', '$42K', '=C2-B2', 'Metro Hall', 'Olivia', 'Paid'],
        ['Catering', '$28K', '$0', '=C3-B3', 'Harbor Kitchen', 'Daniel', 'PO issued'],
        ['AV production', '$18K', '$16.5K', '=C4-B4', 'Bright AV', 'Casey', 'Paid'],
        ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=C5-B5', '', '', '']
      ]
    }],
    'social-metrics': () => [{
      name: 'Social',
      columns: ['Platform', 'Followers', 'Posts', 'Impressions', 'Engagement rate', 'Clicks', 'Conversions'],
      rows: [
        ['LinkedIn', '18,400', '12', '142K', '4.8%', '2,840', '186'],
        ['Instagram', '9,200', '18', '96K', '6.1%', '1,420', '94'],
        ['X', '6,800', '24', '58K', '3.2%', '980', '41']
      ]
    }],
    'risk-register': () => [{
      name: 'Risks',
      columns: ['Risk', 'Category', 'Likelihood', 'Impact', 'Score', 'Owner', 'Mitigation', 'Status'],
      rows: [
        ['Vendor delay', 'Schedule', 'Medium', 'High', '=C2*D2', 'PMO', 'Secondary supplier', 'Open'],
        ['Scope creep', 'Scope', 'High', 'Medium', '=C3*D3', 'Sponsor', 'Change control board', 'Monitoring'],
        ['Data migration', 'Technical', 'Medium', 'High', '=C4*D4', 'Eng', 'Rehearsal cutover', 'Open']
      ]
    }],
    'asset-depreciation': () => [{
      name: 'Depreciation',
      columns: ['Asset', 'Cost', 'Useful life (yr)', 'Salvage', 'Annual depr', 'Accum depr', 'Book value'],
      rows: [
        ['Server cluster', '$240K', '5', '$20K', '=(B2-D2)/C2', '=$F$1*E2', '=B2-F2'],
        ['CNC machine', '$180K', '7', '$15K', '=(B3-D3)/C3', '=$F$1*E3', '=B3-F3'],
        ['Years elapsed', '', '', '', '', '2', '']
      ]
    }],
    timesheet: () => [{
      name: 'Timesheet',
      columns: ['Week ending', 'Project', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Total hrs', 'Rate', 'Amount'],
      rows: [
        ['2026-06-13', 'ERP migration', '6', '8', '7', '8', '4', '=SUM(C2:G2)', '$175', '=H2*I2'],
        ['2026-06-13', 'Advisory', '2', '0', '1', '0', '0', '=SUM(C3:G3)', '$200', '=H3*I3'],
        ['Totals', '', '', '', '', '', '', '=SUM(H2:H3)', '', '=SUM(J2:J3)']
      ]
    }],
    'price-comparison': () => [{
      name: 'Comparison',
      columns: ['Item', 'Vendor A', 'Vendor B', 'Vendor C', 'Lowest', 'Savings vs max'],
      rows: [
        ['Laptops (50)', '$62K', '$58K', '$60K', '=MIN(B2:D2)', '=MAX(B2:D2-E2)'],
        ['Monitors (50)', '$18K', '$17K', '$19K', '=MIN(B3:D3)', '=MAX(B3:D3-E3)'],
        ['Docking stations', '$9K', '$8.5K', '$9.2K', '=MIN(B4:D4)', '=MAX(B4:D4-E4)']
      ]
    }],
    'survey-results': () => [{
      name: 'Survey',
      columns: ['Question', 'Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Response rate', 'eNPS'],
      rows: [
        ['I have tools to do my job', '42%', '38%', '14%', '6%', '88%', ''],
        ['I trust leadership', '36%', '40%', '18%', '6%', '88%', ''],
        ['I would recommend employer', '34%', '41%', '17%', '8%', '88%', '34']
      ]
    }]
  };
  return builders[structure]();
}

export function buildSheetArtifact(archetypeId: string): ArtifactDocument | undefined {
  const archetype = sheetArchetypes.find((item) => item.id === archetypeId);
  if (!archetype) return undefined;

  const sheets = buildSheets(archetype);

  return {
    kind: 'sheet',
    primaryFormat: 'xlsx',
    title: archetype.title,
    audience: archetype.audience,
    tone: archetype.tone,
    executiveSummary: `${archetype.structure.replace(/-/g, ' ')} workbook for ${archetype.entity} with styled headers and formula-ready rows.`,
    sections: [{
      heading: `${archetype.category} workbook`,
      body: `Editable ${archetype.structure.replace(/-/g, ' ')} sheet with ${sheets[0].columns.length} columns and structured data rows.`,
      bullets: [
        `Header band uses ${archetype.palette.primary} from design palette`,
        `Entity context: ${archetype.entity}`,
        'Preserve formula rows when customizing line items'
      ]
    }],
    sheet: { sheets },
    citations: [{ id: 'S1', label: `Peak reference: ${archetype.category}`, url: 'https://excel.cloud.microsoft/create/en/templates/' }],
    nextQuestions: [],
    design: {
      template: archetype.template,
      headingFontFamily: archetype.headingFont,
      bodyFontFamily: archetype.bodyFont,
      density: archetype.density ?? 'compact',
      palette: archetype.palette
    },
    assets: []
  };
}

export function buildAllSheetArtifacts(): ArtifactDocument[] {
  return sheetArchetypes
    .map((item) => buildSheetArtifact(item.id))
    .filter((item): item is ArtifactDocument => Boolean(item));
}