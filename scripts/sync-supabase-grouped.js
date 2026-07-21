'use strict';

/* PostgREST requires every object in one bulk request to expose the same key
   set. PDAS intentionally omits unknown null fields so incomplete source data
   cannot erase previously verified values. This writer preserves that safety
   by grouping normalized rows by key set before each idempotent upsert. */

const { sourceRows } = require('./sync-supabase');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const JOB_ID = process.env.PDAS_SOURCE_JOB_ID || 'CA-CALEPROCURE';
const TABLE = 'state_contract_opportunities';
const JOBS_TABLE = 'pdas_acquisition_jobs';
const RUNS_TABLE = 'pdas_acquisition_runs';
const BATCH_SIZE = 100;

function headers(extra) {
  return Object.assign({
    apikey: SERVICE_KEY,
    authorization: 'Bearer ' + SERVICE_KEY,
    'content-type': 'application/json',
  }, extra || {});
}

async function request(table, method, query, body, prefer) {
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + (query || ''), {
    method,
    headers: headers(prefer ? { Prefer: prefer } : undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(table + ' ' + method + ' failed (' + response.status + '): ' + text.slice(0, 600));
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

function groupRowsByKeySet(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const key = Object.keys(row).sort().join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return Array.from(groups.values());
}

function triggerType() {
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') return 'manual';
  if (process.env.GITHUB_EVENT_NAME === 'push') return 'push';
  return 'scheduled';
}

function makeRunId() {
  return [JOB_ID, process.env.GITHUB_RUN_ID || 'local', process.env.GITHUB_RUN_ATTEMPT || '1', Date.now()].join(':');
}

async function startRun(discovered) {
  const startedAt = new Date().toISOString();
  const ingestionRunId = makeRunId();
  await request(RUNS_TABLE, 'POST', '', [{
    job_id: JOB_ID,
    ingestion_run_id: ingestionRunId,
    trigger_type: triggerType(),
    run_status: 'running',
    started_at: startedAt,
    records_discovered: discovered,
    source_revision: process.env.GITHUB_SHA || null,
    metadata: {
      workflow: process.env.GITHUB_WORKFLOW || null,
      workflow_run_id: process.env.GITHUB_RUN_ID || null,
      workflow_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      repository: process.env.GITHUB_REPOSITORY || null,
      writer: 'grouped-keyset-upsert',
    },
  }], 'return=minimal');
  await request(JOBS_TABLE, 'PATCH', '?job_id=eq.' + encodeURIComponent(JOB_ID), {
    job_status: 'running',
    last_started_at: startedAt,
    last_records_discovered: discovered,
    last_error: null,
    updated_at: startedAt,
  }, 'return=minimal');
  return { startedAt, ingestionRunId };
}

async function finishRun(run, result) {
  const completedAt = new Date().toISOString();
  const runtimeMs = Math.max(0, Date.parse(completedAt) - Date.parse(run.startedAt));
  const runStatus = result.failed === 0 ? 'succeeded' : ((result.inserted + result.updated) > 0 ? 'partial' : 'failed');
  const jobStatus = runStatus === 'succeeded' ? 'healthy' : (runStatus === 'partial' ? 'degraded' : 'failed');

  await request(RUNS_TABLE, 'PATCH',
    '?job_id=eq.' + encodeURIComponent(JOB_ID) + '&ingestion_run_id=eq.' + encodeURIComponent(run.ingestionRunId), {
      run_status: runStatus,
      completed_at: completedAt,
      runtime_ms: runtimeMs,
      records_inserted: result.inserted,
      records_updated: result.updated,
      records_failed: result.failed,
      error_message: result.error || null,
    }, 'return=minimal');

  const patch = {
    job_status: jobStatus,
    last_completed_at: completedAt,
    last_records_inserted: result.inserted,
    last_records_updated: result.updated,
    last_records_failed: result.failed,
    last_runtime_ms: runtimeMs,
    last_error: result.error || null,
    updated_at: completedAt,
  };
  if (runStatus === 'succeeded') {
    patch.last_success_at = completedAt;
    patch.consecutive_failures = 0;
  } else {
    patch.last_failure_at = completedAt;
  }
  await request(JOBS_TABLE, 'PATCH', '?job_id=eq.' + encodeURIComponent(JOB_ID), patch, 'return=minimal');
}

async function migrateLegacyIds(rows, existingRows) {
  const bySourceId = new Map(existingRows.map(row => [String(row.source_record_id), row]));
  let migrated = 0;
  for (const row of rows) {
    if (row.source_platform !== 'caleprocure' || !row.raw_source_payload) continue;
    const legacyId = String(row.raw_source_payload.id || '');
    const canonicalId = String(row.source_record_id || '');
    if (!legacyId || !canonicalId || legacyId === canonicalId) continue;
    const legacy = bySourceId.get(legacyId);
    if (!legacy || bySourceId.has(canonicalId)) continue;
    await request(TABLE, 'PATCH', '?id=eq.' + encodeURIComponent(legacy.id), {
      source_record_id: canonicalId,
      source_fingerprint: row.source_fingerprint,
      qa_notes: 'Migrated from legacy Event ID identity to Business Unit:Event ID identity.',
    }, 'return=minimal');
    bySourceId.delete(legacyId);
    bySourceId.set(canonicalId, Object.assign({}, legacy, { source_record_id: canonicalId }));
    migrated += 1;
  }
  return { migrated, bySourceId };
}

async function upsertGroups(rows) {
  const groups = groupRowsByKeySet(rows);
  let written = 0;
  for (const group of groups) {
    for (let index = 0; index < group.length; index += BATCH_SIZE) {
      const chunk = group.slice(index, index + BATCH_SIZE);
      await request(TABLE, 'POST', '?on_conflict=source_platform,source_record_id', chunk,
        'resolution=merge-duplicates,return=minimal');
      written += chunk.length;
    }
  }
  return { written, groups: groups.length };
}

async function closeExpiredCaliforniaRows() {
  const nowIso = new Date().toISOString();
  try {
    const rows = await request(TABLE, 'PATCH',
      '?state_code=eq.CA&status=neq.closed&response_deadline=lt.' + encodeURIComponent(nowIso),
      { status: 'closed' }, 'return=representation');
    return Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.log('[sync-supabase-grouped] close-expired warning:', error.message);
    return 0;
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const source = sourceRows(JOB_ID);
  const run = await startRun(source.discovered);
  let result = { inserted: 0, updated: 0, failed: source.skipped, error: null };

  try {
    const existingRows = await request(TABLE, 'GET', '?source_platform=eq.caleprocure&select=id,source_record_id', undefined);
    const migration = await migrateLegacyIds(source.rows, existingRows || []);
    const canonicalBefore = new Set(Array.from(migration.bySourceId.keys()));
    result.updated = source.rows.filter(row => canonicalBefore.has(String(row.source_record_id))).length;
    result.inserted = source.rows.length - result.updated;
    const upsert = await upsertGroups(source.rows);
    if (upsert.written !== source.rows.length) throw new Error('Grouped upsert count mismatch');
    if (source.skipped) result.error = source.skipped + ' source record(s) deferred because Business Unit identity is unresolved';
    const closed = await closeExpiredCaliforniaRows();
    console.log('[sync-supabase-grouped] migrated=' + migration.migrated + ' inserted=' + result.inserted + ' updated=' + result.updated + ' deferred=' + source.skipped + ' groups=' + upsert.groups + ' closed=' + closed);
  } catch (error) {
    result.failed = source.discovered;
    result.inserted = 0;
    result.updated = 0;
    result.error = error.message;
    console.error('[sync-supabase-grouped] FAILED:', error.message);
  }

  await finishRun(run, result);
  if (result.inserted + result.updated === 0 && result.failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error('[sync-supabase-grouped] FATAL:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { groupRowsByKeySet };
