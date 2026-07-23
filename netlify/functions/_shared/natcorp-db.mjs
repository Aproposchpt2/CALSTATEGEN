import { idempotencyKey } from './natcorp-core.mjs';

export const env = (name) => globalThis.Netlify?.env?.get(name) || process.env[name] || '';
export const nowIso = () => new Date().toISOString();
export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const text = (v) => String(v ?? '').trim();
export const asArray = (v) => Array.isArray(v) ? v : [];

export function sameOrigin(req) {
  const target = new URL(req.url);
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const site = req.headers.get('sec-fetch-site');
  if (origin && origin !== target.origin) return false;
  if (referer) { try { if (new URL(referer).origin !== target.origin) return false; } catch { return false; } }
  return origin === target.origin || Boolean(referer) || site === 'same-origin';
}

export function internalAuthorized(req) {
  const expected = env('NATCORP_INTERNAL_TOKEN_PRODUCTION') || env('NATCORP_INTERNAL_TOKEN');
  return Boolean(expected && req.headers.get('x-natcorp-internal-token') === expected);
}

export function commandAuthorized(req) {
  const expected = env('NATCORP_OPERATOR_ACCESS') || env('NATCORP_COMMAND_KEY');
  return Boolean(expected && req.headers.get('x-natcorp-command-key') === expected);
}

function dbConfig() {
  const base = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');
  if (!base || !key) throw new Error('Supabase server configuration is missing.');
  return { base, key };
}

export async function db(table, method = 'GET', query = '', body, prefer = '') {
  const { base, key } = dbConfig();
  const headers = { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${base}/rest/v1/${table}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(55000) });
  const raw = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`${table} ${method} failed (${response.status}): ${raw.slice(0, 700)}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export const rpc = (name, payload) => db(`rpc/${name}`, 'POST', '', payload, 'return=representation');

export async function emit(runId, eventType, sourceAgent, payload = {}, entityType = 'daily_run', entityId = runId) {
  await db('natcorp_workflow_events', 'POST', '', [{ run_id: runId, event_type: eventType, source_agent: sourceAgent, entity_type: entityType, entity_id: entityId, payload }], 'return=minimal');
}

export async function getRun(runId) {
  const rows = await db('natcorp_daily_runs', 'GET', `?run_id=eq.${encodeURIComponent(runId)}&select=*`);
  return rows?.[0] || null;
}

export async function getAgentJob(runId, agent) {
  const key = idempotencyKey(runId, agent);
  const rows = await db('natcorp_agent_jobs', 'GET', `?idempotency_key=eq.${encodeURIComponent(key)}&select=*`);
  return rows?.[0] || null;
}

export async function ensureAgentJob(runId, agent, inputPayload) {
  const existing = await getAgentJob(runId, agent);
  if (existing) return existing;
  const rows = await db('natcorp_agent_jobs', 'POST', '', [{
    run_id: runId, agent_type: agent, entity_type: 'daily_run', entity_id: runId,
    status: 'queued', priority: 100, attempts: 0, max_attempts: 3,
    input_payload: inputPayload || {}, output_payload: {}, idempotency_key: idempotencyKey(runId, agent),
  }], 'resolution=ignore-duplicates,return=representation');
  return rows?.[0] || await getAgentJob(runId, agent);
}

export async function patchJob(jobId, patch) {
  const rows = await db('natcorp_agent_jobs', 'PATCH', `?job_id=eq.${encodeURIComponent(jobId)}`, patch, 'return=representation');
  return rows?.[0] || null;
}

export async function patchRun(runId, patch) {
  const rows = await db('natcorp_daily_runs', 'PATCH', `?run_id=eq.${encodeURIComponent(runId)}`, patch, 'return=representation');
  return rows?.[0] || null;
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
