'use strict';

const crypto = require('crypto');

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

function normalizeSpace(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function nthSunday(year, month, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + ((nth - 1) * 7);
}

function californiaOffsetMinutes(year, month, day) {
  const dstStartDay = nthSunday(year, 3, 2);
  const dstEndDay = nthSunday(year, 11, 1);
  const isDst = month > 3 && month < 11
    || (month === 3 && day >= dstStartDay)
    || (month === 11 && day < dstEndDay);
  return isDst ? -420 : -480;
}

function toUtcIso(year, month, day, hour, minute, explicitZone) {
  let offsetMinutes;
  const zone = String(explicitZone || '').toUpperCase();
  if (zone === 'PDT') offsetMinutes = -420;
  else if (zone === 'PST') offsetMinutes = -480;
  else offsetMinutes = californiaOffsetMinutes(year, month, day);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0) - (offsetMinutes * 60000);
  return new Date(utcMillis).toISOString();
}

function parseCaliforniaDate(value) {
  if (!value) return null;
  const raw = normalizeSpace(value).replace(/\bA\.M\./ig, 'AM').replace(/\bP\.M\./ig, 'PM');
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && /(Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  let match = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?(?:\s*(PST|PDT|PT))?/i);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    let hour = match[4] ? Number(match[4]) : 0;
    const minute = match[5] ? Number(match[5]) : 0;
    if (match[6]) hour = (hour % 12) + (/PM/i.test(match[6]) ? 12 : 0);
    return toUtcIso(year, month, day, hour, minute, match[7]);
  }

  match = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*(PST|PDT|PT)?[,]?\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  if (match) {
    const month = MONTHS[match[5].toLowerCase()];
    if (!month) return null;
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    hour = (hour % 12) + (/PM/i.test(match[3]) ? 12 : 0);
    return toUtcIso(Number(match[7]), month, Number(match[6]), hour, minute, match[4]);
  }

  match = raw.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM))?(?:\s*(PST|PDT|PT))?/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (!month) return null;
    const day = Number(match[2]);
    const year = Number(match[3]);
    let hour = match[4] ? Number(match[4]) : 0;
    const minute = match[5] ? Number(match[5]) : 0;
    if (match[6]) hour = (hour % 12) + (/PM/i.test(match[6]) ? 12 : 0);
    return toUtcIso(year, month, day, hour, minute, match[7]);
  }

  return null;
}

function parseEventIdentity(url, fallbackEventId) {
  const raw = String(url || '');
  let match = raw.match(/\/event\/([^/?#]+)\/([^/?#]+)/i);
  if (match) {
    return { business_unit: decodeURIComponent(match[1]), event_id: decodeURIComponent(match[2]) };
  }
  const businessUnit = (raw.match(/[?&]BUSINESS_UNIT=([^&#]+)/i) || [])[1];
  const eventId = (raw.match(/[?&]AUC_ID=([^&#]+)/i) || [])[1];
  return {
    business_unit: businessUnit ? decodeURIComponent(businessUnit) : null,
    event_id: eventId ? decodeURIComponent(eventId) : (fallbackEventId || null),
  };
}

function buildSourceRecordId(businessUnit, eventId) {
  if (!businessUnit || !eventId) return null;
  return String(businessUnit).trim() + ':' + String(eventId).trim();
}

function extractSolicitationNumber(title, description) {
  const text = normalizeSpace([title, description].filter(Boolean).join(' '));
  const patterns = [
    /\b(?:INVITATION FOR BIDS?\s*\()?\b(?:IFB|RFP|RFQ|RFI|RFA|NOFA)\)?\s*(?:NUMBER|NO\.?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})\b/i,
    /\b(?:SOLICITATION|INVITATION|CONTRACT)\s*(?:NUMBER|NO\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const candidate = match[1].replace(/[.,;:)]+$/, '');
    // California solicitation identifiers consistently contain at least one
    // digit. This rejects narrative false positives such as "RFI specifically"
    // or "RFP information" while preserving values like S25-33335 and 56A0887.
    if (!/\d/.test(candidate)) continue;
    return candidate;
  }
  return null;
}

function extractQuestionDeadline(text) {
  const raw = normalizeSpace(text);
  const patterns = [
    /(?:questions?|inquiries)[^.]{0,180}?(?:no later than|due by|must be submitted by)\s+([^.;]{6,80})/i,
    /(?:question deadline|questions due)\s*[:\-]\s*([^.;]{6,80})/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      const parsed = parseCaliforniaDate(match[1]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function extractSetAsides(text) {
  const raw = normalizeSpace(text).toUpperCase();
  const values = [];
  const rules = [
    ['SB', /\bSMALL BUSINESS\b|\bSB (?:GOAL|INCENTIVE|PREFERENCE|PARTICIPATION)\b/],
    ['MICROBUSINESS', /\bMICROBUSINESS\b/],
    ['DVBE', /\bDVBE\b|DISABLED VETERAN BUSINESS ENTERPRISE/],
    ['TACPA', /\bTACPA\b/],
  ];
  rules.forEach(([label, pattern]) => { if (pattern.test(raw)) values.push(label); });
  return values;
}

function extractCertifications(text) {
  const raw = normalizeSpace(text);
  const values = [];
  const licenseMatch = raw.match(/(?:must possess|requires?|contractor license(?: type)?)[^.;]{0,120}?\b([A-Z]-?\d{1,3})\b/i)
    || raw.match(/\b([A-Z]-?\d{1,3})\s*[-–]?\s*[^.;]{0,80}?contractor(?:'s)? license/i);
  if (licenseMatch) values.push(normalizeSpace(licenseMatch[1]).toUpperCase());
  if (/office of the state fire marshal/i.test(raw)) values.push('OFFICE OF THE STATE FIRE MARSHAL');
  return Array.from(new Set(values));
}

function normalizeStatus(sourceStatus, responseDeadline) {
  const raw = normalizeSpace(sourceStatus).toLowerCase();
  if (raw.includes('cancel')) return 'cancelled';
  if (raw.includes('not awarded')) return 'not_awarded';
  if (raw.includes('pending award')) return 'pending_award';
  if (raw.includes('award')) return 'awarded';
  const deadline = responseDeadline ? Date.parse(responseDeadline) : NaN;
  if (!Number.isNaN(deadline) && deadline < Date.now()) return 'closed';
  if (raw.includes('post') || raw.includes('open') || !raw) return 'open';
  return raw.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'open';
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

module.exports = {
  normalizeSpace,
  californiaOffsetMinutes,
  parseCaliforniaDate,
  parseEventIdentity,
  buildSourceRecordId,
  extractSolicitationNumber,
  extractQuestionDeadline,
  extractSetAsides,
  extractCertifications,
  normalizeStatus,
  hashJson,
};
