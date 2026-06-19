'use strict';
/* CalStateGen — headless PlanetBids ingest.
   A stealth browser boots each agency's PUBLIC PlanetBids portal; the Ember app runs its own
   anonymous bootstrap and fetches the public bid list from papi. We intercept that
   `/papi/bids?...cid={portal}` JSON response (200, no login) and normalize it → bids.json.
   Logs the raw shape on first capture so field mapping is verifiable. */

const { chromium } = require('playwright');
const fs = require('fs');

// California agency PlanetBids portals (portalId = cid). Verified portal IDs across the state.
// The GitHub Action logs "[id] agency: bids array = N" per portal — prune any that read 0 over time.
const PORTALS = [
  { id: 17950, agency: 'City of San Diego' },                              // proven
  { id: 15300, agency: 'City of Sacramento' },
  { id: 14769, agency: 'City of Fresno' },
  { id: 19236, agency: 'Port of Long Beach' },
  { id: 39495, agency: 'City of San Bernardino' },
  { id: 24103, agency: 'City of National City' },
  { id: 26037, agency: 'CSU Fresno' },
  { id: 16151, agency: 'Metropolitan Water District of Southern California' },
  { id: 27411, agency: 'Inland Empire Utilities Agency' },
];
const PORTAL_URL = id => `https://vendors.planetbids.com/portal/${id}/bo/bo-search`;

function daysUntil(v) {
  if (!v) return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

const BID_TYPES = {}; // bidTypeId -> name (e.g. "Bid", "RFP"), filled from /papi/bid-types

function normalize(item, portal) {
  const a = (item && item.attributes) ? { ...item.attributes, id: item.id } : (item || {});
  const pick = (...keys) => { for (const k of keys) if (a[k] != null && a[k] !== '') return a[k]; return null; };
  const close = pick('bidDueDate', 'bidCloseDateTime', 'bidCloseDate', 'closeDate', 'dueDate', 'endDate');
  const title = pick('title', 'bidName', 'projectTitle', 'name', 'description');
  if (!title) return null;
  const typeName = (a.bidTypeId != null && BID_TYPES[a.bidTypeId]) ? BID_TYPES[a.bidTypeId]
    : pick('bidTypeStr', 'bidType', 'stageStr') || '—';
  return {
    id: String(a.bidId || a.id || Math.random().toString(36).slice(2)),
    title: String(title),
    solicitation_no: pick('invitationNum', 'bidNumber', 'referenceNumber', 'number') || '',
    agency: pick('agencyName', 'organization') || portal.agency,
    bid_type: typeName,
    close_date: close ? String(close) : '',
    due_in_days: daysUntil(close),
    url: PORTAL_URL(portal.id),
  };
}

let loggedShape = false;

async function scrapePortal(browser, portal) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = window.chrome || { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });
  const page = await ctx.newPage();

  let bidsBody = null;
  page.on('response', async (r) => {
    const u = r.url();
    if (/\/papi\/bid-types/i.test(u)) {
      try {
        const b = await r.json();
        const arr = Array.isArray(b.data) ? b.data : Array.isArray(b.bidTypes) ? b.bidTypes : Array.isArray(b) ? b : [];
        arr.forEach(it => {
          const at = it.attributes || it;
          const id = it.id != null ? it.id : (at.bidTypeId != null ? at.bidTypeId : at.id);
          const nm = at.name || at.bidType || at.title || at.bidTypeName;
          if (id != null && nm) BID_TYPES[id] = nm;
        });
      } catch (e) {}
      return;
    }
    if (!/\/papi\/bids\?/i.test(u)) return;
    try { bidsBody = await r.json(); } catch (e) {}
  });

  try {
    await page.goto(PORTAL_URL(portal.id), { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
  } catch (e) { console.log(`[${portal.id}] nav: ${e.message}`); }
  await ctx.close();

  const data = bidsBody && (Array.isArray(bidsBody.data) ? bidsBody.data
    : Array.isArray(bidsBody.bids) ? bidsBody.bids
    : Array.isArray(bidsBody) ? bidsBody : []);
  console.log(`[${portal.id}] ${portal.agency}: bids array = ${data.length}`);
  if (data[0] && !loggedShape) {
    loggedShape = true;
    const it = data[0];
    console.log(`[shape] keys: ${JSON.stringify(Object.keys(it.attributes || it))}`);
    console.log(`[shape] sample: ${JSON.stringify(it).slice(0, 700)}`);
  }
  return data.map(it => normalize(it, portal)).filter(Boolean);
}

(async () => {
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
  let all = [];
  for (const portal of PORTALS) {
    try { all = all.concat(await scrapePortal(browser, portal)); }
    catch (e) { console.log(`[${portal.id}] failed: ${e.message}`); }
  }
  await browser.close();

  all = all.filter(b => b.due_in_days === null || b.due_in_days >= 0)
           .sort((a, b) => (a.due_in_days ?? 9999) - (b.due_in_days ?? 9999));

  const payload = { source: 'planetbids', state: 'CA', scanMode: all.length ? 'live' : 'sample',
    generatedAt: new Date().toISOString(), count: all.length, bids: all };

  if (all.length) {
    fs.writeFileSync('bids.json', JSON.stringify(payload, null, 2));
    console.log(`WROTE bids.json — ${all.length} live CA bids across ${PORTALS.length} portals.`);
  } else {
    console.log('No bids captured — bids.json left untouched (check shape log).');
  }
})();
