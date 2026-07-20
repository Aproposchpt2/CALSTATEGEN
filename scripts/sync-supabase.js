'use strict';
/* CalGCC — sync bids.json / caleprocure.json / obas.json into the shared
   Supabase raw table `state_contract_opportunities` (project judislfknmhofcgzyozc).

   Scope: ingestion only (per directive). This script:
   - upserts every row each source currently makes available, keyed on
     (source_platform, source_record_id) — the DB-level unique constraint
     does the within-source dedup, no criteria/filtering applied here.
   - preserves each JSON file's own detail-caching (detail_fetched etc.) —
     this script only mirrors whatever the JSON already has, it doesn't
     decide what to fetch.
   - marks CA rows closed once their response_deadline has passed.

   Explicitly NOT this script's job (Postgres's scope per directive):
   cross-source dedup, criteria filtering, the live matching view. This only
   fills the raw table.

   The existing bids.json/caleprocure.json/obas.json commit-to-git flow is
   untouched — this runs as an additional step after it, and a failure here
   must never block that commit (see workflow `continue-on-error: true`). */

const fs = require('fs');
const path = require('path');

// No hardcoded fallback URL here on purpose -- Netlify's secret scanner
// flags any literal string in the repo matching a configured secret env
// var's value, and SUPABASE_URL is scanned as one on this site. A
// hardcoded default previously broke every calgovcc build. Require the
// env var; skip gracefully (see main()) if it's not set.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const TABLE = 'state_contract_opportunities';
const BATCH_SIZE = 200;

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
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function toIso(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// ---- per-source mappers → state_contract_opportunities row shape ----

function fromPlanetBids(bid) {
  const state = bid.state || 'CA';
  const deadline = toIso(bid.close_date);
  // Structured API record, no separate detail-fetch tier -- confidence tracks
  // whether the date parsed, since that's the one field prone to per-portal
  // format drift (see normalize()'s pick() fallback chain in scrape.js).
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
  const contactPhone = o.contact_phone || null;
  const deadline = toIso(o.close_date);
  // detail_fetched means the popup click-through succeeded (full description,
  // contact, UNSPSC codes) -- list-only rows are real but materially thinner.
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
    contact_phone: contactPhone,
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
  // Every obas.json row already passed a strict tab-delimited row regex
  // (ROW_RE in ingest-obas.js) to exist at all -- no partial-match rows are
  // ever written, so a present row is a fully-parsed row, high confidence.
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

async function upsertBatch(rows) {
  if (!rows.length) return { ok: 0, failed: 0 };
  let ok = 0, failed = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/' + TABLE + '?on_conflict=source_platform,source_record_id',
        {
          method: 'POST',
          headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(chunk),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.log('[sync-supabase] batch upsert FAILED (' + res.status + '): ' + body.slice(0, 400));
        failed += chunk.length;
      } else {
        ok += chunk.length;
      }
    } catch (e) {
      console.log('[sync-supabase] batch upsert error:', e.message);
      failed += chunk.length;
    }
  }
  return { ok, failed };
}

async function closeExpired(stateCode) {
  const nowIso = new Date().toISOString();
  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/' + TABLE +
        '?state_code=eq.' + encodeURIComponent(stateCode) +
        '&status=neq.closed&response_deadline=lt.' + encodeURIComponent(nowIso),
      {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ status: 'closed', closed_at: nowIso }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.log('[sync-supabase] close-expired FAILED (' + res.status + '): ' + body.slice(0, 400));
      return 0;
    }
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  } catch (e) {
    console.log('[sync-supabase] close-expired error:', e.message);
    return 0;
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('[sync-supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase sync (JSON files are unaffected).');
    return;
  }

  const rows = [];

  const pb = readJson('bids.json');
  if (pb && Array.isArray(pb.bids)) {
    pb.bids.forEach(b => rows.push(fromPlanetBids(b)));
    console.log('[sync-supabase] planetbids: ' + pb.bids.length + ' bids mapped');
  }

  const ce = readJson('caleprocure.json');
  if (ce && Array.isArray(ce.opportunities)) {
    ce.opportunities.forEach(o => rows.push(fromCalEprocure(o)));
    console.log('[sync-supabase] caleprocure: ' + ce.opportunities.length + ' opportunities mapped');
  }

  const obas = readJson('obas.json');
  if (obas && Array.isArray(obas.opportunities)) {
    obas.opportunities.forEach(o => rows.push(fromObas(o, obas.bulletin_url)));
    console.log('[sync-supabase] obas: ' + obas.opportunities.length + ' opportunities mapped');
  }

  if (!rows.length) {
    console.log('[sync-supabase] No source JSON found (bids.json / caleprocure.json / obas.json) — nothing to sync.');
    return;
  }

  const { ok, failed } = await upsertBatch(rows);
  console.log('[sync-supabase] upserted ' + ok + ' row(s), ' + failed + ' failed, into ' + TABLE + '.');

  const closed = await closeExpired('CA');
  console.log('[sync-supabase] marked ' + closed + ' CA row(s) closed (response_deadline passed).');
}

main().catch(e => {
  console.error('[sync-supabase] FAILED:', e.message);
  // Non-fatal by design: the JSON files (and cal-pipeline.js's live board)
  // must never be blocked by a Supabase sync problem.
  process.exit(0);
});
