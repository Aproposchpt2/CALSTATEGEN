'use strict';
/* PDAS — Cal eProcure / California State Contracts Register acquisition core.
   Uses a paced Playwright browser session because the public search and event
   package flow are stateful browser applications. The list page is used only
   for discovery; event details remain authoritative and are reverified on a
   schedule because deadlines, versions, and attachments can change. */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const {
  normalizeSpace,
  parseCaliforniaDate,
  parseEventIdentity,
  buildSourceRecordId,
  extractSolicitationNumber,
  extractQuestionDeadline,
  extractSetAsides,
  extractCertifications,
  hashJson,
} = require('./lib/caleprocure-normalize');

const SEARCH_URL = 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx';
const OUT_FILE = path.join(__dirname, '..', 'caleprocure.json');
const DETAIL_DELAY_MS = 2500;
const PACKAGE_DELAY_MS = 1200;

function argInt(name, dflt) {
  const match = process.argv.find(arg => arg.indexOf('--' + name + '=') === 0);
  return match ? parseInt(match.split('=')[1], 10) : dflt;
}

const DETAIL_LIMIT = argInt('detail-limit', 80);
const PACKAGE_LIMIT = argInt('package-limit', 25);
const REFRESH_HOURS = argInt('refresh-hours', 24);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cleanLines(value) {
  return String(value || '').split('\n').map(normalizeSpace).filter(Boolean);
}

function between(text, startLabels, endLabels) {
  const starts = Array.isArray(startLabels) ? startLabels : [startLabels];
  let startIdx = -1;
  let startLength = 0;
  for (const label of starts) {
    const idx = text.indexOf(label);
    if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
      startIdx = idx;
      startLength = label.length;
    }
  }
  if (startIdx === -1) return '';
  startIdx += startLength;
  let endIdx = text.length;
  (endLabels || []).forEach(label => {
    const idx = text.indexOf(label, startIdx);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  });
  return text.slice(startIdx, endIdx).trim();
}

function parseListIdentity(signal, fallbackEventId) {
  const identity = parseEventIdentity(signal, fallbackEventId);
  if (identity.business_unit) return identity;
  const raw = String(signal || '');
  const businessUnit = (raw.match(/BUSINESS_UNIT(?:%3D|=|\W+)([A-Z0-9_-]{2,12})/i) || [])[1];
  return { business_unit: businessUnit || null, event_id: identity.event_id || fallbackEventId || null };
}

function parseDetailText(text, url) {
  const identity = parseEventIdentity(url);
  const description = between(text, 'Description:', ['View Event Package', 'View Vendor Ads', 'Contact Information']);
  const contactBlock = between(text, 'Contact Information', ['Pre Bid Conference', 'Service Areas', 'UNSPSC Codes']);
  const contactLines = cleanLines(contactBlock).filter(line => !/^(name|phone|email)\s*:?$/i.test(line));
  const emailMatch = contactBlock.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = contactBlock.match(/\(?\d{3}\)?[\s./-]?\d{3}[\s./-]?\d{4}/);
  const formatType = (text.match(/Format\/Type:\s*\n?\s*([^\n]+)/i) || [])[1];
  const publishedRaw = (text.match(/Published Date\s*\n?\s*([^\n]+)/i) || [])[1];
  const roundRaw = (text.match(/Event Round\s*:?\s*\n?\s*(\d+)/i) || [])[1];
  const versionRaw = (text.match(/Event Version\s*:?\s*\n?\s*(\d+)/i) || [])[1];

  const unspscCodes = [];
  const unspscTableIdx = text.indexOf('UNSPSC Codes');
  if (unspscTableIdx !== -1) {
    const codeRe = /(\d{8})\s+([^\n]+)/g;
    let match;
    const tableText = text.slice(unspscTableIdx);
    while ((match = codeRe.exec(tableText)) !== null) {
      unspscCodes.push({ code: match[1], description: normalizeSpace(match[2]) });
      if (unspscCodes.length >= 50) break;
    }
  }

  const serviceAreaBlock = between(text, ['Service Areas', 'Service Area'], ['UNSPSC Codes', 'Pre Bid Conference', 'Contractor License']);
  const serviceAreas = cleanLines(serviceAreaBlock)
    .filter(line => !/^(code|description|service areas?)$/i.test(line))
    .slice(0, 25);

  const preBidBlock = between(text, ['Pre Bid Conference', 'Pre-Bid Conference'], ['UNSPSC Codes', 'Contractor License', 'Bid Lines', 'Line Items']);
  const preBidRaw = (preBidBlock.match(/(?:date|conference date)\s*:?\s*([^\n]+)/i) || [])[1]
    || (preBidBlock.match(/(\d{1,2}\/\d{1,2}\/\d{4}[^\n]*)/) || [])[1];
  const preBidLocation = (preBidBlock.match(/(?:location|place)\s*:?\s*([^\n]+)/i) || [])[1] || null;
  const mandatoryPreBid = /mandatory/i.test(preBidBlock) && !/not mandatory|non-mandatory/i.test(preBidBlock);

  const completeText = [text, description].join('\n');
  const certifications = extractCertifications(completeText);
  const contractorLicense = certifications.find(value => /LICENSE|^[A-Z]-?\d+$/.test(value)) || null;

  return {
    business_unit: identity.business_unit,
    event_id: identity.event_id,
    description: description || null,
    format_type: formatType ? normalizeSpace(formatType) : null,
    published_date: parseCaliforniaDate(publishedRaw) || null,
    published_date_raw: publishedRaw ? normalizeSpace(publishedRaw) : null,
    contact_name: contactLines[0] || null,
    contact_email: emailMatch ? emailMatch[0] : null,
    contact_phone: phoneMatch ? phoneMatch[0] : null,
    unspsc_codes: unspscCodes,
    service_areas: serviceAreas,
    event_round: roundRaw ? Number(roundRaw) : 1,
    event_version: versionRaw ? Number(versionRaw) : 1,
    prebid_datetime: parseCaliforniaDate(preBidRaw),
    prebid_location: preBidLocation ? normalizeSpace(preBidLocation) : null,
    mandatory_prebid: mandatoryPreBid,
    question_deadline: extractQuestionDeadline(description || text),
    solicitation_number: extractSolicitationNumber('', description || text),
    set_asides: extractSetAsides(completeText),
    certifications_required: certifications,
    contractor_license: contractorLicense,
  };
}

function classifyDocument(filename, description) {
  const text = normalizeSpace([filename, description].join(' ')).toLowerCase();
  if (/addendum|amendment/.test(text)) return 'addendum';
  if (/question|answer|q\s*&\s*a/.test(text)) return 'questions_and_answers';
  if (/cancel/.test(text)) return 'cancellation';
  if (/intent.*award/.test(text)) return 'intent_to_award';
  if (/award/.test(text)) return 'award';
  if (/cost|price|pricing|bid sheet/.test(text)) return 'cost_sheet';
  if (/scope|statement of work|sow/.test(text)) return 'scope_of_work';
  if (/sample.*contract|agreement/.test(text)) return 'sample_contract';
  if (/ifb|rfp|rfq|rfi|solicitation|invitation/.test(text)) return 'solicitation';
  if (/form/.test(text)) return 'required_form';
  return 'other';
}

async function enumeratePackageDocuments(packagePage, eventRound, eventVersion) {
  await packagePage.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
  await packagePage.waitForTimeout(1200);
  return packagePage.evaluate(({ eventRound, eventVersion }) => {
    function clean(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
    const records = [];
    document.querySelectorAll('a').forEach(anchor => {
      const filename = clean(anchor.innerText || anchor.textContent);
      const rowText = clean(anchor.closest('tr') ? anchor.closest('tr').innerText : anchor.parentElement && anchor.parentElement.innerText);
      const href = anchor.href && /^https?:/i.test(anchor.href) ? anchor.href : null;
      const action = clean(anchor.getAttribute('onclick') || anchor.getAttribute('href'));
      const looksLikeFile = /\.(pdf|docx?|xlsx?|csv|zip|txt|rtf|pptx?)\b/i.test(filename + ' ' + rowText + ' ' + action)
        || /attachment|download|event package/i.test(rowText);
      if (!filename || !looksLikeFile) return;
      records.push({
        official_url: href,
        filename,
        display_title: filename,
        description: rowText && rowText !== filename ? rowText : null,
        source_action: action || null,
        event_round: eventRound,
        event_version: eventVersion,
      });
    });
    const seen = new Set();
    return records.filter(record => {
      const key = [record.official_url, record.filename, record.source_action].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, { eventRound, eventVersion });
}

async function fetchEventPackage(ctx, detailPage, eventRound, eventVersion) {
  const packageControl = detailPage.getByText('View Event Package', { exact: false }).first();
  if (await packageControl.count().catch(() => 0) === 0) return { fetched: false, documents: [] };

  const originalUrl = detailPage.url();
  const newPagePromise = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
  try {
    await packageControl.click({ timeout: 10000 });
  } catch (_) {
    return { fetched: false, documents: [] };
  }

  const newPage = await newPagePromise;
  const packagePage = newPage || detailPage;
  const documents = await enumeratePackageDocuments(packagePage, eventRound, eventVersion).catch(() => []);
  if (newPage) await newPage.close().catch(() => {});
  else if (detailPage.url() !== originalUrl) await detailPage.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

  return {
    fetched: true,
    documents: documents.map(document => Object.assign(document, {
      document_type: classifyDocument(document.filename, document.description),
      first_seen_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      download_status: document.official_url ? 'linked' : 'session_action_required',
    })),
  };
}

async function fetchList(page) {
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('#datatable-ready tbody tr', { timeout: 30000 });
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    function clean(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
    return Array.from(document.querySelectorAll('#datatable-ready tbody tr')).map(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const values = cells.map(cell => clean(cell.innerText));
      const idCell = row.querySelector('td[id^="AUC_ID_COL$"]') || cells[1];
      const anchor = idCell && idCell.querySelector('a');
      const identitySignal = [
        anchor && anchor.href,
        anchor && anchor.getAttribute('onclick'),
        idCell && idCell.getAttribute('onclick'),
        idCell && idCell.innerHTML,
      ].filter(Boolean).join(' ');
      return {
        event_id: values[1] || '',
        title: values[2] || '',
        department: values[3] || '',
        end_date_raw: values[4] || '',
        status: values[5] || '',
        identity_signal: identitySignal,
      };
    }).filter(row => row.event_id);
  }).then(rows => rows.map(row => Object.assign(row, parseListIdentity(row.identity_signal, row.event_id))));
}

async function fetchDetail(ctx, listPage, row, includePackage) {
  const popupPromise = ctx.waitForEvent('page', { timeout: 15000 });
  const clicked = await listPage.evaluate(eventId => {
    const cells = Array.from(document.querySelectorAll('#datatable-ready td[id^="AUC_ID_COL$"]'));
    const target = cells.find(cell => cell.innerText.trim() === eventId);
    if (!target) return false;
    target.scrollIntoView({ block: 'center' });
    target.click();
    return true;
  }, row.event_id);
  if (!clicked) return null;

  let popup;
  try {
    popup = await popupPromise;
  } catch (_) {
    return null;
  }

  try {
    await popup.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await popup.waitForFunction(() => {
      const text = document.body.innerText || '';
      return text.includes('Event ID') && (text.includes('Description:') || text.includes('Contact Information'));
    }, { timeout: 20000 }).catch(() => {});
    await popup.waitForTimeout(1500);
    const text = await popup.evaluate(() => document.body.innerText || '');
    const detail = parseDetailText(text, popup.url());
    detail.url = popup.url();
    if (!detail.business_unit && row.business_unit) detail.business_unit = row.business_unit;
    if (!detail.event_id) detail.event_id = row.event_id;

    if (includePackage) {
      const packageResult = await fetchEventPackage(ctx, popup, detail.event_round, detail.event_version);
      detail.package_fetched = packageResult.fetched;
      detail.document_urls = packageResult.documents;
      await sleep(PACKAGE_DELAY_MS);
    } else {
      detail.package_fetched = false;
      detail.document_urls = [];
    }

    await popup.close().catch(() => {});
    return detail;
  } catch (error) {
    console.log('[scrape-caleprocure] detail fetch failed for', row.event_id, ':', error.message);
    await popup.close().catch(() => {});
    return null;
  }
}

function findExisting(existingData, row) {
  const opportunities = existingData.opportunities || [];
  const key = buildSourceRecordId(row.business_unit, row.event_id);
  if (key) {
    const exact = opportunities.find(item => item.source_record_id === key
      || (String(item.business_unit || '') === String(row.business_unit) && String(item.id) === String(row.event_id)));
    if (exact) return exact;
  }
  const matches = opportunities.filter(item => String(item.id) === String(row.event_id));
  return matches.length === 1 ? matches[0] : null;
}

function needsDetail(row, existing, now) {
  if (!existing || !existing.detail_fetched || !existing.business_unit) return true;
  const currentListFingerprint = hashJson({ title: row.title, department: row.department, end_date_raw: row.end_date_raw, status: row.status });
  if (existing.list_fingerprint !== currentListFingerprint) return true;
  const lastFetched = Date.parse(existing.last_detail_fetched_at || '');
  if (Number.isNaN(lastFetched) || now - lastFetched >= REFRESH_HOURS * 3600000) return true;
  const closeDate = parseCaliforniaDate(row.end_date_raw);
  if (closeDate && Date.parse(closeDate) - now <= 7 * 86400000) return true;
  return false;
}

function stableEntry(row, existing, detail, observedAt) {
  const businessUnit = (detail && detail.business_unit) || row.business_unit || (existing && existing.business_unit) || null;
  const eventId = row.event_id;
  const sourceRecordId = buildSourceRecordId(businessUnit, eventId);
  const closeDate = parseCaliforniaDate(row.end_date_raw);
  const officialUrl = businessUnit ? 'https://caleprocure.ca.gov/event/' + encodeURIComponent(businessUnit) + '/' + encodeURIComponent(eventId) : null;
  const documentUrls = detail && detail.package_fetched && detail.document_urls.length
    ? detail.document_urls
    : (existing && existing.document_urls) || [];
  const eventRound = (detail && detail.event_round) || (existing && existing.event_round) || 1;
  const eventVersion = (detail && detail.event_version) || (existing && existing.event_version) || 1;
  const addenda = documentUrls.filter(document => document.document_type === 'addendum');
  const description = (detail && detail.description) || (existing && existing.description) || null;
  const solicitationNumber = (detail && detail.solicitation_number)
    || (existing && existing.solicitation_number)
    || extractSolicitationNumber(row.title, description);

  const record = {
    id: eventId,
    business_unit: businessUnit,
    source_record_id: sourceRecordId,
    title: row.title,
    department: row.department,
    bid_type: (detail && detail.format_type) || (existing && existing.bid_type) || 'SOLICITATION',
    close_date: closeDate,
    due_in_days: closeDate ? Math.ceil((Date.parse(closeDate) - Date.now()) / 86400000) : null,
    status: row.status,
    published_date: (detail && detail.published_date) || (existing && existing.published_date) || null,
    published_date_raw: (detail && detail.published_date_raw) || (existing && existing.published_date_raw) || null,
    description,
    solicitation_number: solicitationNumber,
    contact_name: (detail && detail.contact_name) || (existing && existing.contact_name) || null,
    contact_email: (detail && detail.contact_email) || (existing && existing.contact_email) || null,
    contact_phone: (detail && detail.contact_phone) || (existing && existing.contact_phone) || null,
    unspsc_codes: (detail && detail.unspsc_codes) || (existing && existing.unspsc_codes) || [],
    service_areas: (detail && detail.service_areas) || (existing && existing.service_areas) || [],
    prebid_datetime: (detail && detail.prebid_datetime) || (existing && existing.prebid_datetime) || null,
    prebid_location: (detail && detail.prebid_location) || (existing && existing.prebid_location) || null,
    mandatory_prebid: detail ? detail.mandatory_prebid : Boolean(existing && existing.mandatory_prebid),
    question_deadline: (detail && detail.question_deadline) || (existing && existing.question_deadline) || null,
    set_asides: (detail && detail.set_asides) || (existing && existing.set_asides) || [],
    certifications_required: (detail && detail.certifications_required) || (existing && existing.certifications_required) || [],
    contractor_license: (detail && detail.contractor_license) || (existing && existing.contractor_license) || null,
    event_round: eventRound,
    event_version: eventVersion,
    amendment_number: addenda.length ? String(addenda.length) : (eventVersion > 1 ? 'R' + eventRound + '-V' + eventVersion : null),
    amendment_count: Math.max(addenda.length, eventVersion > 1 ? eventVersion - 1 : 0),
    document_urls: documentUrls,
    package_fetched: Boolean((detail && detail.package_fetched) || (existing && existing.package_fetched)),
    detail_fetched: Boolean((detail && detail.description) || (existing && existing.detail_fetched)),
    url: (detail && detail.url) || officialUrl || (existing && existing.url) || SEARCH_URL,
    official_url: officialUrl || (existing && existing.official_url) || null,
    first_seen_at: (existing && existing.first_seen_at) || observedAt,
    last_seen_at: observedAt,
    last_detail_fetched_at: detail ? observedAt : (existing && existing.last_detail_fetched_at) || null,
    list_fingerprint: hashJson({ title: row.title, department: row.department, end_date_raw: row.end_date_raw, status: row.status }),
  };

  record.content_fingerprint = hashJson({
    business_unit: record.business_unit,
    event_id: record.id,
    title: record.title,
    department: record.department,
    status: record.status,
    close_date: record.close_date,
    published_date: record.published_date,
    description: record.description,
    event_round: record.event_round,
    event_version: record.event_version,
    unspsc_codes: record.unspsc_codes,
    service_areas: record.service_areas,
    prebid_datetime: record.prebid_datetime,
    question_deadline: record.question_deadline,
    document_urls: record.document_urls.map(document => ({
      filename: document.filename,
      official_url: document.official_url,
      document_type: document.document_type,
      event_version: document.event_version,
    })),
  });
  record.last_changed_at = existing && existing.content_fingerprint === record.content_fingerprint
    ? (existing.last_changed_at || existing.last_detail_fetched_at || observedAt)
    : observedAt;

  return record;
}

async function main() {
  let existingData = { opportunities: [] };
  if (fs.existsSync(OUT_FILE)) {
    try { existingData = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch (_) {}
  }

  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      From: 'bot@aproposgroupllc.com',
      'X-PDAS-Agent': 'APROPOS-PDAS/1.0',
    },
    viewport: { width: 1400, height: 1000 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    acceptDownloads: true,
  });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await ctx.newPage();

  console.log('[scrape-caleprocure] loading statewide event list...');
  let rows = await fetchList(page);
  rows = rows.filter(row => normalizeSpace(row.status).toLowerCase() === 'posted');
  console.log('[scrape-caleprocure] list loaded:', rows.length, 'Posted events');

  const now = Date.now();
  const candidates = rows.map(row => ({ row, existing: findExisting(existingData, row) }))
    .filter(item => needsDetail(item.row, item.existing, now));
  candidates.sort((a, b) => {
    const aClose = Date.parse(parseCaliforniaDate(a.row.end_date_raw) || '') || Number.MAX_SAFE_INTEGER;
    const bClose = Date.parse(parseCaliforniaDate(b.row.end_date_raw) || '') || Number.MAX_SAFE_INTEGER;
    if (!a.existing || !a.existing.detail_fetched) return -1;
    if (!b.existing || !b.existing.detail_fetched) return 1;
    return aClose - bClose;
  });

  const toFetch = candidates.slice(0, DETAIL_LIMIT);
  console.log('[scrape-caleprocure] ' + candidates.length + ' event(s) require detail verification; fetching ' + toFetch.length + '.');

  const detailByEvent = new Map();
  let packagesRequested = 0;
  for (let index = 0; index < toFetch.length; index += 1) {
    const item = toFetch[index];
    const includePackage = packagesRequested < PACKAGE_LIMIT
      && (!item.existing || !item.existing.package_fetched || needsDetail(item.row, item.existing, now));
    process.stdout.write('[scrape-caleprocure] detail ' + (index + 1) + '/' + toFetch.length + ' (' + item.row.event_id + ')... ');
    const detail = await fetchDetail(ctx, page, item.row, includePackage);
    console.log(detail ? 'ok' : 'FAILED');
    if (detail) {
      detailByEvent.set(item.row.event_id, detail);
      if (includePackage) packagesRequested += 1;
    }
    await sleep(DETAIL_DELAY_MS);
  }

  await browser.close();

  const observedAt = new Date().toISOString();
  const opportunities = rows.map(row => {
    const existing = findExisting(existingData, row);
    return stableEntry(row, existing, detailByEvent.get(row.event_id), observedAt);
  });

  const conceptMatchSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'concept-match.js'), 'utf8');
  const sandbox = { window: {} };
  require('vm').createContext(sandbox);
  require('vm').runInContext(conceptMatchSrc, sandbox);
  const ConceptMatch = sandbox.window.ConceptMatch;
  const dict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'concept-dictionary.json'), 'utf8'));

  const flagged = [];
  opportunities.forEach(opportunity => {
    const text = [opportunity.title, opportunity.department, opportunity.description || ''].join(' ');
    opportunity.concept_tags = ConceptMatch.tagText(text, dict);
    if (!opportunity.concept_tags.length) flagged.push({ id: opportunity.id, title: opportunity.title, department: opportunity.department });
  });

  const payload = {
    source: 'caleprocure',
    search_url: SEARCH_URL,
    generatedAt: observedAt,
    count: opportunities.length,
    detail_fetched_count: opportunities.filter(item => item.detail_fetched).length,
    package_fetched_count: opportunities.filter(item => item.package_fetched).length,
    business_unit_resolved_count: opportunities.filter(item => item.business_unit).length,
    document_count: opportunities.reduce((sum, item) => sum + item.document_urls.length, 0),
    flagged_count: flagged.length,
    opportunities,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log('[scrape-caleprocure] WROTE caleprocure.json — ' + opportunities.length + ' events, ' +
    payload.detail_fetched_count + ' detailed, ' + payload.package_fetched_count + ' packages, ' +
    payload.business_unit_resolved_count + ' Business Units resolved, ' + payload.document_count + ' documents.');
}

main().catch(error => {
  console.error('[scrape-caleprocure] FAILED:', error.message);
  process.exit(1);
});
