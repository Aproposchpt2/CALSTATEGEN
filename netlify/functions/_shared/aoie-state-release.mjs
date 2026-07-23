export const RELEASE_QA_STATUSES = new Set(['verified', 'auto_ingested']);

const GENERIC_ENTITY_VALUES = new Set([
  'agency',
  'city department',
  'public agency',
  'public entity',
  'procurement department',
  'procurement office',
  'unknown',
  'unknown agency',
]);

const GENERIC_REQUIREMENT_TEXT = new Set([
  '',
  'comments:',
  'n/a',
  'na',
  'none',
  'not applicable',
  'not available',
  'not provided',
  'null',
  'see bid documents',
  'see documents',
  'see official event package',
  'see official solicitation',
  'see solicitation',
  'unknown',
]);

const REQUIREMENT_KEY_PATTERN = /(scope|service|product|deliverable|task|performance|license|certif|insurance|bond|registration|experience|past.?performance|staff|personnel|equipment|meeting|pre.?bid|pre.?proposal|site.?visit|job.?walk|submission|response.?method|portal|required.?form|volume|file.?format|instruction|evaluation|weighted|price|technical|interview|responsiveness|security|background|set.?aside|dbe|sbe|mbe|wbe|dvbe|prequal|responsible|clearance|quality|safety|compliance|schedule|response.?time|mobilization|contract.?term|renewal|delivery|fulfillment|bid.?surety)/i;

const TRUE_REQUIREMENT_KEYS = new Set([
  'account_required_for_submission',
  'bid_surety',
  'electronic_signature_required',
  'mandatory_meeting',
  'mandatory_site_visit',
  'manufacturer_authorization_required',
  'prequalification_required',
  'registration_required',
]);

function normalizedText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function meaningfulText(value, minimumLength = 2) {
  const text = normalizedText(value);
  return text.length >= minimumLength && !GENERIC_REQUIREMENT_TEXT.has(text.toLowerCase());
}

function usableUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function futureDeadline(value, nowMs) {
  if (!value) return false;
  const deadlineMs = Date.parse(value);
  return Number.isFinite(deadlineMs) && deadlineMs >= nowMs;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.some((item) => {
    if (typeof item === 'string') return meaningfulText(item);
    if (item && typeof item === 'object') return Object.keys(item).length > 0;
    return item !== null && item !== undefined && item !== false;
  });
}

function requirementValueIsSubstantive(key, value, row, depth = 0) {
  if (depth > 5 || !REQUIREMENT_KEY_PATTERN.test(key)) return false;

  const normalizedKey = String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  if (normalizedKey === 'mandatory_prebid' || normalizedKey === 'mandatory_pre_bid') {
    if (value !== true) return false;
    return Boolean(
      row?.prebid_datetime
      || meaningfulText(row?.requirements?.prebid_location)
      || meaningfulText(row?.requirements?.pre_bid?.location)
      || meaningfulText(row?.requirements?.pre_bid?.date)
    );
  }

  if (typeof value === 'string') return meaningfulText(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value === true && TRUE_REQUIREMENT_KEYS.has(normalizedKey);

  if (Array.isArray(value)) {
    return value.some((item) => {
      if (typeof item === 'string') return meaningfulText(item);
      if (typeof item === 'number') return Number.isFinite(item);
      if (item && typeof item === 'object') {
        return Object.entries(item).some(([childKey, childValue]) => requirementValueIsSubstantive(`${key}_${childKey}`, childValue, row, depth + 1));
      }
      return false;
    });
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(([childKey, childValue]) => requirementValueIsSubstantive(`${key}_${childKey}`, childValue, row, depth + 1));
  }

  return false;
}

export function hasIdentifiableIssuingEntity(row) {
  const entity = normalizedText(row?.issuing_organization || row?.organization_name || row?.agency);
  return Boolean(entity && entity.length >= 3 && !GENERIC_ENTITY_VALUES.has(entity.toLowerCase()));
}

export function hasSubstantiveRequirements(row) {
  if (nonEmptyArray(row?.certifications_required) || nonEmptyArray(row?.set_asides)) return true;
  const requirements = row?.requirements;
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) return false;
  return Object.entries(requirements).some(([key, value]) => requirementValueIsSubstantive(key, value, row));
}

function hasDocumentEvidence(value) {
  if (Array.isArray(value)) return value.some((item) => typeof item === 'string' ? usableUrl(item) : usableUrl(item?.url || item?.href || item?.download_url));
  if (value && typeof value === 'object') return Object.values(value).some((item) => typeof item === 'string' ? usableUrl(item) : usableUrl(item?.url || item?.href || item?.download_url));
  return false;
}

export function hasMeaningfulOpportunityEvidence(row) {
  if (meaningfulText(row?.description, 40)) return true;
  if (hasDocumentEvidence(row?.document_urls)) return true;
  const requirements = row?.requirements;
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) return false;
  return Object.entries(requirements).some(([key, value]) => /(scope|description|deliverable|task|service|product|performance)/i.test(key) && requirementValueIsSubstantive(key, value, row));
}

function positiveExtractionConfidence(value) {
  const confidence = Number(value);
  return Number.isFinite(confidence) && confidence > 0;
}

export function evaluateOpportunityRelease(row, now = Date.now()) {
  const nowMs = now instanceof Date ? now.valueOf() : Number(now);
  const reasons = [];
  const qaStatus = String(row?.qa_status || '').trim().toLowerCase();

  if (!String(row?.title || '').trim()) reasons.push('missing_title');
  if (!usableUrl(row?.official_source_url)) reasons.push('missing_or_invalid_official_source_url');
  if (!futureDeadline(row?.response_deadline, Number.isFinite(nowMs) ? nowMs : Date.now())) reasons.push('missing_or_expired_deadline');
  if (!hasIdentifiableIssuingEntity(row)) reasons.push('missing_issuing_entity');
  if (!hasMeaningfulOpportunityEvidence(row)) reasons.push('missing_meaningful_description_scope_or_document');
  if (!hasSubstantiveRequirements(row)) reasons.push('missing_substantive_requirements');
  if (!positiveExtractionConfidence(row?.extraction_confidence)) reasons.push('missing_or_invalid_extraction_confidence');
  if (!RELEASE_QA_STATUSES.has(qaStatus)) reasons.push('qa_not_release_ready');

  return {
    release_ready: reasons.length === 0,
    reasons,
    qa_status: qaStatus || null,
    evidence: {
      issuing_entity: hasIdentifiableIssuingEntity(row),
      meaningful_opportunity_evidence: hasMeaningfulOpportunityEvidence(row),
      substantive_requirements: hasSubstantiveRequirements(row),
      extraction_confidence: positiveExtractionConfidence(row?.extraction_confidence),
    },
  };
}

export function filterReleaseReadyOpportunities(rows, now = Date.now()) {
  const accepted = [];
  const rejected = [];
  const rejection_summary = {};

  for (const row of Array.isArray(rows) ? rows : []) {
    const release = evaluateOpportunityRelease(row, now);
    if (release.release_ready) {
      accepted.push({ ...row, release_evidence: release });
      continue;
    }
    rejected.push({ id: row?.id || row?.source_record_id || null, reasons: release.reasons });
    for (const reason of release.reasons) rejection_summary[reason] = (rejection_summary[reason] || 0) + 1;
  }

  return { accepted, rejected, rejection_summary };
}
