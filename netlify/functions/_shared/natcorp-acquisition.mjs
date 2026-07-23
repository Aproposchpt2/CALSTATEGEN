import { groupRowsByKeySet } from './natcorp-core.mjs';
import { asArray, db, nowIso, sha256, text } from './natcorp-db.mjs';

function iso(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? new Date(n).toISOString() : null; }
function normalizeStatus(status, deadline) {
  const s = text(status).toLowerCase();
  if (deadline && Date.parse(deadline) < Date.now()) return 'closed';
  if (/cancel|withdraw/.test(s)) return 'cancelled';
  if (/award/.test(s)) return 'awarded';
  if (/clos|expire/.test(s)) return 'closed';
  if (/upcoming|forecast|planned/.test(s)) return 'upcoming';
  return 'open';
}

async function fromPlanetBids(bid, ingestionRunId) {
  const state = bid.state || 'CA';
  const deadline = iso(bid.close_date);
  const fingerprint = await sha256({ title: bid.title, deadline, agency: bid.agency, url: bid.url, categories: bid.category_ids || [] });
  return {
    state_code: state, jurisdiction_type: 'local', jurisdiction_name: bid.agency || null,
    issuing_organization: bid.agency || 'Unknown agency', source_platform: 'planetbids',
    source_record_id: String(bid.id), source_url: bid.url, official_source_url: bid.url,
    solicitation_number: bid.solicitation_no || null, title: bid.title || 'Untitled opportunity',
    notice_type: bid.bid_type || null, status: normalizeStatus('open', deadline), response_deadline: deadline,
    place_of_performance_state: state, classifications: { category_ids: bid.category_ids || [] },
    extraction_confidence: deadline ? 0.85 : 0.6, data_quality_score: deadline ? 85 : 60,
    qa_status: bid.title && deadline ? 'auto_ingested' : 'incomplete',
    qa_notes: deadline ? null : 'response_deadline did not parse from source close_date value',
    acquisition_method: 'official_public_web_application', last_seen_at: nowIso(), last_verified_at: nowIso(),
    content_fingerprint: fingerprint, ingestion_run_id: ingestionRunId, raw_source_payload: bid,
  };
}

function inferType(...parts) {
  const value = parts.filter(Boolean).join(' ').toLowerCase();
  if (/construction|public works|contractor license/.test(value)) return 'construction';
  if (/information technology|software|hardware|network|computer/.test(value)) return 'information_technology';
  if (/goods|supplies|equipment|materials/.test(value)) return 'goods';
  if (/request for information|\brfi\b/.test(value)) return 'market_research';
  return 'services';
}

async function fromCalEprocure(o, ingestionRunId) {
  const business = text(o.business_unit), event = text(o.id);
  if (!business || !event) return null;
  const sourceId = `${business}:${event}`;
  const deadline = iso(o.close_date), documents = asArray(o.document_urls), now = nowIso();
  const sourceUrl = o.url || o.official_url || `https://caleprocure.ca.gov/event/${encodeURIComponent(business)}/${encodeURIComponent(event)}`;
  const fingerprint = o.content_fingerprint || await sha256({ title: o.title, department: o.department, deadline, description: o.description, documents, version: o.event_version });
  let quality = 45 + (business ? 15 : 0) + (deadline ? 10 : 0) + (o.description ? 10 : 0) + ((o.contact_email || o.contact_phone) ? 5 : 0) + (asArray(o.unspsc_codes).length ? 5 : 0) + (documents.length ? 10 : 0);
  quality = Math.min(100, quality);
  return {
    state_code: 'CA', jurisdiction_type: 'state', jurisdiction_name: 'California',
    issuing_organization: o.department || 'California state agency', issuing_department: o.department || null,
    source_platform: 'caleprocure', source_record_id: sourceId, source_url: sourceUrl,
    official_source_url: o.official_url || sourceUrl, vendor_registration_url: 'https://www.caleprocure.ca.gov/pages/bidder-vendor.aspx',
    solicitation_number: o.solicitation_number || null, title: o.title || 'Untitled opportunity', description: o.description || null,
    procurement_type: inferType(o.bid_type, o.title, o.description), notice_type: o.bid_type || null,
    status: normalizeStatus(o.status, deadline), posted_at: iso(o.published_date), response_deadline: deadline,
    prebid_datetime: iso(o.prebid_datetime), question_deadline: iso(o.question_deadline),
    place_of_performance_county: asArray(o.service_areas)[0] || null, place_of_performance_state: 'CA',
    contact_name: o.contact_name || null, contact_email: o.contact_email || null, contact_phone: o.contact_phone || null,
    unspsc_codes: asArray(o.unspsc_codes).map((x) => typeof x === 'string' ? x : x?.code).filter(Boolean),
    set_asides: asArray(o.set_asides), certifications_required: asArray(o.certifications_required), keywords: asArray(o.concept_tags),
    document_urls: documents, classifications: { business_unit: business, event_id: event, event_round: Number(o.event_round || 1), event_version: Number(o.event_version || 1), service_areas: asArray(o.service_areas) },
    requirements: { mandatory_prebid: Boolean(o.mandatory_prebid), prebid_location: o.prebid_location || null, contractor_license: o.contractor_license || null, response_method: 'See official event package' },
    source_fingerprint: await sha256({ source_platform: 'caleprocure', source_record_id: sourceId }), content_fingerprint: fingerprint,
    amendment_number: o.amendment_number || null, amendment_count: Number(o.amendment_count ?? Math.max(0, Number(o.event_version || 1) - 1)),
    is_latest_version: true, first_seen_at: iso(o.first_seen_at) || now, last_seen_at: iso(o.last_seen_at) || now,
    last_verified_at: o.detail_fetched ? (iso(o.last_detail_fetched_at) || now) : null, last_changed_at: iso(o.last_changed_at) || now,
    closed_at: normalizeStatus(o.status, deadline) === 'closed' ? deadline : null,
    acquisition_method: 'official_public_search_and_event_detail', extraction_confidence: o.detail_fetched ? (o.package_fetched ? 1 : 0.9) : 0.65,
    data_quality_score: quality, qa_status: quality >= 85 ? 'auto_ingested' : quality >= 65 ? 'review_required' : 'incomplete',
    qa_notes: [!deadline && 'response_deadline did not parse', !o.detail_fetched && 'list-only record', !o.package_fetched && 'event package not verified'].filter(Boolean).join('; ') || null,
    ingestion_run_id: ingestionRunId, raw_source_payload: o,
  };
}

async function fromObas(o, bulletinUrl, ingestionRunId) {
  const contact = /([\d.\-() ]{7,20})\s*\|\s*([\w.+-]+@[\w-]+\.[\w.-]+)/.exec(o.contact || '');
  return {
    state_code: 'CA', jurisdiction_type: 'state', jurisdiction_name: 'California',
    issuing_organization: 'California Department of General Services (OBAS)', issuing_department: o.category || null,
    source_platform: 'obas', source_record_id: String(o.id), source_url: bulletinUrl, official_source_url: bulletinUrl,
    title: o.title || 'Upcoming solicitation', notice_type: 'Upcoming Solicitation (not yet open)', status: 'upcoming',
    place_of_performance_state: 'CA', place_of_performance_county: o.location || null,
    estimated_value_min: o.contract_estimate ?? null, estimated_value_max: o.contract_estimate ?? null,
    contact_phone: contact?.[1]?.trim() || null, contact_email: contact?.[2]?.trim() || null,
    unspsc_codes: o.unspsc_code ? [o.unspsc_code] : [], keywords: asArray(o.concept_tags),
    classifications: { anticipated_release_date: o.anticipated_release_date || null }, acquisition_method: 'official_public_document_repository',
    extraction_confidence: 0.95, data_quality_score: 95, qa_status: 'auto_ingested', last_seen_at: nowIso(), last_verified_at: nowIso(),
    content_fingerprint: await sha256(o), ingestion_run_id: ingestionRunId, raw_source_payload: o,
  };
}

const allowedKeys = new Set(['state_code','jurisdiction_type','jurisdiction_name','issuing_organization','issuing_department','source_platform','source_record_id','source_url','official_source_url','vendor_registration_url','solicitation_number','title','description','procurement_type','notice_type','status','posted_at','response_deadline','prebid_datetime','question_deadline','award_date','place_of_performance_city','place_of_performance_county','place_of_performance_state','place_of_performance_zip','estimated_value_min','estimated_value_max','currency','contact_name','contact_email','contact_phone','naics_codes','nigp_codes','unspsc_codes','commodity_codes','set_asides','certifications_required','keywords','document_urls','classifications','requirements','raw_source_payload','source_fingerprint','content_fingerprint','duplicate_of','amendment_number','amendment_count','is_latest_version','first_seen_at','last_seen_at','last_verified_at','last_changed_at','closed_at','acquisition_method','ingestion_run_id','extraction_confidence','data_quality_score','qa_status','qa_notes']);
function cleanRow(row) { const out = {}; for (const [k, v] of Object.entries(row || {})) if (allowedKeys.has(k) && v !== undefined && (v !== null || ['qa_notes','closed_at'].includes(k))) out[k] = v; return out; }

async function sourceRows(job, baseUrl, ingestionRunId) {
  const file = job.configuration?.source_file;
  if (!file) return { rows: [], discovered: 0, skipped: 0, note: 'No approved deploy-time source snapshot is configured.' };
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${file}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(55000) });
  if (!response.ok) throw new Error(`${file} unavailable: HTTP ${response.status}`);
  const data = await response.json();
  let list = [], mapped = [];
  if (job.job_id === 'CA-PLANETBIDS') { list = asArray(data.bids); mapped = await Promise.all(list.map((x) => fromPlanetBids(x, ingestionRunId))); }
  else if (job.job_id === 'CA-CALEPROCURE') { list = asArray(data.opportunities); mapped = await Promise.all(list.map((x) => fromCalEprocure(x, ingestionRunId))); }
  else if (job.job_id === 'CA-OBAS') { list = asArray(data.opportunities); mapped = await Promise.all(list.map((x) => fromObas(x, data.bulletin_url || null, ingestionRunId))); }
  else return { rows: [], discovered: 0, skipped: 0, note: 'Snapshot source is not mapped by the NAT-CORP acquisition agent.' };
  const rows = mapped.filter(Boolean).map(cleanRow);
  return { rows, discovered: list.length, skipped: list.length - rows.length };
}

async function processConnector(job, runId, baseUrl) {
  const started = nowIso(), ingestionRunId = `NATCORP:${runId}:${job.job_id}`;
  let discovered = 0, inserted = 0, updated = 0, failed = 0, changedIds = [], error = null, status = 'succeeded';
  try {
    const source = await sourceRows(job, baseUrl, ingestionRunId); discovered = source.discovered;
    const platform = job.job_id === 'CA-PLANETBIDS' ? 'planetbids' : job.job_id === 'CA-OBAS' ? 'obas' : 'caleprocure';
    const existing = await db('state_contract_opportunities', 'GET', `?source_platform=eq.${platform}&select=id,source_record_id,content_fingerprint,document_urls,qa_status,qa_notes,raw_source_payload,amendment_count,acquisition_method&limit=10000`);
    const byId = new Map((existing || []).map((r) => [String(r.source_record_id), r]));
    for (const row of source.rows) {
      const old = byId.get(String(row.source_record_id));
      if (old) {
        if (old.qa_status === 'verified' && row.qa_status !== 'verified') row.qa_status = 'verified';
        if ((!row.document_urls || !row.document_urls.length) && asArray(old.document_urls).length) delete row.document_urls;
        if (old.raw_source_payload && row.raw_source_payload) row.raw_source_payload = { ...old.raw_source_payload, ...row.raw_source_payload };
        updated += 1;
        if (!old.content_fingerprint || old.content_fingerprint !== row.content_fingerprint) changedIds.push(old.id);
      } else inserted += 1;
    }
    for (const group of groupRowsByKeySet(source.rows)) {
      for (let i = 0; i < group.length; i += 100) {
        const returned = await db('state_contract_opportunities', 'POST', '?on_conflict=source_platform,source_record_id', group.slice(i, i + 100), 'resolution=merge-duplicates,return=representation');
        for (const row of returned || []) if (!byId.has(String(row.source_record_id))) changedIds.push(row.id);
      }
    }
    failed = source.skipped;
    if (failed) { status = inserted + updated ? 'partial' : 'failed'; error = `${failed} source records could not be normalized.`; }
  } catch (e) { status = 'failed'; failed = Math.max(1, discovered); inserted = 0; updated = 0; error = e instanceof Error ? e.message : String(e); }
  const completed = nowIso(), runtime = Math.max(0, Date.parse(completed) - Date.parse(started));
  await db('pdas_acquisition_runs', 'POST', '', [{ job_id: job.job_id, ingestion_run_id: ingestionRunId, trigger_type: 'natcorp_command', run_status: status, started_at: started, completed_at: completed, runtime_ms: runtime, records_discovered: discovered, records_inserted: inserted, records_updated: updated, records_failed: failed, error_message: error, metadata: { natcorp_run_id: runId, source_snapshot: job.configuration?.source_file || null } }], 'return=minimal');
  await db('pdas_acquisition_jobs', 'PATCH', `?job_id=eq.${encodeURIComponent(job.job_id)}`, { job_status: status === 'succeeded' ? 'healthy' : status === 'partial' ? 'degraded' : 'failed', last_started_at: started, last_completed_at: completed, last_success_at: status === 'succeeded' ? completed : job.last_success_at, last_failure_at: status !== 'succeeded' ? completed : job.last_failure_at, last_records_discovered: discovered, last_records_inserted: inserted, last_records_updated: updated, last_records_failed: failed, last_runtime_ms: runtime, consecutive_failures: status === 'succeeded' ? 0 : Number(job.consecutive_failures || 0) + 1, last_error: error, updated_at: completed }, 'return=minimal');
  return { job_id: job.job_id, status, discovered, inserted, updated, failed, changed_ids: [...new Set(changedIds)], error };
}

export async function acquisitionAgent({ runId, input }) {
  const baseUrl = input.base_url;
  if (!baseUrl) throw new Error('The production origin is required for acquisition snapshots.');
  const jobs = await db('pdas_acquisition_jobs', 'GET', '?enabled=eq.true&select=*&order=job_id.asc&limit=500');
  const executable = (jobs || []).filter((j) => ['bids.json','caleprocure.json','obas.json'].includes(j.configuration?.source_file));
  const connectors = [];
  for (const job of executable) connectors.push(await processConnector(job, runId, baseUrl));
  const changed = [...new Set(connectors.flatMap((c) => c.changed_ids || []))];
  return {
    publishers_scanned: new Set(executable.map((j) => j.publisher_id).filter(Boolean)).size,
    connectors_executed: connectors.length,
    inserted: connectors.reduce((n, c) => n + c.inserted, 0),
    updated: connectors.reduce((n, c) => n + c.updated, 0),
    failed_records: connectors.reduce((n, c) => n + c.failed, 0),
    changed_opportunity_ids: changed,
    connectors,
  };
}
