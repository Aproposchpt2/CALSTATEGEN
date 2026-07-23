import { PDFParse } from 'pdf-parse';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MAX_FILES = 5;
const MAX_FILE_BYTES = 7 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 160_000;

const CAPABILITY_RULES = [
  ['General Construction', ['general contractor','general construction','commercial construction','public works construction']],
  ['Design-Build Construction', ['design build','design-build','engineer procure construct','epc']],
  ['Construction Management', ['construction management','construction manager','cm at risk']],
  ['Site Preparation and Civil Work', ['site preparation','earthwork','grading','civil construction','excavation']],
  ['Commercial Electrical Installation', ['commercial electrical','electrical installation','electrical contractor','electrical systems']],
  ['Lighting Systems', ['lighting installation','lighting systems','led retrofit','street lighting']],
  ['Generator Installation and Maintenance', ['generator installation','generator maintenance','standby generator','emergency power']],
  ['Building Automation and Controls', ['building automation','building controls','bas systems','control systems','energy management system']],
  ['EV Charging Station Installation', ['ev charging','electric vehicle charging','charging station']],
  ['HVAC Installation and Repair', ['hvac','heating ventilation','air conditioning','chiller','boiler maintenance']],
  ['Plumbing and Water Systems', ['plumbing','water systems','sewer systems','piping installation']],
  ['Fire Alarm and Life Safety Systems', ['fire alarm','life safety','fire detection','fire suppression']],
  ['Roofing and Building Envelope', ['roofing','building envelope','waterproofing','roof repair']],
  ['Preventive and Corrective Maintenance', ['preventive maintenance','preventative maintenance','corrective maintenance','scheduled maintenance']],
  ['Building Maintenance', ['building maintenance','facility maintenance','facilities maintenance']],
  ['Janitorial and Custodial Services', ['janitorial','custodial','commercial cleaning']],
  ['Landscaping and Grounds Maintenance', ['landscaping','grounds maintenance','tree trimming','irrigation maintenance']],
  ['Pest Control', ['pest control','vector control','termite']],
  ['Waste Removal', ['waste removal','solid waste','hauling services','recycling services']],
  ['Inspection and Testing Services', ['inspection services','testing services','commissioning','quality inspection']],
  ['Emergency and On-Call Services', ['emergency response','on-call services','24/7 response','rapid response']],
  ['Environmental Services', ['environmental consulting','environmental services','hazardous materials','remediation']],
  ['Security and Monitoring Services', ['security monitoring','alarm monitoring','guard services','surveillance monitoring']],
  ['Management Consulting', ['management consulting','organizational consulting','business consulting']],
  ['Project Management', ['project management','project manager','pmo services']],
  ['Program Management', ['program management','program manager']],
  ['Administrative Support', ['administrative support','clerical support','office support']],
  ['Accounting and Audit', ['accounting services','audit services','financial audit','bookkeeping']],
  ['Grant and Compliance Support', ['grant writing','grant management','compliance support','regulatory compliance']],
  ['Temporary Staffing', ['temporary staffing','temp staffing','contingent labor']],
  ['Professional Staffing', ['professional staffing','technical staffing','staff augmentation']],
  ['Training Services', ['training services','instructional services','course development']],
  ['Workforce Development', ['workforce development','job readiness','employment training']],
  ['Translation and Interpretation Services', ['translation services','interpretation services','language services']],
  ['Software Development', ['software development','application development','web development','mobile app development']],
  ['SaaS and Cloud Services', ['saas','software as a service','cloud services','cloud platform']],
  ['Data Analytics', ['data analytics','business intelligence','data visualization','predictive analytics']],
  ['Artificial Intelligence Services', ['artificial intelligence','machine learning','generative ai','natural language processing']],
  ['GIS and Mapping Services', ['gis','geographic information systems','mapping services']],
  ['Cybersecurity', ['cybersecurity','information security','penetration testing','security assessment']],
  ['Managed IT Services', ['managed it','managed services provider','it operations','infrastructure management']],
  ['Help Desk Services', ['help desk','service desk','technical support']],
  ['Systems Integration', ['systems integration','system integrator','integration services']],
  ['Telecommunications', ['telecommunications','telecom services','voice systems']],
  ['Network Infrastructure', ['network infrastructure','network engineering','wireless network','structured cabling']],
  ['Computer Hardware', ['computer hardware','servers','workstations','laptops','desktop computers']],
  ['Electronic Components and Computer Chips', ['electronic components','computer chips','semiconductors','circuit boards']],
  ['Security Cameras and Surveillance Equipment', ['security cameras','surveillance cameras','cctv','pan-tilt-zoom','ptz camera']],
  ['Telecommunications Equipment', ['telecommunications equipment','network switches','routers','radio equipment']],
  ['Industrial Equipment', ['industrial equipment','machinery','heavy equipment']],
  ['Office Supplies', ['office supplies','office products','stationery']],
  ['Medical Supplies', ['medical supplies','medical equipment','clinical supplies']],
  ['Safety Equipment', ['safety equipment','personal protective equipment','ppe']],
  ['Electrical Supplies', ['electrical supplies','electrical components','switchgear','transformers']],
  ['Industrial Pipe and Fittings', ['industrial pipe','pipe fittings','valves and fittings']],
  ['Construction Materials', ['construction materials','building materials','aggregate','concrete products']],
  ['Transportation Services', ['transportation services','shuttle services','passenger transportation']],
  ['Fleet Maintenance', ['fleet maintenance','vehicle maintenance','automotive repair']],
  ['Courier and Delivery Services', ['courier services','delivery services','last mile delivery']],
  ['Warehousing and Distribution', ['warehousing','distribution services','warehouse operations']],
  ['Supply Chain Management', ['supply chain management','procurement services','inventory management']],
];

const ROLE_RULES = [
  ['Construction Contractor', ['general construction','public works','design-build','construction management']],
  ['Specialty Trade Contractor', ['electrical contractor','hvac contractor','plumbing contractor','roofing contractor','licensed trade']],
  ['Maintenance Provider', ['maintenance services','preventive maintenance','corrective maintenance','repair services']],
  ['Professional Consultant', ['consulting','engineering services','architecture services','advisory services']],
  ['Service Provider', ['services','service provider','field service','operational support']],
  ['Product Supplier', ['supplier','supply of','furnish products','equipment sales','materials supplier']],
  ['Manufacturer', ['manufacturer','manufacturing','fabrication facility']],
  ['Distributor', ['distributor','distribution center','wholesale distributor']],
  ['Authorized Reseller', ['authorized reseller','authorized dealer','manufacturer authorization']],
  ['Software Vendor', ['software vendor','software platform','saas provider']],
  ['Systems Integrator', ['systems integrator','systems integration','integration partner']],
  ['Staffing Provider', ['staffing agency','staff augmentation','temporary staffing']],
  ['Training Provider', ['training provider','instructional services','workforce training']],
  ['Prime Contractor', ['prime contractor','prime contract','lead contractor']],
  ['Subcontractor', ['subcontractor','subcontracting','sub-tier contractor']],
];

const CERTIFICATION_PATTERNS = [
  /\bISO\s?9001\b/gi, /\bISO\s?14001\b/gi, /\bISO\s?27001\b/gi,
  /\bSOC\s?2(?:\sType\s[12])?\b/gi, /\bCMMC(?:\sLevel\s[123])?\b/gi,
  /\bOSHA\s?(?:10|30)\b/gi, /\bDBE\b/g, /\bSBE\b/g, /\bMBE\b/g,
  /\bWBE\b/g, /\bDVBE\b/g, /\bHUBZone\b/gi, /\b8\(a\)\b/gi,
  /\bLEED(?:\sAP)?\b/gi, /\bPMP\b/g, /\bCISSP\b/g,
];

const LICENSE_PATTERNS = [
  /\b(?:contractor(?:'s)?\s+license|license(?:\s+number)?|lic\.?\s*#?)\s*[:#-]?\s*([A-Z0-9-]{3,20})\b/gi,
  /\b(?:Class|Classification)\s+([A-Z](?:-[0-9A-Z]+)?)\s+(?:license|contractor)/gi,
];

const PRODUCT_RULES = [
  ['Computer hardware', ['laptops','desktop computers','servers','computer hardware']],
  ['Security and surveillance equipment', ['security cameras','surveillance equipment','cctv','ptz cameras']],
  ['Electrical components', ['electrical supplies','switchgear','transformers','electrical components']],
  ['Industrial pipe and fittings', ['industrial pipe','pipe fittings','valves and fittings']],
  ['Safety equipment', ['safety equipment','personal protective equipment','ppe']],
  ['Medical supplies', ['medical supplies','medical equipment']],
  ['Office supplies', ['office supplies','office products']],
  ['Telecommunications equipment', ['telecommunications equipment','routers','network switches','radio equipment']],
  ['Construction materials', ['construction materials','building materials','aggregate']],
];

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function findRuleMatches(text, rules) {
  const normalized = text.toLowerCase();
  return rules.filter(([, phrases]) => phrases.some((phrase) => normalized.includes(phrase))).map(([label]) => label);
}

function findPatterns(text, patterns) {
  const values = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) values.push(match[1] || match[0]);
  }
  return unique(values);
}

export function analyzeText(inputText) {
  const text = cleanText(inputText);
  const capabilities = findRuleMatches(text, CAPABILITY_RULES);
  const roles = findRuleMatches(text, ROLE_RULES);
  const certifications = findPatterns(text, CERTIFICATION_PATTERNS);
  const licenses = findPatterns(text, LICENSE_PATTERNS);
  const products = findRuleMatches(text, PRODUCT_RULES);
  const evidenceSignals = capabilities.length + roles.length + certifications.length + licenses.length + products.length;
  const confidence = Math.min(0.95, Number((0.25 + Math.min(text.length, 30_000) / 60_000 + Math.min(evidenceSignals, 15) * 0.025).toFixed(2)));

  return {
    roles: unique(roles),
    capabilities: unique(capabilities),
    certifications: unique(certifications),
    licenses: unique(licenses),
    products: unique(products),
    confidence,
    evidence_state: evidenceSignals ? 'needs_confirmation' : 'insufficient_evidence',
    evidence_signal_count: evidenceSignals,
  };
}

async function extractFile(file) {
  const type = file.type || '';
  const name = file.name || 'uploaded-document';
  if (file.size > MAX_FILE_BYTES) throw new Error(`${name} exceeds the 7 MB limit.`);
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
    const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    try {
      const result = await parser.getText();
      return { name, type: 'pdf', status: 'analyzed', text: cleanText(result.text), pages: result.total || null };
    } finally {
      await parser.destroy();
    }
  }
  if (/^(text\/|application\/json)/i.test(type) || /\.(txt|md|csv|json)$/i.test(name)) {
    return { name, type: type || 'text', status: 'analyzed', text: cleanText(await file.text()), pages: null };
  }
  throw new Error(`${name} is not a supported document type.`);
}

function isSameOriginRequest(req) {
  const target = new URL(req.url);
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (origin && origin !== target.origin) return false;
  if (referer) {
    try { if (new URL(referer).origin !== target.origin) return false; }
    catch { return false; }
  }
  if (fetchSite && !['same-origin','none'].includes(fetchSite)) return false;
  return origin === target.origin || Boolean(referer) || fetchSite === 'same-origin';
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'POST only.' });
  if (!isSameOriginRequest(req)) return json(401, { error: 'Same-origin AOIS access is required.' });
  if (req.headers.get('x-aois-visit') !== 'business-dna-v2') return json(400, { error: 'Invalid Business DNA visit context.' });

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return json(415, { error: 'Multipart form data is required.' });
    const form = await req.formData();
    const files = form.getAll('documents').filter((entry) => entry && typeof entry.arrayBuffer === 'function');
    if (files.length > MAX_FILES) return json(400, { error: `A maximum of ${MAX_FILES} documents may be analyzed.` });
    const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) return json(400, { error: 'The combined document limit is 15 MB.' });

    const description = cleanText(form.get('business_description'));
    const notes = cleanText(form.get('evidence_notes'));
    const documents = [];
    const textParts = [description, notes].filter(Boolean);

    for (const file of files) {
      try {
        const extracted = await extractFile(file);
        textParts.push(extracted.text);
        documents.push({ name: extracted.name, type: extracted.type, status: extracted.status, pages: extracted.pages, characters: extracted.text.length });
      } catch (error) {
        documents.push({ name: file.name || 'uploaded-document', type: file.type || 'unknown', status: 'review_required', error: error.message });
      }
    }

    const combined = cleanText(textParts.join('\n\n'));
    if (combined.length < 20) return json(400, { error: 'The submitted evidence does not contain enough readable text for analysis.' });
    const profileSuggestions = analyzeText(combined);
    const analyzedCount = documents.filter((document) => document.status === 'analyzed').length;
    const reviewCount = documents.length - analyzedCount;

    return json(200, {
      ok: true,
      agent_version: 'aois-business-profile-agent-v1',
      evidence_state: profileSuggestions.evidence_state,
      extraction_confidence: profileSuggestions.confidence,
      summary: `${analyzedCount} document${analyzedCount === 1 ? '' : 's'} analyzed${reviewCount ? `; ${reviewCount} requires review` : ''}. ${profileSuggestions.evidence_signal_count} structured business evidence signals identified.`,
      profile_suggestions: profileSuggestions,
      documents,
      privacy: { persisted: false, browser_storage: false, raw_text_returned: false },
    });
  } catch (error) {
    console.error('[business-profile-agent]', error);
    return json(500, { error: 'Business document analysis failed.', detail: error instanceof Error ? error.message : String(error) });
  }
}

export const config = {
  path: '/api/business-profile-agent',
  rateLimit: {
    windowLimit: 8,
    windowSize: 60,
    aggregateBy: ['ip','domain'],
  },
};
