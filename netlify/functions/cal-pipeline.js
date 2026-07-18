'use strict';
// CalGCC — California Government Contracts Center
// Blends two independent sources into one feed:
//   1. Live scrape of Cal eProcure public solicitation listing (caleprocure.ca.gov),
//      falling back to the DGS active solicitations page if needed.
//   2. bids.json — the pre-scraped PlanetBids feed for CA city/county/district agency
//      portals, written daily by scripts/scrape.js (see .github/workflows/scrape.yml).
// Each source is independently resilient (a failure in one does not affect the other);
// results are deduped and merged before being cached and returned.

const LIST_URL  = 'https://caleprocure.ca.gov/events/';
const ALT_URL   = 'https://www.dgs.ca.gov/PD/Resources/Page-Content/Procurement-Division-Resources-List-Folder/Active-Solicitations';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Simple in-process cache — avoids hammering cal eProcure
let _cache = null, _cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const diff = Date.parse(isoDate) - Date.now();
  return Math.ceil(diff / 86400000);
}

// ── Cal eProcure parser ───────────────────────────────────────────────────────
// Cal eProcure uses SAP Ariba. The public events page may render a table or
// redirect to an Ariba SourcingPublic page. We attempt to extract bid rows.
function parseCalEprocure(html) {
  const bids = [];
  // Try standard table rows with bid data
  const rowMatches = [...html.matchAll(/<tr[^>]*class="[^"]*(?:row|event)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rm of rowMatches) {
    const cells = [...rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1].replace(/<[^>]+>/g, ' ')));
    if (cells.length < 2 || !cells[0]) continue;
    const title = cells[0] || cells[1] || '';
    if (title.length < 5) continue;
    // Try to extract a bid/event ID
    const idMatch = rm[1].match(/(?:eventId|bidId|Id)=([A-Z0-9\-_]{4,40})/i) || rm[1].match(/value="([A-Z0-9\-_]{6,40})"/i);
    const bid_id = idMatch ? idMatch[1] : ('CA-' + bids.length);
    bids.push({
      id: bid_id,
      bid_id,
      solicitation_no: cells[1] || bid_id,
      title: clean(title),
      bid_type: 'SOLICITATION',
      agency: cells[2] || 'California State Agency',
      issue_date: parseDate(cells[3] || ''),
      close_date: parseDate(cells[4] || cells[3] || ''),
    });
  }

  // Fallback: look for any structured bid-like content blocks
  if (!bids.length) {
    const titleMatches = [...html.matchAll(/data-title="([^"]{10,200})"/gi)];
    for (const tm of titleMatches) {
      bids.push({
        id: 'CA-' + bids.length,
        bid_id: 'CA-' + bids.length,
        solicitation_no: '',
        title: clean(tm[1]),
        bid_type: 'SOLICITATION',
        agency: 'California State Agency',
        issue_date: null,
        close_date: null,
      });
    }
  }

  return bids;
}

// ── DGS Active Solicitations parser ──────────────────────────────────────────
function parseDgsSolicitations(html) {
  const bids = [];
  // DGS page is SharePoint-based with a simple list of solicitations
  const linkMatches = [...html.matchAll(/<a[^>]*href="([^"]*(?:solicitation|bid|rfp|rfq|itb|contract)[^"]*)"[^>]*>([^<]{8,200})<\/a>/gi)];
  for (const lm of linkMatches) {
    const title = clean(lm[2]);
    if (!title || title.length < 8) continue;
    bids.push({
      id: 'DGS-' + bids.length,
      bid_id: 'DGS-' + bids.length,
      solicitation_no: '',
      title,
      bid_type: 'SOLICITATION',
      agency: 'California Dept of General Services',
      issue_date: null,
      close_date: null,
      url: lm[1],
    });
  }
  return bids;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

// ── PlanetBids (pre-scraped) ─────────────────────────────────────────────────
// bids.json is written daily by scripts/scrape.js — a scheduled, rate-limit-aware
// Playwright scraper (PlanetBids' API sits behind a WAF-style limiter, so it is
// never queried live from this function). If the file is missing or unreachable
// (e.g. before the first scheduled run on a fresh deploy), this degrades to an
// empty array rather than failing the whole response.
async function fetchPlanetBidsBids(siteUrl) {
  try {
    const res = await fetch(`${siteUrl}/bids.json`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const arr = Array.isArray(data.bids) ? data.bids : [];
    return arr.map(b => ({
      id:              b.id || '',
      bid_id:          b.id || '',
      solicitation_no: b.solicitation_no || '',
      title:           b.title || '',
      bid_type:        b.bid_type || 'SOLICITATION',
      agency:          b.agency || 'California Local Agency',
      issue_date:      null,
      close_date:      b.close_date || null,
      due_in_days:     b.due_in_days != null ? b.due_in_days : daysUntil(b.close_date),
      status:          'Open',
      url:             b.url || '',
      category_ids:    Array.isArray(b.category_ids) ? b.category_ids : [],
      _source:         'planetbids',
    })).filter(b => b.title.length > 3);
  } catch (e) {
    console.log('[cal-pipeline] PlanetBids bids.json fetch failed (non-fatal):', e.message);
    return [];
  }
}

// OBAS "Upcoming Solicitations" bulletin — DGS contracts anticipated to be
// released soon but not yet open for bid. Pre-parsed monthly by
// scripts/ingest-obas.js into obas.json (same file-based pattern as
// bids.json). status is 'Upcoming', not 'Open' — these aren't biddable yet.
// unspsc_code is metadata only, never used for matching (per directive,
// extract-profile-ca.js's NAICS/UNSPSC-crosswalk-out-of-scope decision
// stands) — matching runs through the same concept-tag text classifier as
// every other source, via title/agency text.
async function fetchObasBids(siteUrl) {
  try {
    const res = await fetch(`${siteUrl}/obas.json`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const arr = Array.isArray(data.opportunities) ? data.opportunities : [];
    return arr.map(o => ({
      id:              o.id || '',
      bid_id:          o.id || '',
      solicitation_no: '',
      title:           o.title || '',
      bid_type:        o.category || 'SOLICITATION',
      agency:          'DGS (OBAS bulletin)' + (o.location ? ' — ' + o.location : ''),
      issue_date:      null,
      close_date:      null,
      due_in_days:     null,
      status:          'Upcoming',
      url:             data.bulletin_url || '',
      category_ids:    [],
      unspsc_code:         o.unspsc_code || null,
      anticipated_release_date: o.anticipated_release_date || null,
      contract_estimate:   o.contract_estimate != null ? o.contract_estimate : null,
      contact:             o.contact || null,
      _source:         'obas',
    })).filter(b => b.title.length > 3);
  } catch (e) {
    console.log('[cal-pipeline] OBAS obas.json fetch failed (non-fatal):', e.message);
    return [];
  }
}

// Dedupe on solicitation_no when present (most reliable key), else title+agency.
// Cal eProcure covers state agencies and PlanetBids' configured portals are all
// cities/counties/districts, so overlap should be rare — this is cheap insurance.
function dedupe(bids) {
  const seen = new Set();
  const out = [];
  for (const b of bids) {
    const key = (b.solicitation_no && b.solicitation_no.trim())
      ? `sol:${b.solicitation_no.trim().toLowerCase()}`
      : `ta:${(b.title || '').trim().toLowerCase()}|${(b.agency || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

async function fetchCalBids() {
  // Primary: Cal eProcure
  try {
    const html = await fetchPage(LIST_URL);
    const bids = parseCalEprocure(html);
    if (bids.length > 0) return bids;
  } catch (e) {
    console.log('[cal-pipeline] Cal eProcure failed:', e.message);
  }

  // Fallback: DGS Active Solicitations
  try {
    const html = await fetchPage(ALT_URL);
    const bids = parseDgsSolicitations(html);
    if (bids.length > 0) return bids;
  } catch (e) {
    console.log('[cal-pipeline] DGS fallback failed:', e.message);
  }

  return [];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  // Serve from cache if fresh
  if (_cache && Date.now() - _cacheAt < TTL_MS) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, bids: _cache, cached: true, count: _cache.length }) };
  }

  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || `https://${event.headers.host}`;

    // Run all sources concurrently; each is independently resilient (all three
    // catch their own errors and resolve to [] rather than throwing), so one
    // source failing never blocks the others.
    const [raw, planetBidsBids, obasBids] = await Promise.all([
      fetchCalBids(),
      fetchPlanetBidsBids(siteUrl),
      fetchObasBids(siteUrl),
    ]);

    // Normalize each Cal eProcure/DGS bid
    const calBids = raw.map(b => ({
      id:             b.id || b.bid_id || '',
      bid_id:         b.bid_id || b.id || '',
      solicitation_no: b.solicitation_no || '',
      title:          b.title || '',
      bid_type:       (b.bid_type || 'SOLICITATION').toUpperCase(),
      agency:         b.agency || 'California State Agency',
      issue_date:     b.issue_date || null,
      close_date:     b.close_date || null,
      due_in_days:    daysUntil(b.close_date),
      status:         'Issued',
      url:            b.url || `https://caleprocure.ca.gov/events/`,
      category_ids:   [],
      _source:        'caleprocure',
    })).filter(b => b.title.length > 3);

    const bids = dedupe([...calBids, ...planetBidsBids, ...obasBids])
      .sort((a, b) => (a.due_in_days ?? 9999) - (b.due_in_days ?? 9999));

    _cache = bids;
    _cacheAt = Date.now();

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true, bids, count: bids.length,
        source: { caleprocure: calBids.length, planetbids: planetBidsBids.length, obas: obasBids.length },
      }),
    };
  } catch (e) {
    const fallback = _cache || [];
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, bids: fallback, count: fallback.length, error: e.message }) };
  }
};
