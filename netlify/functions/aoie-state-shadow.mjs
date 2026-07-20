import {
  ENGINE_VERSION,
  ONTOLOGY_VERSION,
  SCORING_VERSION,
  SOURCE_CONTRACT_VERSION,
  CANONICAL_VIEW,
  DIRECT_TABLE,
  buildCandidateQuery,
  buildRegistryIndex,
  enrichOpportunity,
  expandBusinessProfile,
  isMissingCanonicalRelation,
  publicOpportunity,
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
    select: 'email,state,business_name,keywords,commodity_codes,status,session_expires_at',
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

async function fetchRelationRows(url, key, relation, states, nowIso, canonical) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { query, range } = buildCandidateQuery({ states, nowIso, canonical, from, pageSize: PAGE_SIZE });
    const response = await fetch(`${url}/rest/v1/${relation}?${query}`, {
      headers: dbHeaders(key, { Range: range }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`${relation} query failed: ${response.status} ${body.slice(0, 240)}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    const page = await response.json();
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchCandidateRows(url, key, states, nowIso) {
  try {
    const rows = await fetchRelationRows(url, key, CANONICAL_VIEW, states, nowIso, true);
    return { rows, relation: CANONICAL_VIEW, mode: 'canonical-view', canonical_view_available: true, direct_table_fallback_used: false };
  } catch (error) {
    if (!isMissingCanonicalRelation(error.status, error.body || error.message)) throw error;
    const rows = await fetchRelationRows(url, key, DIRECT_TABLE, states, nowIso, false);
    return { rows, relation: DIRECT_TABLE, mode: 'direct-table-fallback', canonical_view_available: false, direct_table_fallback_used: true };
  }
}

async function fetchJsonRows(url, key, relation, query) {
  const response = await fetch(`${url}/rest/v1/${relation}?${query}`, { headers: dbHeaders(key), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${relation} registry query failed: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function fetchRegistry(url, key, states) {
  const publisherQuery = new URLSearchParams({
    select: 'publisher_id,state_code,organization_name,organization_type,jurisdiction_name,official_government_website,official_procurement_website,procurement_search_url,vendor_registration_url,registration_required,authentication_required,confidence_level,research_status,last_verified_at',
    state_code: `in.(${states.join(',')})`,
    research_status: 'eq.verified',
    limit: '1000',
  });
  const mappingQuery = new URLSearchParams({
    select: 'publisher_id,platform_id,is_primary,platform_role,public_search_url,vendor_registration_url,registration_required,authentication_required,active,last_verified_at',
    active: 'eq.true',
    limit: '1000',
  });
  const platformQuery = new URLSearchParams({
    select: 'platform_id,platform_name,technology_vendor,public_search_url,vendor_registration_url,authentication_required,platform_status,last_verified_at',
    platform_status: 'eq.active',
    limit: '1000',
  });
  const [publishers, publisherPlatforms, platforms] = await Promise.all([
    fetchJsonRows(url, key, 'pdas_publishers', publisherQuery),
    fetchJsonRows(url, key, 'pdas_publisher_platforms', mappingQuery),
    fetchJsonRows(url, key, 'pdas_procurement_platforms', platformQuery),
  ]);
  return { publishers, publisherPlatforms, platforms };
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
    if ((!input.commodity_codes || !input.commodity_codes.length) && Array.isArray(auth.subscriber?.commodity_codes)) input.commodity_codes = auth.subscriber.commodity_codes;
    const profile = expandBusinessProfile(input);
    const evidence = profile.keywords.length || profile.naics_codes.length || profile.unspsc_codes.length || profile.commodity_codes.length || profile.concepts.length;
    if (!profile.legal_name) return json(400, { error: 'A business name is required.' });
    if (!evidence) return json(400, { error: 'Provide keywords, capabilities, NAICS, UNSPSC, or commodity codes.' });
    const states = normalizeStates(payload.states || profile.service_states, auth.subscriber?.state);
    const minimumScore = Math.max(0, Math.min(100, Number(payload.minimum_score ?? 35) || 35));
    const resultLimit = Math.max(1, Math.min(200, Number(payload.limit ?? 100) || 100));
    const nowIso = new Date().toISOString();
    const [candidateSource, registry] = await Promise.all([
      fetchCandidateRows(url, key, states, nowIso),
      fetchRegistry(url, key, states),
    ]);
    const registryIndex = buildRegistryIndex(registry);
    const enriched = candidateSource.rows.map((row) => enrichOpportunity(row, registryIndex, candidateSource.relation));
    const scored = enriched.map((row) => ({ ...publicOpportunity(row), aoie: scoreStateLocalMatch(profile, row) }));
    const results = scored
      .filter((row) => row.aoie.fit_score >= minimumScore && row.aoie.match_status !== 'Not Recommended')
      .sort((a, b) => b.aoie.fit_score - a.aoie.fit_score || String(a.response_deadline || '').localeCompare(String(b.response_deadline || '')))
      .slice(0, resultLimit);
    const summary = scored.reduce((acc, row) => {
      acc[row.aoie.match_status] = (acc[row.aoie.match_status] || 0) + 1;
      if (row.aoie.hard_disqualifier) acc.disqualified = (acc.disqualified || 0) + 1;
      return acc;
    }, {});
    const registryEnriched = enriched.filter((row) => row.source_evidence?.registry_enriched).length;
    return json(200, {
      ok: true,
      mode: 'shadow',
      authentication_mode: auth.mode,
      engine_version: ENGINE_VERSION,
      ontology_version: ONTOLOGY_VERSION,
      scoring_version: SCORING_VERSION,
      source_contract_version: SOURCE_CONTRACT_VERSION,
      states,
      profile,
      candidate_count: enriched.length,
      result_count: results.length,
      minimum_score: minimumScore,
      summary,
      data_source: {
        relation: `public.${candidateSource.relation}`,
        mode: candidateSource.mode,
        canonical_view_attempted: true,
        canonical_view_available: candidateSource.canonical_view_available,
        direct_table_fallback_used: candidateSource.direct_table_fallback_used,
        deadline_filter_applied: true,
        latest_version_filter_applied: true,
        duplicate_filter_applied: true,
        normalized_status_filter_applied: true,
        retrieved_at: nowIso,
      },
      registry: {
        publishers_loaded: registry.publishers.length,
        publisher_platform_mappings_loaded: registry.publisherPlatforms.length,
        procurement_platforms_loaded: registry.platforms.length,
        opportunities_enriched: registryEnriched,
      },
      results,
    });
  } catch (error) {
    console.error('[aoie-state-shadow]', error);
    return json(500, { error: 'AOIE state/local shadow evaluation failed.', detail: error instanceof Error ? error.message : String(error) });
  }
}

export const config = { path: '/api/aoie-state-shadow' };
