import type { ArtifactDocument, ArtifactSection } from '../../shared.js';
import { reportArchetypes } from '../archetypes/reportArchetypes.js';
import type { ReportArchetype, ReportStructure } from '../archetypes/types.js';

function buildSections(archetype: ReportArchetype): ArtifactSection[] {
  const { orgName, subject, structure } = archetype;
  const builders: Record<ReportStructure, () => ArtifactSection[]> = {
    'annual-report': () => [
      { heading: 'Letter from leadership', body: `${orgName} annual review covering ${subject}.`, bullets: ['Revenue up 18% year over year', 'Expanded into two new regions', 'Invested in platform reliability'] },
      { heading: 'Financial highlights', body: 'Key metrics for shareholders and board review.', bullets: [], table: { columns: ['Metric', '2024', '2025', 'Change'], rows: [['Revenue', '$42M', '$49M', '+18%'], ['Gross margin', '62%', '64%', '+2pp'], ['Operating cash', '$8.1M', '$9.6M', '+19%']] } },
      { heading: 'Strategic priorities', body: 'Three focus areas for the coming fiscal year.', bullets: ['Product-led expansion', 'Operational excellence', 'Talent and culture'] },
      { heading: 'ESG snapshot', body: 'Environmental and community commitments.', bullets: [], chart: { type: 'bar', title: 'Emissions reduction (%)', labels: ['2023', '2024', '2025'], series: [{ name: 'Scope 1+2', values: [100, 88, 76] }] } },
      { heading: 'Outlook', body: 'Management guidance and risk factors.', bullets: ['Macro demand remains stable', 'Pipeline coverage at 3.2x quota'] }
    ],
    whitepaper: () => [
      { heading: 'Executive summary', body: `Technical overview of ${subject} from ${orgName}.`, bullets: ['Problem framing', 'Architecture principles', 'Deployment patterns'] },
      { heading: 'Market context', body: 'Why edge inference matters now.', bullets: ['Latency-sensitive workloads', 'Data residency requirements', 'Cost curve shifts'] },
      { heading: 'Reference architecture', body: 'Layered system design with control and data planes.', bullets: [], table: { columns: ['Layer', 'Component', 'Responsibility'], rows: [['Edge', 'Inference node', 'Local scoring'], ['Mesh', 'Orchestrator', 'Routing and failover'], ['Cloud', 'Training cluster', 'Model refresh']] } },
      { heading: 'Performance benchmarks', body: 'Representative throughput and latency results.', bullets: [], chart: { type: 'line', title: 'p99 latency (ms)', labels: ['1k', '5k', '10k', '25k'], series: [{ name: 'Edge', values: [12, 18, 24, 31] }, { name: 'Cloud', values: [45, 62, 88, 120] }] } },
      { heading: 'Implementation checklist', body: 'Steps for platform teams adopting the pattern.', bullets: ['Define SLOs', 'Instrument observability', 'Plan rollout phases'] }
    ],
    'case-study': () => [
      { heading: 'Client overview', body: `${subject} delivered by ${orgName}.`, bullets: ['Industry: omnichannel retail', 'Scope: 120 stores', 'Timeline: 9 months'] },
      { heading: 'Challenge', body: 'Fragmented inventory and slow fulfillment.', bullets: ['Stockouts on high-velocity SKUs', 'Manual reconciliation across channels'] },
      { heading: 'Solution', body: 'Unified commerce platform with real-time sync.', bullets: [], table: { columns: ['Capability', 'Before', 'After'], rows: [['Order accuracy', '91%', '99.2%'], ['Fulfillment time', '3.2 days', '1.1 days'], ['Return rate', '8.4%', '5.1%']] } },
      { heading: 'Results', body: 'Measurable business impact within two quarters.', bullets: [], chart: { type: 'column', title: 'Revenue lift by quarter', labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Lift %', values: [4, 9, 14, 18] }] } },
      { heading: 'Client quote', body: 'The rollout gave our stores a single source of truth within weeks.', bullets: ['VP Operations, Meridian Retail'] }
    ],
    'policy-brief': () => [
      { heading: 'Policy question', body: `Should the city adopt integrated fare policy for ${subject}?`, bullets: ['Equity impacts', 'Revenue effects', 'Implementation timeline'] },
      { heading: 'Background', body: 'Current transit fare structure and rider demographics.', bullets: ['Three overlapping fare products', 'Low-income riders face highest effective cost'] },
      { heading: 'Options analysis', body: 'Three policy alternatives with tradeoffs.', bullets: [], table: { columns: ['Option', 'Cost', 'Ridership impact'], rows: [['Status quo', '$0', 'Baseline'], ['Unified pass', '$12M/yr', '+8%'], ['Income-based subsidy', '$18M/yr', '+14%']] } },
      { heading: 'Recommendation', body: 'Phased unified pass with targeted subsidies.', bullets: ['Pilot on two corridors', 'Evaluate after 12 months'] }
    ],
    'research-memo': () => [
      { heading: 'Key findings', body: `${orgName} memo on ${subject}.`, bullets: ['Discretionary spend softened 6%', 'Premium categories resilient', 'Digital adoption accelerating'] },
      { heading: 'Methodology', body: 'Panel survey of 4,200 households plus transaction cohorts.', bullets: ['Field dates: Apr–May 2026', 'Confidence interval: 95%'] },
      { heading: 'Segment breakdown', body: 'Spend shifts by income band.', bullets: [], table: { columns: ['Segment', 'YoY change', 'Top category'], rows: [['High income', '-2%', 'Travel'], ['Middle income', '-7%', 'Home'], ['Lower income', '-11%', 'Essentials']] } },
      { heading: 'Implications', body: 'Product and pricing actions for Q3 planning.', bullets: ['Bundle value offers', 'Shift media to retention'] }
    ],
    'brand-guidelines': () => [
      { heading: 'Brand essence', body: `${orgName} identity system for ${subject}.`, bullets: ['Confident', 'Human', 'Precise'] },
      { heading: 'Logo usage', body: 'Clear space, minimum size, and misuse examples.', bullets: ['Minimum width: 120px', 'Never stretch or rotate', 'Use approved colorways only'] },
      { heading: 'Color palette', body: 'Primary, secondary, and neutral tokens.', bullets: [], table: { columns: ['Token', 'Hex', 'Usage'], rows: [['Primary', '#5B2EFF', 'CTAs and headers'], ['Accent', '#FF5C00', 'Highlights'], ['Neutral', '#14101F', 'Body text']] } },
      { heading: 'Typography', body: 'Heading and body pairings with scale.', bullets: ['Display: Aptos Display', 'Body: Aptos', 'Line height: 1.5 for paragraphs'] },
      { heading: 'Voice and tone', body: 'Writing principles for marketing and product.', bullets: ['Lead with outcomes', 'Avoid jargon', 'Use active voice'] }
    ],
    'market-analysis': () => [
      { heading: 'Market definition', body: `${subject} prepared by ${orgName}.`, bullets: ['TAM: $18B', 'SAM: $4.2B', 'SOM: $620M'] },
      { heading: 'Growth drivers', body: 'Macro and technology tailwinds.', bullets: ['Cloud migration', 'Vertical specialization', 'Usage-based pricing'] },
      { heading: 'Competitive map', body: 'Category leaders and whitespace.', bullets: [], table: { columns: ['Vendor', 'Focus', 'Strength'], rows: [['Incumbent A', 'Horizontal', 'Distribution'], ['Challenger B', 'Vertical', 'Workflow depth'], ['Emerging C', 'AI-native', 'Automation']] } },
      { heading: 'Forecast', body: 'Five-year category CAGR estimate.', bullets: [], chart: { type: 'area', title: 'Market size ($B)', labels: ['2026', '2027', '2028', '2029', '2030'], series: [{ name: 'APAC SaaS', values: [4.2, 5.1, 6.3, 7.8, 9.4] }] } }
    ],
    'impact-report': () => [
      { heading: 'Mission at a glance', body: `${orgName} ${subject}.`, bullets: ['12,400 people served', '86 partner organizations', '340 active volunteers'] },
      { heading: 'Program outcomes', body: 'Results by initiative.', bullets: [], table: { columns: ['Program', 'Participants', 'Outcome'], rows: [['Youth mentorship', '1,200', '92% graduation support'], ['Food access', '8,400', '1.8M meals distributed'], ['Workforce training', '2,800', '74% job placement']] } },
      { heading: 'Stories', body: 'Community voices from the past year.', bullets: ['Maria: first-generation college admit', 'James: small business microgrant recipient'] },
      { heading: 'Financial stewardship', body: 'How donations were allocated.', bullets: [], chart: { type: 'donut', title: 'Fund allocation', labels: ['Programs', 'Operations', 'Fundraising'], series: [{ name: 'Share', values: [78, 14, 8] }] } }
    ],
    'technical-spec': () => [
      { heading: 'Scope', body: `${orgName} specification for ${subject}.`, bullets: ['Authentication flows', 'Rate limiting', 'Observability hooks'] },
      { heading: 'API contracts', body: 'Endpoint summary and payload schemas.', bullets: [], table: { columns: ['Endpoint', 'Method', 'Purpose'], rows: [['/v1/routes', 'POST', 'Register route'], ['/v1/health', 'GET', 'Liveness probe'], ['/v1/metrics', 'GET', 'Prometheus export']] } },
      { heading: 'Security requirements', body: 'Mandatory controls for production deployment.', bullets: ['mTLS between services', 'OIDC for user auth', 'Audit log retention 400 days'] },
      { heading: 'SLA targets', body: 'Availability and latency commitments.', bullets: ['99.95% uptime', 'p99 < 120ms for auth'] }
    ],
    'user-manual': () => [
      { heading: 'Getting started', body: `${orgName} guide for ${subject}.`, bullets: ['Create your account', 'Connect integrations', 'Invite teammates'] },
      { heading: 'Core workflows', body: 'Step-by-step task flows.', bullets: [], table: { columns: ['Task', 'Steps', 'Tips'], rows: [['Import data', '3', 'Use CSV template'], ['Build report', '5', 'Save as template'], ['Share dashboard', '2', 'Set permissions']] } },
      { heading: 'Troubleshooting', body: 'Common issues and fixes.', bullets: ['Sync delays: check API key', 'Export fails: reduce date range'] },
      { heading: 'Keyboard shortcuts', body: 'Productivity shortcuts for power users.', bullets: ['Ctrl+K: command palette', 'Ctrl+S: save view'] }
    ],
    'compliance-audit': () => [
      { heading: 'Audit scope', body: `${orgName} SOC 2 Type II summary for ${subject}.`, bullets: ['Security', 'Availability', 'Confidentiality'] },
      { heading: 'Control results', body: 'Testing outcomes by domain.', bullets: [], table: { columns: ['Control area', 'Tested', 'Exceptions'], rows: [['Access management', '24', '0'], ['Change management', '18', '1'], ['Incident response', '12', '0']] } },
      { heading: 'Remediation', body: 'Open items and owners.', bullets: ['Change ticket linkage — due Jul 2026', 'Vendor review cadence — due Aug 2026'] },
      { heading: 'Management assertion', body: 'Leadership attestation of control effectiveness.', bullets: ['No material weaknesses identified'] }
    ],
    'quarterly-review': () => [
      { heading: 'Quarter snapshot', body: `${orgName} Q2 review: ${subject}.`, bullets: ['ARR: $7.8M', 'Net retention: 118%', 'Gross margin: 71%'] },
      { heading: 'Revenue bridge', body: 'New, expansion, contraction, and churn.', bullets: [], chart: { type: 'bar', title: 'ARR bridge ($K)', labels: ['Opening', 'New', 'Expansion', 'Churn', 'Closing'], series: [{ name: 'ARR', values: [6200, 1100, 800, -300, 7800] }] } },
      { heading: 'Go-to-market', body: 'Pipeline and conversion metrics.', bullets: [], table: { columns: ['Stage', 'Count', 'Value'], rows: [['Qualified', '84', '$2.1M'], ['Proposal', '31', '$980K'], ['Closed won', '19', '$640K']] } },
      { heading: 'Operating priorities', body: 'Focus for next quarter.', bullets: ['Launch enterprise tier', 'Reduce support backlog 30%'] }
    ],
    'feasibility-study': () => [
      { heading: 'Project overview', body: `${orgName} feasibility analysis: ${subject}.`, bullets: ['1.2 MW planned capacity', 'Roof and carport sites', '25-year useful life'] },
      { heading: 'Financial model', body: 'Capital cost, incentives, and payback.', bullets: [], table: { columns: ['Item', 'Amount', 'Notes'], rows: [['CAPEX', '$2.8M', 'Turnkey EPC'], ['Incentives', '-$620K', 'State and utility'], ['Annual savings', '$410K', 'Utility offset']] } },
      { heading: 'Risk assessment', body: 'Permitting, structural, and tariff risks.', bullets: ['Structural review required for Building C', 'Interconnection queue 4–6 months'] },
      { heading: 'Recommendation', body: 'Proceed with phased installation starting Q4.', bullets: ['Phase 1: 600 kW rooftop', 'Phase 2: carport expansion'] }
    ],
    'grant-proposal': () => [
      { heading: 'Organization summary', body: `${orgName} proposal for ${subject}.`, bullets: ['Serving 14 districts', '8 years of STEM programming', 'Partnership with 22 schools'] },
      { heading: 'Need statement', body: 'Gap in hands-on STEM access after school.', bullets: ['Only 34% of target schools have maker labs', 'Teacher training hours below state average'] },
      { heading: 'Program design', body: 'Maker lab curriculum and staffing model.', bullets: [], table: { columns: ['Activity', 'Hours/wk', 'Students'], rows: [['Robotics', '6', '180'], ['Coding', '6', '220'], ['Design', '4', '150']] } },
      { heading: 'Budget', body: 'Three-year funding request and match.', bullets: ['Request: $1.2M', 'Local match: $340K', 'Outcomes: 2,400 students served'] }
    ],
    'sustainability-report': () => [
      { heading: 'CEO message', body: `${orgName} ${subject}.`, bullets: ['Committed to net-zero by 2040', 'Science-based targets validated'] },
      { heading: 'Environmental performance', body: 'Emissions, energy, and water metrics.', bullets: [], table: { columns: ['Metric', '2024', '2025', 'Target'], rows: [['Scope 1+2 (tCO2e)', '18,400', '15,200', '14,000'], ['Renewable %', '38%', '52%', '60%'], ['Water (ML)', '4.1', '3.6', '3.2']] } },
      { heading: 'Supply chain', body: 'Supplier engagement and audits.', bullets: ['86% of spend covered by code of conduct', '12 on-site audits completed'] },
      { heading: 'Progress chart', body: 'Emissions trajectory vs baseline.', bullets: [], chart: { type: 'line', title: 'Emissions index', labels: ['2022', '2023', '2024', '2025'], series: [{ name: 'Index', values: [100, 92, 84, 76] }] } }
    ],
    'product-brief': () => [
      { heading: 'Problem statement', body: `${orgName} brief for ${subject}.`, bullets: ['Checkout friction on mobile', 'Low wallet adoption among new users'] },
      { heading: 'Target users', body: 'Primary personas and jobs to be done.', bullets: [], table: { columns: ['Persona', 'Need', 'Pain'], rows: [['Urban commuter', 'Fast pay', 'Multiple apps'], ['Small merchant', 'Low fees', 'Settlement delays']] } },
      { heading: 'MVP scope', body: 'Features in v1 release.', bullets: ['One-tap pay', 'Loyalty integration', 'Spending insights'] },
      { heading: 'Success metrics', body: 'Launch KPIs for 90-day window.', bullets: ['Activation rate 45%', 'Week-4 retention 62%'] }
    ],
    'competitive-landscape': () => [
      { heading: 'Category overview', body: `${orgName} landscape for ${subject}.`, bullets: ['12 vendors mapped', 'Three consolidation trends', 'AI features now table stakes'] },
      { heading: 'Feature matrix', body: 'Capability comparison across leaders.', bullets: [], table: { columns: ['Capability', 'Us', 'Leader A', 'Leader B'], rows: [['Payroll sync', 'Yes', 'Yes', 'Partial'], ['AI scheduling', 'Yes', 'No', 'Yes'], ['Mobile app', 'Yes', 'Yes', 'Yes']] } },
      { heading: 'Positioning', body: 'Differentiation narrative for sales.', bullets: ['Mid-market focus', 'Faster implementation', 'Transparent pricing'] },
      { heading: 'Win/loss themes', body: 'Patterns from last two quarters.', bullets: ['Wins: integration depth', 'Losses: brand awareness in enterprise'] }
    ],
    'onboarding-playbook': () => [
      { heading: 'Onboarding goals', body: `${orgName} playbook for ${subject}.`, bullets: ['Time to first value < 14 days', 'Health score green by day 30'] },
      { heading: 'Phase plan', body: 'Kickoff through expansion.', bullets: [], table: { columns: ['Phase', 'Duration', 'Milestone'], rows: [['Kickoff', 'Week 1', 'Success plan signed'], ['Configure', 'Weeks 2–3', 'Core workflows live'], ['Adopt', 'Weeks 4–6', '80% active users']] } },
      { heading: 'RACI', body: 'Roles for customer and internal teams.', bullets: ['CSM: orchestration', 'Solutions: technical setup', 'Customer champion: adoption'] },
      { heading: 'Health scoring', body: 'Signals that trigger intervention.', bullets: ['Login frequency', 'Key workflow completion', 'Support ticket volume'] }
    ],
    'training-handbook': () => [
      { heading: 'Program overview', body: `${orgName} ${subject}.`, bullets: ['6 modules', '12 hours total', 'Certification quiz included'] },
      { heading: 'Module map', body: 'Learning objectives by module.', bullets: [], table: { columns: ['Module', 'Topic', 'Duration'], rows: [['1', 'Discovery', '2h'], ['2', 'Demo craft', '2h'], ['3', 'Negotiation', '3h']] } },
      { heading: 'Role plays', body: 'Practice scenarios with rubrics.', bullets: ['Discovery call', 'Pricing objection', 'Executive close'] },
      { heading: 'Assessment', body: 'Certification criteria.', bullets: ['80% quiz score', 'Manager shadow sign-off'] }
    ],
    'event-program': () => [
      { heading: 'Welcome', body: `${orgName} ${subject}.`, bullets: ['June 24–26, 2026', '1,200 registered attendees', '48 speakers'] },
      { heading: 'Day 1 schedule', body: 'Keynotes and breakout tracks.', bullets: [], table: { columns: ['Time', 'Session', 'Room'], rows: [['9:00', 'Opening keynote', 'Main hall'], ['11:00', 'AI product track', 'Hall B'], ['14:00', 'Founder panels', 'Hall C']] } },
      { heading: 'Sponsors', body: 'Partner showcase and demo hours.', bullets: ['Platinum: 6 partners', 'Demo hall open 10:00–17:00'] },
      { heading: 'Networking', body: 'Evening receptions and meetups.', bullets: ['Day 1: rooftop reception', 'Day 2: sector roundtables'] }
    ],
    'newsletter-digest': () => [
      { heading: 'Edition overview', body: `${orgName} ${subject}.`, bullets: ['June 2026', 'Product updates', 'Community spotlight'] },
      { heading: 'Release highlights', body: 'What shipped this month.', bullets: ['Async comments 2.0', 'Dashboard templates', 'Mobile performance improvements'] },
      { heading: 'Tips and tricks', body: 'Power-user workflows.', bullets: [], table: { columns: ['Tip', 'Benefit'], rows: [['Saved views', 'Faster reporting'], ['Keyboard shortcuts', 'Less context switching']] } },
      { heading: 'Community', body: 'Featured customer story and events.', bullets: ['Customer meetup July 12', 'Office hours every Thursday'] }
    ],
    'press-kit': () => [
      { heading: 'Company boilerplate', body: `${orgName} ${subject}.`, bullets: ['Founded 2019', 'HQ: San Francisco', '140 employees'] },
      { heading: 'Leadership bios', body: 'Executive team summaries.', bullets: [], table: { columns: ['Name', 'Title', 'Background'], rows: [['Alex Kim', 'CEO', 'Robotics, MIT'], ['Jordan Lee', 'CTO', 'Autonomy systems']] } },
      { heading: 'Fact sheet', body: 'Key metrics for media reference.', bullets: ['Series C: $85M', 'Deployed in 12 countries'] },
      { heading: 'Media assets', body: 'Logo, photography, and b-roll availability.', bullets: ['PNG and SVG logos', 'Product screenshots upon request'] }
    ],
    'investor-memo': () => [
      { heading: 'Investment thesis', body: `${orgName} ${subject}.`, bullets: ['Category leader in climate intelligence', 'Capital-efficient GTM', 'Strong unit economics'] },
      { heading: 'Traction', body: 'Revenue and retention snapshot.', bullets: [], table: { columns: ['Metric', 'Value'], rows: [['ARR', '$6.2M'], ['NDR', '128%'], ['Gross margin', '78%']] } },
      { heading: 'Use of funds', body: 'Allocation of $18M Series B.', bullets: ['45% product and R&D', '35% sales and marketing', '20% operations'] },
      { heading: 'Market', body: 'TAM expansion and competitive moat.', bullets: [], chart: { type: 'area', title: 'ARR projection ($M)', labels: ['2026', '2027', '2028'], series: [{ name: 'Base', values: [6.2, 11.5, 19.8] }] } }
    ],
    'legal-brief': () => [
      { heading: 'Transaction summary', body: `${orgName} brief on ${subject}.`, bullets: ['Stock purchase agreement', 'Closing target: Sep 2026', 'Purchase price: $240M'] },
      { heading: 'Key terms', body: 'Material provisions under review.', bullets: [], table: { columns: ['Term', 'Status'], rows: [['Indemnity cap', 'Agreed'], ['MAC clause', 'Negotiating'], ['Employee retention', 'Draft']] } },
      { heading: 'Risk factors', body: 'Legal and regulatory considerations.', bullets: ['Antitrust filing in two jurisdictions', 'IP assignment completeness'] },
      { heading: 'Next steps', body: 'Closing checklist and timeline.', bullets: ['Board approval', 'HSR filing', 'Integration planning kickoff'] }
    ],
    'clinical-summary': () => [
      { heading: 'Study overview', body: `${orgName} ${subject}.`, bullets: ['Phase II, randomized', 'N=420', 'Primary endpoint: symptom reduction'] },
      { heading: 'Endpoints', body: 'Efficacy and safety results.', bullets: [], table: { columns: ['Endpoint', 'Treatment', 'Placebo', 'p-value'], rows: [['Primary', '-34%', '-12%', '<0.01'], ['Secondary A', '-28%', '-15%', '0.02']] } },
      { heading: 'Safety', body: 'Adverse event profile.', bullets: ['Serious AEs: 2.1% treatment vs 2.4% placebo', 'No deaths attributed to study drug'] },
      { heading: 'Conclusion', body: 'Supports advancement to Phase III.', bullets: ['Dose selected: 200mg', 'Enrollment start Q1 2027'] }
    ],
    'curriculum-guide': () => [
      { heading: 'Program overview', body: `${orgName} ${subject}.`, bullets: ['36 credit hours', 'STEM designation', 'Capstone with industry partner'] },
      { heading: 'Course sequence', body: 'Recommended path by semester.', bullets: [], table: { columns: ['Term', 'Course', 'Credits'], rows: [['Fall Y1', 'Statistics for DS', '3'], ['Spring Y1', 'Machine Learning', '3'], ['Fall Y2', 'Capstone', '6']] } },
      { heading: 'Learning outcomes', body: 'Skills graduates will demonstrate.', bullets: ['Build reproducible pipelines', 'Communicate insights to stakeholders'] },
      { heading: 'Advising', body: 'Prerequisites and transfer credit policy.', bullets: ['Calculus I required', 'Python proficiency recommended'] }
    ],
    'safety-protocol': () => [
      { heading: 'Purpose', body: `${orgName} ${subject}.`, bullets: ['Prevent injuries', 'Ensure OSHA compliance', 'Standardize incident response'] },
      { heading: 'PPE requirements', body: 'Mandatory equipment by zone.', bullets: [], table: { columns: ['Zone', 'PPE', 'Inspection'], rows: [['Loading dock', 'Vest, gloves, boots', 'Daily'], ['Forklift area', 'Helmet, vest', 'Per shift']] } },
      { heading: 'Incident response', body: 'Steps when an injury or near-miss occurs.', bullets: ['Secure area', 'Notify supervisor', 'Document within 1 hour'] },
      { heading: 'Audit checklist', body: 'Monthly safety walkthrough items.', bullets: ['Exits clear', 'Fire extinguishers tagged', 'Spill kits stocked'] }
    ],
    'project-charter': () => [
      { heading: 'Project purpose', body: `${orgName} charter for ${subject}.`, bullets: ['Replace legacy ERP', 'Go-live: Mar 2027', 'Budget: $4.2M'] },
      { heading: 'Scope', body: 'In-scope modules and exclusions.', bullets: [], table: { columns: ['Module', 'In scope', 'Owner'], rows: [['Finance', 'Yes', 'CFO office'], ['HR', 'Phase 2', 'HRIS lead'], ['Supply chain', 'Yes', 'Ops']] } },
      { heading: 'RACI', body: 'Governance and decision rights.', bullets: ['Executive sponsor: COO', 'PMO lead: daily coordination'] },
      { heading: 'Success criteria', body: 'Measurable outcomes at launch.', bullets: ['Close books within 5 days', '99.5% inventory accuracy'] }
    ],
    postmortem: () => [
      { heading: 'Incident summary', body: `${orgName} ${subject}.`, bullets: ['Duration: 47 minutes', 'Severity: SEV-1', 'Customer impact: 18% of API traffic'] },
      { heading: 'Timeline', body: 'Minute-by-minute sequence.', bullets: [], table: { columns: ['Time (UTC)', 'Event'], rows: [['14:02', 'Error rate spike'], ['14:18', 'Rollback initiated'], ['14:49', 'Service restored']] } },
      { heading: 'Root cause', body: 'Config change propagated to all regions.', bullets: ['Missing canary gate', 'Insufficient cache warming'] },
      { heading: 'Action items', body: 'Preventive measures with owners.', bullets: ['Add regional canary — Eng', 'Update runbook — SRE', 'Customer comms template — Support'] }
    ],
    'rfp-response': () => [
      { heading: 'Executive summary', body: `${orgName} response for ${subject}.`, bullets: ['Meets 98% of mandatory requirements', '18-week implementation', 'Fixed-price option available'] },
      { heading: 'Requirements mapping', body: 'Traceability to RFP sections.', bullets: [], table: { columns: ['RFP ref', 'Requirement', 'Compliance'], rows: [['3.1', 'SSO/SAML', 'Full'], ['3.4', 'Data residency', 'Full'], ['4.2', 'Custom reports', 'Partial']] } },
      { heading: 'Implementation plan', body: 'Phased rollout with milestones.', bullets: ['Discovery: 3 weeks', 'Pilot: 4 weeks', 'Enterprise rollout: 11 weeks'] },
      { heading: 'Pricing', body: 'Three-year TCO summary.', bullets: ['Year 1: $1.1M', 'Years 2–3: $820K/yr'] }
    ],
    'style-guide': () => [
      { heading: 'Voice principles', body: `${orgName} ${subject}.`, bullets: ['Clear', 'Inclusive', 'Evidence-based'] },
      { heading: 'Grammar and punctuation', body: 'House rules for writers.', bullets: ['Oxford comma: yes', 'Em dash with spaces: no', 'Percent: use % symbol'] },
      { heading: 'Formatting', body: 'Headings, lists, and citations.', bullets: [], table: { columns: ['Element', 'Rule'], rows: [['H1', 'Title case'], ['Bullets', 'Sentence case'], ['Citations', 'Author-date']] } },
      { heading: 'Inclusive language', body: 'Preferred terms and alternatives.', bullets: ['Use person-first language', 'Avoid idioms that do not translate'] }
    ],
    'community-report': () => [
      { heading: 'Neighborhood profile', body: `${orgName} ${subject}.`, bullets: ['Population: 24,800', 'Median age: 34', 'Transit score: 72'] },
      { heading: 'Priority themes', body: 'Top concerns from town halls.', bullets: [], table: { columns: ['Theme', 'Mentions', 'Trend'], rows: [['Housing affordability', '186', 'Up'], ['Transit frequency', '142', 'Stable'], ['Parks maintenance', '98', 'Up']] } },
      { heading: 'Proposed initiatives', body: 'Council recommendations for FY2027.', bullets: ['Affordable units near transit', 'Weekend bus frequency pilot'] },
      { heading: 'Engagement', body: 'Participation metrics.', bullets: [], chart: { type: 'bar', title: 'Town hall attendance', labels: ['Jan', 'Mar', 'May'], series: [{ name: 'Attendees', values: [120, 185, 210] }] } }
    ]
  };
  return builders[structure]();
}

export function buildReportArtifact(archetypeId: string): ArtifactDocument | undefined {
  const archetype = reportArchetypes.find((item) => item.id === archetypeId);
  if (!archetype) return undefined;

  const sections = buildSections(archetype);

  return {
    kind: 'report',
    primaryFormat: 'pdf',
    title: archetype.title,
    audience: archetype.audience,
    tone: archetype.tone,
    executiveSummary: `${archetype.orgName} ${archetype.structure.replace(/-/g, ' ')} covering ${archetype.subject}.`,
    sections,
    citations: [{ id: 'S1', label: `Peak reference: ${archetype.category}`, url: 'https://word.cloud.microsoft/create/en/templates/' }],
    nextQuestions: [],
    design: {
      template: archetype.template,
      headingFontFamily: archetype.headingFont,
      bodyFontFamily: archetype.bodyFont,
      pageSize: archetype.pageSize ?? 'letter',
      orientation: archetype.orientation ?? 'portrait',
      density: archetype.density ?? 'balanced',
      includeTableOfContents: ['annual-report', 'whitepaper', 'technical-spec', 'user-manual'].includes(archetype.structure),
      includePageNumbers: true,
      palette: archetype.palette
    },
    assets: []
  };
}

export function buildAllReportArtifacts(): ArtifactDocument[] {
  return reportArchetypes
    .map((item) => buildReportArtifact(item.id))
    .filter((item): item is ArtifactDocument => Boolean(item));
}