'use strict';
/* PDAS — synchronize source JSON into state_contract_opportunities and record
   acquisition health in pdas_acquisition_jobs / pdas_acquisition_runs. */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const TABLE = 'state_contract_opportunities';
const JOBS_TABLE = 'pdas_acquisition_jobs';
const RUNS_TABLE = 'pdas_acquisition_runs';
const BATCH_SIZE = 200;
const REQUESTED_JOB_ID = process.env.PDAS_SOURCE_JOB_ID || '';

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
  const p = path.join(__dirname, '..', file);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function toIso(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function fromPlanetBids(bid) {
  const state = bid.state || 'CA';
  const deadline = toIso(bid.close_date);
  const confidence = deadline ? 0.85 : 0.6;
  return {
    state_code: state,
    issuing_organization: bid.agency || 'Unknown agency',
    source_platform: 'planetbids',
    source_record_id: String(bid.id),
    source_url: bid.url || null,
    solicitation_number: bid.solicitation_no || null,
    title: bid.title,
    notice_type: bid.bid_type || null,
    status: 'open',
    response_deadline: deadline,
    place_of_performance_state: state,
    classifications: { category_ids: bid.category_ids || [] },
    extraction_confidence: confidence,
    data_quality_score: Math.round(confidence * 100),
    qa_status: (bid.title && deadline) ? 'auto_ingested' : 'incomplete',
    qa_notes: deadline ? null : 'response_deadline did not parse from source close_date value',
    raw_source_payload: bid,
  };
}

function fromCalEprocure(o) {
  const deadline = toIso(o.close_date);
  const confidence = o.detail_fetched ? 1.0 : 0.6;
  return {
    state_code: 'CA',
    issuing_organization: o.department || 'California state agency',
    issuing_department: o.department || null,
    source_platform: 'caleprocure',
    source_record_id: String(o.id),
    source_url: o.url || null,
    title: o.title,
    description: o.description || null,
    notice_type: o.bid_type || null,
    status: 'open',
    response_deadline: deadline,
    posted_at: toIso(o.published_date),
    place_of_performance_state: 'CA',
    contact_name: o.contact_name || null,
    contact_email: o.contact_email || null,
    contact_phone: o.contact_phone || null,
    unspsc_codes: (o.unspsc_codes || []).map(c => c.code).filter(Boolean),
    keywords: o.concept_tags || [],
    extraction_confidence: confidence,
    data_quality_score: Math.round(confidence * 100),
    qa_status: (o.title && deadline) ? 'auto_ingested' : 'incomplete',
    qa_notes: !deadline ? 'response_deadline did not parse from source close_date value'
      : (!o.detail_fetched ? 'list-only record, detail popup not yet fetched' : null),
    raw_source_payload: o,
  };
}

function fromObas(o, bulletinUrl) {
  const contactMatch = /([\d.\-() ]{7,20})\s*\|\s*([\w.+-]+@[\w-]+\.[\w.-]+)/.exec(o.contact || '');
  return {
    state_code: 'CA',
    issuing_organization: 'California Department of General Services (OBAS)',
    issuing_department: o.category || null,
    source_platform: 'obas',
    source_record_id: String(o.id),
    source_url: bulletinUrl || null,
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
    extraction_confidence: 0.95,
    data_quality_score: 95,
    qa_status: 'auto_ingested',
    qa_notes: null,
    raw_source_payload: o,
  };
}

const ROW_KEYS = [
  'state_code', 'issuing_organization', 'issuing_department', 'source_platform',
  'source_record_id', 'source_url', 'solicitation_number', 'title', 'description',
  'notice_type', 'status', 'response_deadline', 'posted_at',
  'place_of_performance_state', 'place_of_performance_county',
  'estimated_value_min', 'estimated_value_max', 'contact_name', 'contact_email',
  'contact_phone', 'unspsc_codes', 'keywords', 'classifications',
  'extraction_confidence', 'data_quality_score', 'qa_status', 'qa_notes',
  'raw_source_payload',
];

function normalizeRow(row) {
  const out = {};
  ROW_KEYS.forEach(k => { out[k] = row[k] !== undefined ? row[k] : null; });
  return out;
}

async function request(table, method, query, body, prefer) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + (query || ''), {
    method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(table + ' ' + method + ' failed (' + res.status + '): ' + text.slice(0, 400));
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function upsertBatch(rows) {
  if (!rows.length) return { ok: 0, failed: 0, error: null };
  let ok = 0, failed = 0, lastError = null;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      await request(TABLE, 'POST', '?on_conflict=source_platform,source_record_id', chunk,
        'resolution=merge-duplicates,return=minimal');
      ok += chunk.length;
    } catch (e) {
      lastError = e.message;
      console.log('[sync-supabase] batch upsert FAILED:', e.message);
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
      { status: 'closed', closed_at: nowIso }, 'return=representation');
    return Array.isArray(rows) ? rows.length : 0;
  } catch (e) {
    console.log('[sync-supabase] close-expired FAILED:', e.message);
    return 0;
  }
}

function sourceRows(jobId) {
  const source = SOURCES[jobId];
  if (!source) throw new Error('Unknown PDAS_SOURCE_JOB_ID: ' + jobId);
  const data = readJson(source.file);
  const list = data && Array.isArray(data[source.listKey]) ? data[source.listKey] : [];
  const rows = jobId === 'CA-OBAS'
    ? list.map(o => fromObas(o, data ? data.bulletin_url : null))
    : list.map(source.map);
  return rows.map(normalizeRow);
}

async function syncOne(jobId) {
  const rows = sourceRows(jobId);
  console.log('[sync-supabase] ' + jobId + ': ' + rows.length + ' record(s) mapped');
  const monitor = await startMonitoring(jobId, rows.length);
  let result;
  try {
    result = await upsertBatch(rows);
  } catch (e) {
    result = { ok: 0, failed: rows.length, error: e.message };
  }
  await finishMonitoring(jobId, monitor, result);
  console.log('[sync-supabase] ' + jobId + ': ' + result.ok + ' upserted, ' + result.failed + ' failed');
  return result;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('[sync-supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase sync.');
    return;
  }

  const jobIds = REQUESTED_JOB_ID ? [REQUESTED_JOB_ID] : Object.keys(SOURCES);
  let totalOk = 0, totalFailed = 0;
  for (const jobId of jobIds) {
    const result = await syncOne(jobId);
    totalOk += result.ok;
    totalFailed += result.failed;
  }

  const closed = await closeExpired('CA');
  console.log('[sync-supabase] total: ' + totalOk + ' upserted, ' + totalFailed + ' failed; ' + closed + ' expired CA row(s) closed.');
}

main().catch(e => {
  console.error('[sync-supabase] FAILED:', e.message);
  process.exit(0);
});
