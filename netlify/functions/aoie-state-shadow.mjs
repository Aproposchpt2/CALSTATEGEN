import {
  ENGINE_VERSION,
  ONTOLOGY_VERSION,
  SCORING_VERSION,
  expandBusinessProfile,
  scoreStateLocalMatch,
} from './_shared/aoie-state-local.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const PAGE_SIZE = 1000;
const ALLOWED_STATES = new Set(['CA', 'NV', 'AZ']);
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const env = (name) => globalThis.Netlify?.env?.get(name) || process.env[name] || '';
const dbHeaders = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', ...extra });

async function authenticate(req, url, key) {
  const internal = env('AOIE_INTERNAL_TOKEN');
  const supplied = req.headers.get('x-aoie-token') || '';
  if (internal && supplied === internal) return { mode: 'internal', subscriber: null };
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const query = new URLSearchParams({
    select: 'email,state,business_name,keywords,status,session_expires_at',
    session_token: `eq.${match[1].trim()}`,
    status: 'eq.active',
    session_expires_at: `gt.${new Date().toISOString()}`,
    limit: '1',
  });
  const response = await fetch(`${url}/rest/v1/state_alert_subscribers?${query}`, { headers: dbHeaders(key), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Session verification failed: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? { mode: 'member-session', subscriber: rows[0] } : null;
}

function normalizeStates(value, fallback) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;\s]+/);
  const states = [...new Set(source.map((item) => String(item || '').trim().toUpperCase()).filter((item) => ALLOWED_STATES.has(item)))];
  if (!states.length && fallback && ALLOWED_STATES.has(String(fallback).toUpperCase())) states.push(String(fallback).toUpperCase());
  if (!states.length) states.push('CA', 'NV');
  return states;
}

async function fetchOpportunities(url, key, states) {
  const rows = [];
  const select = ['id','pdas_record_id','state_code','issuing_organization','issuing_department','source_platform','source_record_id','source_url','official_source_url','vendor_registration_url','solicitation_number','title','description','procurement_type','notice_type','status','posted_at','response_deadline','place_of_performance_county','estimated_value_min','estimated_value_max','contact_name','contact_email','contact_phone','unspsc_codes','commodity_codes','is_latest_version','duplicate_of'].join(',');
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = new URLSearchParams({ select, state_code: `in.(${states.join(',')})`, is_latest_version: 'eq.true', duplicate_of: 'is.null', status: 'in.(open,upcoming,posted,active)', order: 'response_deadline.asc.nullslast,posted_at.desc' });
    const response = await fetch(`${url}/rest/v1/state_contract_opportunities?${query}`, { headers: dbHeaders(key, { Range: `${from}-${from + PAGE_SIZE - 1}` }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Opportunity query failed: ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function publicOpportunity(row) {
  return {
    id: row.source_record_id || row.pdas_record_id || row.id,
    solicitation_number: row.solicitation_number || row.source_record_id || '',
    title: row.title || '',
    agency: row.issuing_organization || row.issuing_department || 'Public Agency',
    state_code: row.state_code || null,
    procurement_type: row.procurement_type || row.notice_type || null,
    status: row.status || null,
    posted_at: row.posted_at || null,
    response_deadline: row.response_deadline || null,
    place_of_performance_county: row.place_of_performance_county || null,
    estimated_value_min: row.estimated_value_min ?? null,
    estimated_value_max: row.estimated_value_max ?? null,
    unspsc_codes: Array.isArray(row.unspsc_codes) ? row.unspsc_codes : [],
    commodity_codes: Array.isArray(row.commodity_codes) ? row.commodity_codes : [],
    official_source_url: row.official_source_url || row.source_url || null,
    vendor_registration_url: row.vendor_registration_url || null,
    source_platform: row.source_platform || null,
    contact_name: row.contact_name || null,
    contact_email: row.contact_email || null,
    contact_phone: row.contact_phone || null,
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');
  if (!url || !key) return json(500, { error: 'AOIE database configuration missing.' });
  try {
    const auth = await authenticate(req, url, key);
    if (!auth) return json(401, { error: 'Unauthorized.' });
    let payload;
    try { payload = await req.json(); } catch { return json(400, { error: 'Invalid JSON.' }); }
    const input = { ...(payload.profile || {}) };
    if (!input.business_name && !input.company_name && !input.legal_name && auth.subscriber?.business_name) input.business_name = auth.subscriber.business_name;
    if ((!input.keywords || !input.keywords.length) && Array.isArray(auth.subscriber?.keywords)) input.keywords = auth.subscriber.keywords;
    const profile = expandBusinessProfile(input);
    const evidence = profile.keywords.length || profile.naics_codes.length || profile.unspsc_codes.length || profile.commodity_codes.length || profile.concepts.length;
    if (!profile.legal_name) return json(400, { error: 'A business name is required.' });
    if (!evidence) return json(400, { error: 'Provide keywords, capabilities, NAICS, UNSPSC, or commodity codes.' });
    const states = normalizeStates(payload.states || profile.service_states, auth.subscriber?.state);
    const minimumScore = Math.max(0, Math.min(100, Number(payload.minimum_score ?? 35) || 35));
    const resultLimit = Math.max(1, Math.min(200, Number(payload.limit ?? 100) || 100));
    const opportunities = await fetchOpportunities(url, key, states);
    const scored = opportunities.map((row) => ({ ...publicOpportunity(row), aoie: scoreStateLocalMatch(profile, row) }));
    const results = scored.filter((row) => row.aoie.fit_score >= minimumScore && row.aoie.match_status !== 'Not Recommended').sort((a, b) => b.aoie.fit_score - a.aoie.fit_score || String(a.response_deadline || '').localeCompare(String(b.response_deadline || ''))).slice(0, resultLimit);
    const summary = scored.reduce((acc, row) => { acc[row.aoie.match_status] = (acc[row.aoie.match_status] || 0) + 1; if (row.aoie.hard_disqualifier) acc.disqualified = (acc.disqualified || 0) + 1; return acc; }, {});
    return json(200, { ok: true, mode: 'shadow', authentication_mode: auth.mode, engine_version: ENGINE_VERSION, ontology_version: ONTOLOGY_VERSION, scoring_version: SCORING_VERSION, states, profile, candidate_count: opportunities.length, result_count: results.length, minimum_score: minimumScore, summary, results });
  } catch (error) {
    console.error('[aoie-state-shadow]', error);
    return json(500, { error: 'AOIE state/local shadow evaluation failed.', detail: error instanceof Error ? error.message : String(error) });
  }
}

export const config = { path: '/api/aoie-state-shadow' };
