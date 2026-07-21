'use strict';

const crypto = require('crypto');

const EXTRACTION_VERSION = 'pkd-1.0.0';
const TAXONOMY_VERSION = 'aoie-taxonomy-proposal-1.1.0';

const GENERIC_ONLY_TERMS = new Set([
  'service', 'services', 'system', 'systems', 'support', 'management',
  'technology', 'solution', 'solutions', 'maintenance', 'project',
  'program', 'professional', 'equipment', 'supplies',
]);

const BOILERPLATE_PATTERNS = [
  /the office of business and acquisition services will receive sealed bids[^.]*\./gi,
  /click on [“"]?start search[”"]?[^.]*\./gi,
  /terms and conditions[^.]*\./gi,
  /health and safety mandates[^.]*\./gi,
  /successful bidder shall furnish payment and performance bonds[^.]*\./gi,
  /all questions must be submitted[^.]*\./gi,
];

const CAPABILITY_RULES = [
  {
    id: 'facilities.window_systems_repair',
    domain: 'Facilities and Construction',
    category: 'Building Envelope',
    group: 'Windows and Glazing',
    display_name: 'Window Systems Repair and Replacement',
    procurement_type: 'construction',
    specificity_bonus: 4,
    patterns: [
      /\bwindow systems? repair\b/i,
      /\bwindow replacement\b/i,
      /\bwindow repair\b/i,
      /\bglazing\b/i,
      /\bfenestration\b/i,
    ],
    exclusions: [/\bmicrosoft windows\b/i, /\bwindows server\b/i, /\bwindows (?:10|11)\b/i],
    synonyms: ['window repair', 'window replacement', 'glazing services', 'fenestration work'],
  },
  {
    id: 'information_technology.managed_it_services',
    domain: 'Information Technology',
    category: 'IT Operations',
    group: 'Managed Services',
    display_name: 'Managed IT Services',
    procurement_type: 'information_technology',
    patterns: [
      /\bmanaged it services?\b/i,
      /\binformation technology services?\b/i,
      /\bit support services?\b/i,
      /\bhelp desk\b/i,
      /\bnetwork administration\b/i,
      /\bit infrastructure support\b/i,
    ],
    exclusions: [],
    synonyms: ['IT support', 'technology support services', 'managed technology services'],
  },
  {
    id: 'information_technology.windows_platform_support',
    domain: 'Information Technology',
    category: 'IT Operations',
    group: 'Platform Support',
    display_name: 'Microsoft Windows Platform Support',
    procurement_type: 'information_technology',
    patterns: [
      /\bmicrosoft windows\b/i,
      /\bwindows server\b/i,
      /\bactive directory\b/i,
      /\bwindows (?:10|11)\b/i,
    ],
    exclusions: [/\bwindow systems? repair\b/i, /\bwindow replacement\b/i, /\bglazing\b/i],
    synonyms: ['Windows administration', 'Windows server support', 'Microsoft platform support'],
  },
  {
    id: 'information_technology.cybersecurity_services',
    domain: 'Information Technology',
    category: 'Cybersecurity',
    group: 'Security Services',
    display_name: 'Cybersecurity Services',
    procurement_type: 'information_technology',
    patterns: [
      /\bcybersecurity\b/i,
      /\binformation security\b/i,
      /\bsecurity operations center\b/i,
      /\bsiem\b/i,
      /\bpenetration test(?:ing)?\b/i,
      /\bvulnerability assessment\b/i,
      /\bzero trust\b/i,
    ],
    exclusions: [],
    synonyms: ['information assurance', 'IT security', 'cyber defense'],
  },
  {
    id: 'information_technology.software',
    domain: 'Information Technology',
    category: 'Software',
    group: 'Software Products and Development',
    display_name: 'Software Products and Services',
    procurement_type: 'information_technology',
    patterns: [
      /\bsoftware licenses?\b/i,
      /\bsoftware subscriptions?\b/i,
      /\bsaas\b/i,
      /\bsoftware development\b/i,
      /\bapplication development\b/i,
      /\benterprise resource planning\b/i,
      /\bcustomer relationship management\b/i,
    ],
    exclusions: [],
    synonyms: ['software licensing', 'application development', 'SaaS subscription'],
  },
  {
    id: 'information_technology.computer_hardware',
    domain: 'Information Technology',
    category: 'Hardware',
    group: 'Computing Equipment',
    display_name: 'Computer Hardware',
    procurement_type: 'goods',
    patterns: [
      /\bcomputer hardware\b/i,
      /\bdesktop computers?\b/i,
      /\blaptop computers?\b/i,
      /\bservers?\b/i,
      /\bnetworking equipment\b/i,
      /\bsemiconductors?\b/i,
      /\bmicrochips?\b/i,
    ],
    exclusions: [/\bserver room construction\b/i],
    synonyms: ['computing equipment', 'IT hardware', 'computer equipment'],
  },
  {
    id: 'facilities.hvac_maintenance',
    domain: 'Facilities and Construction',
    category: 'Mechanical Systems',
    group: 'HVAC',
    display_name: 'HVAC Maintenance and Repair',
    procurement_type: 'services',
    patterns: [
      /\bhvac\b/i,
      /\bheating,? ventilation(?: and)? air conditioning\b/i,
      /\bair conditioning maintenance\b/i,
      /\bboiler maintenance\b/i,
      /\bchiller maintenance\b/i,
      /\bair handler\b/i,
    ],
    exclusions: [],
    synonyms: ['air conditioning service', 'mechanical HVAC service', 'heating and cooling maintenance'],
  },
  {
    id: 'facilities.electrical_work',
    domain: 'Facilities and Construction',
    category: 'Electrical',
    group: 'Electrical Contracting',
    display_name: 'Electrical Work',
    procurement_type: 'construction',
    patterns: [
      /\belectrical work\b/i,
      /\belectrical contractor\b/i,
      /\belectrician\b/i,
      /\bbuilding wiring\b/i,
      /\bswitchgear\b/i,
      /\blighting retrofit\b/i,
    ],
    exclusions: [],
    synonyms: ['electrical contracting', 'electrical installation', 'wiring services'],
  },
  {
    id: 'facilities.janitorial_services',
    domain: 'Facilities and Construction',
    category: 'Facility Services',
    group: 'Cleaning',
    display_name: 'Janitorial and Custodial Services',
    procurement_type: 'services',
    patterns: [
      /\bjanitorial\b/i,
      /\bcustodial\b/i,
      /\bcleaning services?\b/i,
      /\bfloor care\b/i,
      /\bsanitation services?\b/i,
    ],
    exclusions: [/\bdata cleaning\b/i],
    synonyms: ['custodial services', 'building cleaning', 'facility cleaning'],
  },
  {
    id: 'construction.general_construction',
    domain: 'Facilities and Construction',
    category: 'Construction',
    group: 'General Construction',
    display_name: 'General Construction',
    procurement_type: 'construction',
    patterns: [
      /\bgeneral construction\b/i,
      /\bpublic works\b/i,
      /\bdemolition\b/i,
      /\bexcavation\b/i,
      /\brenovation\b/i,
      /\bremodel(?:ing)?\b/i,
      /\bgeneral contractor\b/i,
      /\bcontractor(?:'s)? license\b/i,
      /\broofing\b/i,
      /\bconcrete\b/i,
      /\bpaving\b/i,
    ],
    exclusions: [],
    synonyms: ['public works construction', 'building renovation', 'general contracting'],
  },
  {
    id: 'professional.engineering_services',
    domain: 'Professional Services',
    category: 'Architecture and Engineering',
    group: 'Engineering',
    display_name: 'Engineering Services',
    procurement_type: 'professional_services',
    patterns: [
      /\bengineering services?\b/i,
      /\bcivil engineer(?:ing)?\b/i,
      /\bmechanical engineer(?:ing)?\b/i,
      /\belectrical engineer(?:ing)?\b/i,
      /\barchitectural and engineering\b/i,
      /\ba&e services?\b/i,
    ],
    exclusions: [],
    synonyms: ['A&E services', 'professional engineering', 'engineering consulting'],
  },
  {
    id: 'professional.staffing_services',
    domain: 'Professional Services',
    category: 'Workforce Services',
    group: 'Staffing',
    display_name: 'Staffing and Staff Augmentation',
    procurement_type: 'services',
    patterns: [
      /\btemporary staffing\b/i,
      /\bstaff augmentation\b/i,
      /\bpersonnel services?\b/i,
      /\brecruitment services?\b/i,
      /\bcontingent labor\b/i,
    ],
    exclusions: [],
    synonyms: ['temporary personnel', 'contract staffing', 'workforce augmentation'],
  },
  {
    id: 'professional.training_services',
    domain: 'Professional Services',
    category: 'Training and Education',
    group: 'Training',
    display_name: 'Training Services',
    procurement_type: 'services',
    patterns: [
      /\btraining services?\b/i,
      /\binstructional services?\b/i,
      /\bcurriculum development\b/i,
      /\bworkforce training\b/i,
      /\bprofessional development\b/i,
    ],
    exclusions: [],
    synonyms: ['instructional services', 'workforce development training', 'course development'],
  },
  {
    id: 'healthcare.medical_supplies',
    domain: 'Healthcare and Human Services',
    category: 'Medical Products',
    group: 'Medical Supplies',
    display_name: 'Medical Supplies and Equipment',
    procurement_type: 'goods',
    patterns: [
      /\bmedical supplies?\b/i,
      /\bmedical equipment\b/i,
      /\bsurgical supplies?\b/i,
      /\bpersonal protective equipment\b/i,
      /\bpharmaceuticals?\b/i,
    ],
    exclusions: [],
    synonyms: ['clinical supplies', 'healthcare equipment', 'medical consumables'],
  },
  {
    id: 'human_services.case_management',
    domain: 'Healthcare and Human Services',
    category: 'Human Services',
    group: 'Case and Community Services',
    display_name: 'Human Services and Case Management',
    procurement_type: 'services',
    patterns: [
      /\bhuman services?\b/i,
      /\bsocial services?\b/i,
      /\bbehavioral health\b/i,
      /\bmental health services?\b/i,
      /\bcase management\b/i,
      /\bhomeless services?\b/i,
      /\bchild welfare\b/i,
    ],
    exclusions: [],
    synonyms: ['social service programs', 'community support services', 'client case management'],
  },
  {
    id: 'transportation.logistics_services',
    domain: 'Transportation and Logistics',
    category: 'Transportation',
    group: 'Transportation Services',
    display_name: 'Transportation and Logistics Services',
    procurement_type: 'services',
    patterns: [
      /\btransportation services?\b/i,
      /\bshuttle services?\b/i,
      /\bbus services?\b/i,
      /\bfreight\b/i,
      /\blogistics\b/i,
      /\bvehicle rental\b/i,
      /\bfleet maintenance\b/i,
      /\btowing\b/i,
    ],
    exclusions: [],
    synonyms: ['transport services', 'fleet services', 'freight and logistics'],
  },
];

const SERVICES = [
  ['installation', /\binstall(?:ation|ing)?\b/i],
  ['maintenance', /\bmaint(?:enance|ain|aining)\b/i],
  ['inspection', /\binspect(?:ion|ing)?\b/i],
  ['repair', /\brepair(?:s|ing)?\b/i],
  ['consulting', /\bconsult(?:ing|ant services?)\b/i],
  ['design', /\bdesign(?:ing)?\b/i],
  ['engineering', /\bengineering\b/i],
  ['staffing', /\bstaff(?:ing| augmentation)\b/i],
  ['training', /\btraining\b/i],
  ['project management', /\bproject management\b/i],
  ['systems integration', /\bsystems? integration\b/i],
  ['software development', /\bsoftware development\b/i],
  ['janitorial services', /\bjanitorial\b|\bcustodial\b/i],
  ['landscaping', /\blandscap(?:ing|e maintenance)\b/i],
  ['transportation', /\btransportation\b|\bshuttle\b|\bfreight\b/i],
  ['administrative support', /\badministrative support\b/i],
];

const PRODUCTS = [
  ['computers', /\bcomputers?\b|\bdesktops?\b|\blaptops?\b/i],
  ['servers', /\bservers?\b/i],
  ['networking equipment', /\bnetwork(?:ing)? equipment\b|\brouters?\b|\bswitches\b/i],
  ['semiconductors', /\bsemiconductors?\b|\bmicrochips?\b/i],
  ['medical supplies', /\bmedical supplies?\b|\bsurgical supplies?\b/i],
  ['vehicles', /\bvehicles?\b|\bautomobiles?\b|\btrucks?\b/i],
  ['office furniture', /\boffice furniture\b|\bdesks?\b|\bchairs?\b/i],
  ['construction materials', /\bconstruction materials?\b|\bbuilding materials?\b/i],
  ['HVAC equipment', /\bhvac equipment\b|\bchillers?\b|\bair handlers?\b/i],
  ['safety equipment', /\bsafety equipment\b|\bpersonal protective equipment\b|\bppe\b/i],
  ['software licenses', /\bsoftware licenses?\b|\bsoftware subscriptions?\b/i],
  ['cloud subscriptions', /\bcloud subscriptions?\b|\bsaas subscriptions?\b/i],
  ['telecommunications equipment', /\btelecommunications equipment\b|\btelecom equipment\b/i],
];

const TECHNOLOGIES = [
  ['Microsoft Azure', /\bmicrosoft azure\b|\bazure\b/i],
  ['Amazon Web Services', /\bamazon web services\b|\baws\b/i],
  ['Oracle', /\boracle\b/i],
  ['SAP', /\bsap\b/i],
  ['Cisco', /\bcisco\b/i],
  ['VMware', /\bvmware\b/i],
  ['Linux', /\blinux\b/i],
  ['SQL', /\bsql\b/i],
  ['ArcGIS', /\barcgis\b/i],
  ['AutoCAD', /\bautocad\b/i],
  ['SCADA', /\bscada\b/i],
  ['PLC', /\bplc\b|\bprogrammable logic controller\b/i],
  ['SIEM', /\bsiem\b/i],
  ['ERP', /\berp\b|\benterprise resource planning\b/i],
  ['CRM', /\bcrm\b|\bcustomer relationship management\b/i],
  ['SaaS', /\bsaas\b/i],
];

const DELIVERABLES = [
  ['reports', /\breports?\b/i],
  ['designs', /\bdesigns?\b/i],
  ['drawings', /\bdrawings?\b/i],
  ['installed equipment', /\binstalled equipment\b/i],
  ['configured software', /\bconfigured software\b|\bsoftware configuration\b/i],
  ['training materials', /\btraining materials?\b/i],
  ['inspection records', /\binspection records?\b/i],
  ['maintenance logs', /\bmaintenance logs?\b/i],
  ['project schedules', /\bproject schedules?\b/i],
  ['technical documentation', /\btechnical documentation\b/i],
  ['testing results', /\btesting results?\b|\btest results?\b/i],
  ['warranty support', /\bwarranty support\b/i],
  ['transition plans', /\btransition plans?\b/i],
];

const REQUIREMENTS = [
  ['mandatory meeting', /\bmandatory (?:prebid|pre-bid|meeting|conference)\b/i],
  ['site visit', /\bsite (?:visit|inspection|walk)\b/i],
  ['insurance', /\binsurance\b/i],
  ['bonding', /\bpayment and performance bonds?\b|\bbid bond\b|\bbonding\b/i],
  ['background checks', /\bbackground checks?\b/i],
  ['security clearance', /\bsecurity clearance\b/i],
  ['prevailing wage', /\bprevailing wage\b/i],
  ['local presence', /\blocal presence\b|\blocal office\b/i],
  ['past performance', /\bpast performance\b/i],
  ['minimum experience', /\bminimum of \d+ years?\b|\bat least \d+ years? of experience\b/i],
  ['authorized reseller', /\bauthorized reseller\b|\bmanufacturer authorization\b/i],
];

function normalizeSpace(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(v => v !== null && v !== undefined) : [];
}

function stableUnique(values) {
  return Array.from(new Set(values.map(v => normalizeSpace(v)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function removeBoilerplate(value) {
  let text = normalizeSpace(value);
  for (const pattern of BOILERPLATE_PATTERNS) text = text.replace(pattern, ' ');
  return normalizeSpace(text);
}

function stringifyObject(value) {
  if (!value || typeof value !== 'object') return '';
  try { return JSON.stringify(value); } catch (_) { return ''; }
}

function buildEvidence(record) {
  const title = normalizeSpace(record.title);
  const description = removeBoilerplate(record.description);
  const keywords = safeArray(record.keywords).map(normalizeSpace).filter(Boolean);
  const classifications = stringifyObject(record.classifications);
  const requirements = stringifyObject(record.requirements);
  return {
    title,
    description,
    keywords,
    classifications,
    requirements,
    title_text: title,
    description_text: description,
    keyword_text: keywords.join(' '),
    combined_text: normalizeSpace([title, description, keywords.join(' '), classifications, requirements].join(' ')),
  };
}

function patternMatches(pattern, text) {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function scoreCapability(rule, evidence) {
  const excluded = rule.exclusions.some(pattern => patternMatches(pattern, evidence.combined_text));
  if (excluded) return null;

  let score = 0;
  const matches = [];
  for (const pattern of rule.patterns) {
    if (patternMatches(pattern, evidence.title_text)) {
      score += 5;
      matches.push({ field: 'title', pattern: pattern.source });
      continue;
    }
    if (patternMatches(pattern, evidence.keyword_text)) {
      score += 3;
      matches.push({ field: 'keywords', pattern: pattern.source });
      continue;
    }
    if (patternMatches(pattern, evidence.description_text)) {
      score += 2;
      matches.push({ field: 'description', pattern: pattern.source });
      continue;
    }
    if (patternMatches(pattern, evidence.classifications)) {
      score += 2;
      matches.push({ field: 'classifications', pattern: pattern.source });
      continue;
    }
    if (patternMatches(pattern, evidence.requirements)) {
      score += 1;
      matches.push({ field: 'requirements', pattern: pattern.source });
    }
  }

  if (score === 0) return null;
  score += Number(rule.specificity_bonus || 0);
  return {
    capability_id: rule.id,
    domain: rule.domain,
    category: rule.category,
    group: rule.group,
    capability: rule.display_name,
    procurement_type: rule.procurement_type,
    score,
    matches,
    synonyms: rule.synonyms,
  };
}

function extractNamed(text, definitions) {
  return definitions
    .filter(([, pattern]) => patternMatches(pattern, text))
    .map(([name]) => name);
}

function extractLicenses(text) {
  const found = new Set();
  const patterns = [
    /\b(?:class|type)\s+([A-Z](?:-\d{1,3})?)\s+contractor(?:'s)? license\b/gi,
    /\blicense required to bid(?: the project)?\s*[:\-]\s*([A-Z](?:-\d{1,3})?)\b/gi,
    /\b([A-Z](?:-\d{1,3})?)\s+contractor(?:'s)? license\b/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) found.add(match[1].toUpperCase());
  }
  return Array.from(found).sort();
}

function extractCertifications(record, text) {
  const found = new Set(safeArray(record.certifications_required).map(normalizeSpace).filter(Boolean));
  const rules = [
    ['ISO 9001', /\biso\s*9001\b/i],
    ['SOC 2', /\bsoc\s*2\b/i],
    ['CMMC', /\bcmmc\b/i],
    ['DBE', /\bdisadvantaged business enterprise\b|\bdbe\b/i],
    ['DVBE', /\bdisabled veteran business enterprise\b|\bdvbe\b/i],
    ['SB', /\bsmall business certification\b|\bcertified small business\b/i],
    ['LEED', /\bleed certification\b|\bleed accredited\b/i],
  ];
  for (const [name, pattern] of rules) if (patternMatches(pattern, text)) found.add(name);
  return Array.from(found).sort();
}

function classificationCodes(record) {
  const rows = [];
  const mappings = [
    ['NAICS', record.naics_codes],
    ['NIGP', record.nigp_codes],
    ['UNSPSC', record.unspsc_codes],
    ['COMMODITY', record.commodity_codes],
  ];
  for (const [scheme, values] of mappings) {
    for (const code of safeArray(values)) {
      const normalized = normalizeSpace(typeof code === 'object' ? (code.code || code.id || '') : code);
      if (normalized) rows.push({ scheme, code: normalized, assignment_status: 'official_source_record' });
    }
  }
  return rows;
}

function confidenceBand(score, evidence, capabilityCount) {
  let value = Math.min(100, 38 + (score * 7));
  if (evidence.description.length >= 200) value += 8;
  else if (evidence.description.length < 80) value -= 12;
  if (evidence.keywords.length) value += 5;
  if (capabilityCount === 0) value = Math.min(value, 34);
  value = Math.max(0, Math.min(100, Math.round(value)));
  let band = 'REVIEW REQUIRED';
  if (value >= 90) band = 'HIGHLY VERIFIED';
  else if (value >= 75) band = 'HIGH CONFIDENCE';
  else if (value >= 55) band = 'MODERATE CONFIDENCE';
  else if (value >= 35) band = 'LOW CONFIDENCE';
  return { value, band };
}

function buildFingerprint(record, extraction) {
  const source = {
    id: record.id || null,
    pdas_record_id: record.pdas_record_id || null,
    source_record_id: record.source_record_id || null,
    content_fingerprint: record.content_fingerprint || null,
    title: record.title || null,
    description: record.description || null,
    keywords: safeArray(record.keywords),
    codes: classificationCodes(record),
    extraction_version: EXTRACTION_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
    capabilities: extraction.capabilities.map(item => item.capability_id),
  };
  return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

function extractBuyerTerms(evidence, capabilities) {
  const terms = new Set();
  for (const item of capabilities) {
    for (const match of item.matches) {
      const source = match.field === 'title'
        ? evidence.title_text
        : match.field === 'keywords'
          ? evidence.keyword_text
          : match.field === 'description'
            ? evidence.description_text
            : evidence.combined_text;
      const regex = new RegExp(match.pattern, 'i');
      const found = source.match(regex);
      if (found && normalizeSpace(found[0]).length > 2) terms.add(normalizeSpace(found[0]));
    }
  }
  return Array.from(terms).sort((a, b) => a.localeCompare(b));
}

function extractOpportunity(record) {
  const evidence = buildEvidence(record);
  const scored = CAPABILITY_RULES
    .map(rule => scoreCapability(rule, evidence))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.capability_id.localeCompare(b.capability_id));

  const primary = scored[0] || null;
  const secondary = scored.slice(1).filter(item => item.score >= Math.max(2, (primary ? primary.score - 4 : 2)));
  const maxScore = primary ? primary.score : 0;
  const confidence = confidenceBand(maxScore, evidence, scored.length);

  const originalKeywords = safeArray(record.keywords).map(normalizeSpace).filter(Boolean);
  const genericKeywords = originalKeywords.filter(keyword => GENERIC_ONLY_TERMS.has(keyword.toLowerCase()));
  const meaningfulKeywords = originalKeywords.filter(keyword => !GENERIC_ONLY_TERMS.has(keyword.toLowerCase()));

  const extraction = {
    extraction_version: EXTRACTION_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
    source: {
      opportunity_id: record.id || null,
      pdas_record_id: record.pdas_record_id || null,
      source_record_id: record.source_record_id || null,
      solicitation_number: record.solicitation_number || null,
      publisher: record.issuing_organization || null,
      procurement_platform: record.source_platform || null,
      source_url: record.official_source_url || record.source_url || null,
      content_fingerprint: record.content_fingerprint || null,
      is_latest_version: record.is_latest_version !== false,
      duplicate_of: record.duplicate_of || null,
    },
    procurement_purpose: {
      title: evidence.title,
      normalized_type: primary ? primary.procurement_type : (record.procurement_type || null),
      has_multiple_capabilities: secondary.length > 0,
    },
    primary_capability: primary,
    secondary_capabilities: secondary,
    capabilities: scored,
    services: stableUnique(extractNamed(evidence.combined_text, SERVICES)),
    products: stableUnique(extractNamed(evidence.combined_text, PRODUCTS)),
    technologies: stableUnique(extractNamed(evidence.combined_text, TECHNOLOGIES)),
    deliverables: stableUnique(extractNamed(evidence.combined_text, DELIVERABLES)),
    requirements: stableUnique(extractNamed(evidence.combined_text, REQUIREMENTS)),
    licenses: extractLicenses(evidence.combined_text),
    certifications: extractCertifications(record, evidence.combined_text),
    classification_codes: classificationCodes(record),
    buyer_terms: extractBuyerTerms(evidence, scored),
    terminology: {
      meaningful_keywords: meaningfulKeywords,
      suppressed_generic_keywords: genericKeywords,
    },
    confidence,
    review_status: confidence.value < 55 || !primary ? 'review_required' : 'auto_extracted',
    review_reasons: [
      ...(evidence.description.length < 80 ? ['low_information_record'] : []),
      ...(!primary ? ['no_supported_capability'] : []),
      ...(genericKeywords.length && meaningfulKeywords.length === 0 ? ['generic_terms_only'] : []),
    ],
    provenance: {
      original_title: record.title || null,
      original_description_present: Boolean(normalizeSpace(record.description)),
      original_keyword_count: originalKeywords.length,
      code_count: classificationCodes(record).length,
      extraction_method: 'deterministic evidence-weighted rule engine',
      extracted_at: new Date().toISOString(),
    },
  };

  extraction.extraction_fingerprint = buildFingerprint(record, extraction);
  return extraction;
}

function isCanonicalRecord(record) {
  return record && record.is_latest_version !== false && !record.duplicate_of;
}

function buildFrequencyReport(extractions) {
  const byCapability = new Map();
  const byService = new Map();
  const byProduct = new Map();
  const byTechnology = new Map();
  const relationshipMap = new Map();

  function add(map, key, opportunityId) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(opportunityId);
  }

  for (const extraction of extractions) {
    const opportunityId = extraction.source.opportunity_id
      || extraction.source.pdas_record_id
      || extraction.source.source_record_id
      || extraction.extraction_fingerprint;
    const capabilityIds = extraction.capabilities.map(item => item.capability_id);

    for (const id of capabilityIds) add(byCapability, id, opportunityId);
    for (const name of extraction.services) add(byService, name, opportunityId);
    for (const name of extraction.products) add(byProduct, name, opportunityId);
    for (const name of extraction.technologies) add(byTechnology, name, opportunityId);

    for (let i = 0; i < capabilityIds.length; i += 1) {
      for (let j = i + 1; j < capabilityIds.length; j += 1) {
        const pair = [capabilityIds[i], capabilityIds[j]].sort();
        add(relationshipMap, pair.join('::'), opportunityId);
      }
    }
  }

  const rows = map => Array.from(map.entries())
    .map(([value, ids]) => ({ value, distinct_opportunities: ids.size }))
    .sort((a, b) => b.distinct_opportunities - a.distinct_opportunities || a.value.localeCompare(b.value));

  return {
    total_extractions: extractions.length,
    capabilities: rows(byCapability),
    services: rows(byService),
    products: rows(byProduct),
    technologies: rows(byTechnology),
    capability_relationships: rows(relationshipMap).map(row => {
      const [source_capability_id, target_capability_id] = row.value.split('::');
      return {
        source_capability_id,
        target_capability_id,
        relationship_type: 'co_occurs_with',
        distinct_opportunities: row.distinct_opportunities,
      };
    }),
  };
}

function processRecords(records) {
  const input = safeArray(records);
  const canonical = input.filter(isCanonicalRecord);
  const extractions = canonical.map(extractOpportunity);
  return {
    extraction_version: EXTRACTION_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
    records_considered: input.length,
    records_processed: extractions.length,
    records_skipped: input.length - canonical.length,
    records_failed: 0,
    review_required: extractions.filter(item => item.review_status === 'review_required').length,
    extractions,
    frequency_report: buildFrequencyReport(extractions),
  };
}

module.exports = {
  EXTRACTION_VERSION,
  TAXONOMY_VERSION,
  CAPABILITY_RULES,
  normalizeSpace,
  removeBoilerplate,
  extractOpportunity,
  buildFrequencyReport,
  isCanonicalRecord,
  processRecords,
};
