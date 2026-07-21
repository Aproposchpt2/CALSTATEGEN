'use strict';
/* PDAS — synchronize source JSON into state_contract_opportunities and record
   acquisition health in pdas_acquisition_jobs / pdas_acquisition_runs. */

const fs = require('fs');
const path = require('path');
const {
  buildSourceRecordId,
  normalizeStatus,
  hashJson,
} = require('./lib/caleprocure-normalize');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const TABLE = 'state_contract_opportunities';
const JOBS_TABLE = 'pdas_acquisition_jobs';
const RUNS_TABLE = 'pdas_acquisition_runs';
const BATCH_SIZE = 200;
const REQUESTED_JOB_ID = process.env.PDAS_SOURCE_JOB_ID || '';
const CALEPROCURE_VENDOR_URL = 'https://www.caleprocure.ca.gov/pages/bidder-vendor.aspx';

const SOURCES = {
  'CA-PLANETBIDS': { file: 'bids.json', listKey: 'bids', map: fromPlanetBids },
  'CA-CALEPROCURE': { file: 'caleprocure.json', listKey: 'opportunities', map: fromCalEprocure },
  'CA-OBAS': { file: 'obas.json', listKey: 'opportunities', map: null },
};

function sbHeaders(extra) {
  return Object.assign({
    apikey: SERVICE_KEY,
    authorization: 'Bearer ' + SERVICE_KEY,
    'content-type': 'application/json',
  }, extra || {});
}

function readJson(file) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return null; }
}

function toIso(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function fromPlanetBids(bid) {
  const state = bid.state || 'CA';
  const deadline = toIso(bid.close_date);
  const confidence = deadline ? 0.85 : 0.6;
  return {
    state_code: state,
    jurisdiction_type: 'local',
    jurisdiction_name: bid.agency || null,
    issuing_organization: bid.agency || 'Unknown agency',
    source_platform: 'planetbids',
    source_record_id: String(bid.id),
    source_url: bid.url || null,
    official_source_url: bid.url || null,
    solicitation_number: bid.solicitation_no || null,
    title: bid.title,
    notice_type: bid.bid_type || null,
    status: normalizeStatus('open', deadline),
    response_deadline: deadline,
    place_of_performance_state: state,
    classifications: { category_ids: bid.category_ids || [] },
    extraction_confidence: confidence,
    data_quality_score: Math.round(confidence * 100),
    qa_status: (bid.title && deadline) ? 'auto_ingested' : 'incomplete',
    qa_notes: deadline ? null : 'response_deadline did not parse from source close_date value',
    acquisition_method: 'official_public_web_application',
    last_seen_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    raw_source_payload: bid,
  };
}

function inferProcurementType(formatType, title, description) {
  const text = [formatType, title, description].filter(Boolean).join(' ').toLowerCase();
  if (/construction|public works|contractor license/.test(text)) return 'construction';
  if (/information technology|software|hardware|network|computer/.test(text)) return 'information_technology';
  if (/goods|supplies|equipment|materials/.test(text)) return 'goods';
  if (/request for information|\brfi\b/.test(text)) return 'market_research';
  return 'services';
}

function buildCalEprocureQuality(o, deadline, documents) {
  let score = 45;
  if (o.business_unit) score += 15;
  if (deadline) score += 10;
  if (o.description) score += 10;
  if (o.contact_email || o.contact_phone) score += 5;
  if ((o.unspsc_codes || []).length) score += 5;
  if (documents.length) score += 10;
  return Math.min(score, 100);
}

function fromCalEprocure(o) {
  const businessUnit = String(o.business_unit || '').trim();
  const eventId = String(o.id || '').trim();
  const sourceRecordId = buildSourceRecordId(businessUnit, eventId);
  if (!sourceRecordId) return null;

  const now = new Date().toISOString();
  const deadline = toIso(o.close_date);
  const postedAt = toIso(o.published_date);
  const documents = Array.isArray(o.document_urls) ? o.document_urls : [];
  const eventRound = Number(o.event_round || 1);
  const eventVersion = Number(o.event_version || 1);
  const normalizedStatus = normalizeStatus(o.status, deadline);
  const sourceUrl = o.url || o.official_url || ('https://caleprocure.ca.gov/event/' + encodeURIComponent(businessUnit) + '/' + encodeURIComponent(eventId));
  const officialSourceUrl = o.official_url || sourceUrl;
  const quality = buildCalEprocureQuality(o, deadline, documents);
  const sourceFingerprint = hashJson({ state_code: 'CA', source_platform: 'caleprocure', source_record_id: sourceRecordId });
  const contentFingerprint = o.content_fingerprint || hashJson({
    title: o.title,
    department: o.department,
    status: normalizedStatus,
    deadline,
    description: o.description || null,
    event_round: eventRound,
    event_version: eventVersion,
    unspsc_codes: o.unspsc_codes || [],
    documents,
  });

  const requirements = {
    mandatory_prebid: Boolean(o.mandatory_prebid),
    prebid_location: o.prebid_location || null,
    contractor_license: o.contractor_license || null,
    response_method: 'See official event package',
  };

  const classifications = {
    business_unit: businessUnit,
    event_id: eventId,
    event_round: eventRound,
    event_version: eventVersion,
    event_format_type: o.bid_type || null,
    service_areas: o.service_areas || [],
    unspsc_descriptions: (o.unspsc_codes || []).map(item => ({ code: item.code, description: item.description })),
    source_list_fingerprint: o.list_fingerprint || null,
  };

  const qaNotes = [];
  if (!deadline) qaNotes.push('response_deadline did not parse from source close_date value');
  if (!o.detail_fetched) qaNotes.push('list-only record; event detail not yet verified');
  if (!o.package_fetched) qaNotes.push('event package not yet verified');

  return {
    state_code: 'CA',
    jurisdiction_type: 'state',
    jurisdiction_name: 'California',
    issuing_organization: o.department || 'California state agency',
    issuing_department: o.department || null,
    source_platform: 'caleprocure',
    source_record_id: sourceRecordId,
    source_url: sourceUrl,
    official_source_url: officialSourceUrl,
    vendor_registration_url: CALEPROCURE_VENDOR_URL,
    solicitation_number: o.solicitation_number || null,
    title: o.title,
    description: o.description || null,
    procurement_type: inferProcurementType(o.bid_type, o.title, o.description),
    notice_type: o.bid_type || null,
    status: normalizedStatus,
    posted_at: postedAt,
    response_deadline: deadline,
    prebid_datetime: toIso(o.prebid_datetime),
    question_deadline: toIso(o.question_deadline),
    place_of_performance_county: (o.service_areas || [])[0] || null,
    place_of_performance_state: 'CA',
    contact_name: o.contact_name || null,
    contact_email: o.contact_email || null,
    contact_phone: o.contact_phone || null,
    unspsc_codes: (o.unspsc_codes || []).map(item => item.code).filter(Boolean),
    set_asides: o.set_asides || [],
    certifications_required: o.certifications_required || [],
    keywords: o.concept_tags || [],
    document_urls: documents,
    classifications,
    requirements,
    source_fingerprint: sourceFingerprint,
    content_fingerprint: contentFingerprint,
    amendment_number: o.amendment_number || null,
    amendment_count: Number(o.amendment_count !== undefined ? o.amendment_count : Math.max(0, eventVersion - 1)),
    is_latest_version: true,
    first_seen_at: toIso(o.first_seen_at) || now,
    last_seen_at: toIso(o.last_seen_at) || now,
    last_verified_at: o.detail_fetched ? (toIso(o.last_detail_fetched_at) || now) : null,
    last_changed_at: toIso(o.last_changed_at) || now,
    closed_at: normalizedStatus === 'closed' ? deadline : null,
    acquisition_method: 'official_public_search_and_event_detail',
    extraction_confidence: o.detail_fetched ? (o.package_fetched ? 1.0 : 0.9) : 0.65,
    data_quality_score: quality,
    qa_status: quality >= 85 ? 'auto_ingested' : (quality >= 65 ? 'review_required' : 'incomplete'),
    qa_notes: qaNotes.length ? qaNotes.join('; ') : null,
    raw_source_payload: o,
    legacy_source_record_id: eventId,
  };
}

function fromObas(o, bulletinUrl) {
  const contactMatch = /([\d.\-() ]{7,20})\s*\|\s*([\w.+-]+@[\w-]+\.[\w.-]+)/.exec(o.contact || '');
  return {
    state_code: 'CA',
    jurisdiction_type: 'state',
    jurisdiction_name: 'California',
    issuing_organization: 'California Department of General Services (OBAS)',
    issuing_department: o.category || null,
    source_platform: 'obas',
    source_record_id: String(o.id),
    source_url: bulletinUrl || null,
    official_source_url: bulletinUrl || null,
    title: o.title,
    notice_type: 'Upcoming Solicitation (not yet open)',
    status: 'upcoming',
    place_of_performance_state: 'CA',
    place_of_performance_county: o.location || null,
    estimated_value_min: o.contract_estimate ?? null,
    estimated_value_max: o.contract_estimate ?? null,
    contact_phone: contactMatch ? contactMatch[1].trim() : null,
    contact_email: contactMatch ? contactMatch[2].trim() : null,
    unspsc_codes: o.unspsc_code ? [o.unspsc_code] : [],
    keywords: o.concept_tags || [],
    classifications: { anticipated_release_date: o.anticipated_release_date || null },
    acquisition_method: 'official_public_document_repository',
    extraction_confidence: 0.95,
    data_quality_score: 95,
    qa_status: 'auto_ingested',
    qa_notes: null,
    last_seen_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    raw_source_payload: o,
  };
}

const ROW_KEYS = [
  'state_code', 'jurisdiction_type', 'jurisdiction_name', 'issuing_organization',
  'issuing_department', 'source_platform', 'source_record_id', 'source_url',
  'official_source_url', 'vendor_registration_url', 'solicitation_number', 'title',
  'description', 'procurement_type', 'notice_type', 'status', 'posted_at',
  'response_deadline', 'prebid_datetime', 'question_deadline', 'award_date',
  'place_of_performance_city', 'place_of_performance_county',
  'place_of_performance_state', 'place_of_performance_zip', 'estimated_value_min',
  'estimated_value_max', 'currency', 'contact_name', 'contact_email', 'contact_phone',
  'naics_codes', 'nigp_codes', 'unspsc_codes', 'commodity_codes', 'set_asides',
  'certifications_required', 'keywords', 'document_urls', 'classifications',
  'requirements', 'raw_source_payload', 'source_fingerprint', 'content_fingerprint',
  'duplicate_of', 'amendment_number', 'amendment_count', 'is_latest_version',
  'first_seen_at', 'last_seen_at', 'last_verified_at', 'last_changed_at', 'closed_at',
  'acquisition_method', 'ingestion_run_id', 'extraction_confidence',
  'data_quality_score', 'qa_status', 'qa_notes',
];

const CLEARABLE_NULLS = new Set(['qa_notes', 'closed_at']);

function normalizeRow(row) {
  const out = {};
  ROW_KEYS.forEach(key => {
    if (row[key] === undefined) return;
    if (row[key] === null && !CLEARABLE_NULLS.has(key)) return;
    out[key] = row[key];
  });
  return out;
}

async function request(table, method, query, body, prefer) {
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + (query || ''), {
    method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(table + ' ' + method + ' failed (' + response.status + '): ' + text.slice(0, 400));
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function migrateLegacyCalEprocureIds(rows) {
  const caleprocureRows = rows.filter(row => row.source_platform === 'caleprocure' && row.raw_source_payload && row.raw_source_payload.id);
  if (!caleprocureRows.length) return 0;

  const existing = await request(TABLE, 'GET', '?source_platform=eq.caleprocure&select=id,source_record_id', undefined);
  const bySourceRecordId = new Map((existing || []).map(row => [String(row.source_record_id), row]));
  let migrated = 0;

  for (const row of caleprocureRows) {
    const legacyId = String(row.raw_source_payload.id);
    const canonicalId = String(row.source_record_id);
    const legacy = bySourceRecordId.get(legacyId);
    const canonical = bySourceRecordId.get(canonicalId);
    if (!legacy || canonical || legacyId === canonicalId) continue;
    try {
      await request(TABLE, 'PATCH', '?id=eq.' + encodeURIComponent(legacy.id), {
        source_record_id: canonicalId,
        source_fingerprint: row.source_fingerprint,
        qa_notes: 'Migrated from legacy Event ID identity to Business Unit:Event ID identity.',
      }, 'return=minimal');
      bySourceRecordId.delete(legacyId);
      bySourceRecordId.set(canonicalId, Object.assign({}, legacy, { source_record_id: canonicalId }));
      migrated += 1;
    } catch (error) {
      console.log('[sync-supabase] legacy identity migration failed for', legacyId, '->', canonicalId, ':', error.message);
    }
  }

  return migrated;
}

async function upsertBatch(rows) {
  if (!rows.length) return { ok: 0, failed: 0, error: null };
  let ok = 0;
  let failed = 0;
  let lastError = null;
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const chunk = rows.slice(index, index + BATCH_SIZE);
    try {
      await request(TABLE, 'POST', '?on_conflict=source_platform,source_record_id', chunk,
        'resolution=merge-duplicates,return=minimal');
      ok += chunk.length;
    } catch (error) {
      lastError = error.message;
      console.log('[sync-supabase] batch upsert FAILED:', error.message);
      failed += chunk.length;
    }
  }
  return { ok, failed, error: lastError };
}

function makeRunId(jobId) {
  return [jobId, process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', Date.now()].join(':');
}

async function startMonitoring(jobId, discovered) {
  const startedAt = new Date().toISOString();
  const ingestionRunId = makeRunId(jobId);
  await request(RUNS_TABLE, 'POST', '', [{
    job_id: jobId,
    ingestion_run_id: ingestionRunId,
    trigger_type: process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? 'manual' : 'scheduled',
    run_status: 'running',
    started_at: startedAt,
    records_discovered: discovered,
    source_revision: process.env.GITHUB_SHA || null,
    metadata: {
      workflow: process.env.GITHUB_WORKFLOW || null,
      workflow_run_id: process.env.GITHUB_RUN_ID || null,
      workflow_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      repository: process.env.GITHUB_REPOSITORY || null,
    },
  }], 'return=minimal');
  await request(JOBS_TABLE, 'PATCH', '?job_id=eq.' + encodeURIComponent(jobId), {
    job_status: 'running',
    last_started_at: startedAt,
    last_records_discovered: discovered,
    last_error: null,
    updated_at: startedAt,
  }, 'return=minimal');
  return { ingestionRunId, startedAt };
}

async function finishMonitoring(jobId, monitor, result) {
  const completedAt = new Date().toISOString();
  const runtimeMs = Math.max(0, Date.parse(completedAt) - Date.parse(monitor.startedAt));
  const status = result.failed === 0 ? 'succeeded' : (result.ok > 0 ? 'partial' : 'failed');
  const jobStatus = status === 'succeeded' ? 'healthy' : (status === 'partial' ? 'degraded' : 'failed');

  await request(RUNS_TABLE, 'PATCH',
    '?job_id=eq.' + encodeURIComponent(jobId) + '&ingestion_run_id=eq.' + encodeURIComponent(monitor.ingestionRunId), {
      run_status: status,
      completed_at: completedAt,
      runtime_ms: runtimeMs,
      records_inserted: result.ok,
      records_failed: result.failed,
      error_message: result.error || null,
    }, 'return=minimal');

  const patch = {
    job_status: jobStatus,
    last_completed_at: completedAt,
    last_records_inserted: result.ok,
    last_records_failed: result.failed,
    last_runtime_ms: runtimeMs,
    last_error: result.error || null,
    updated_at: completedAt,
  };
  if (status === 'succeeded') {
    patch.last_success_at = completedAt;
    patch.consecutive_failures = 0;
  } else {
    patch.last_failure_at = completedAt;
  }
  await request(JOBS_TABLE, 'PATCH', '?job_id=eq.' + encodeURIComponent(jobId), patch, 'return=minimal');
}

async function closeExpired(stateCode) {
  const nowIso = new Date().toISOString();
  try {
    const rows = await request(TABLE, 'PATCH',
      '?state_code=eq.' + encodeURIComponent(stateCode) +
      '&status=neq.closed&response_deadline=lt.' + encodeURIComponent(nowIso),
      { status: 'closed' }, 'return=representation');
    return Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.log('[sync-supabase] close-expired FAILED:', error.message);
    return 0;
  }
}

function sourceRows(jobId) {
  const source = SOURCES[jobId];
  if (!source) throw new Error('Unknown PDAS_SOURCE_JOB_ID: ' + jobId);
  const data = readJson(source.file);
  const list = data && Array.isArray(data[source.listKey]) ? data[source.listKey] : [];
  const mapped = jobId === 'CA-OBAS'
    ? list.map(item => fromObas(item, data ? data.bulletin_url : null))
    : list.map(source.map);
  const rows = mapped.filter(Boolean).map(normalizeRow);
  return { rows, discovered: list.length, skipped: list.length - rows.length };
}

async function syncOne(jobId) {
  const source = sourceRows(jobId);
  console.log('[sync-supabase] ' + jobId + ': ' + source.discovered + ' discovered, ' + source.rows.length + ' mapped, ' + source.skipped + ' deferred');
  const monitor = await startMonitoring(jobId, source.discovered);
  let result;
  try {
    const migrated = jobId === 'CA-CALEPROCURE' ? await migrateLegacyCalEprocureIds(source.rows) : 0;
    if (migrated) console.log('[sync-supabase] migrated ' + migrated + ' legacy Cal eProcure source identit' + (migrated === 1 ? 'y' : 'ies'));
    result = await upsertBatch(source.rows);
    result.failed += source.skipped;
    if (source.skipped && !result.error) result.error = source.skipped + ' record(s) deferred because Business Unit identity was unresolved';
  } catch (error) {
    result = { ok: 0, failed: source.discovered, error: error.message };
  }
  await finishMonitoring(jobId, monitor, result);
  console.log('[sync-supabase] ' + jobId + ': ' + result.ok + ' upserted, ' + result.failed + ' failed/deferred');
  return result;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('[sync-supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase sync.');
    return;
  }

  const jobIds = REQUESTED_JOB_ID ? [REQUESTED_JOB_ID] : Object.keys(SOURCES);
  let totalOk = 0;
  let totalFailed = 0;
  for (const jobId of jobIds) {
    const result = await syncOne(jobId);
    totalOk += result.ok;
    totalFailed += result.failed;
  }

  const closed = await closeExpired('CA');
  console.log('[sync-supabase] total: ' + totalOk + ' upserted, ' + totalFailed + ' failed/deferred; ' + closed + ' expired CA row(s) closed.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('[sync-supabase] FAILED:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  fromCalEprocure,
  normalizeRow,
  sourceRows,
  inferProcurementType,
};
