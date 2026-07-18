'use strict';
/* CalGCC — OBAS "Upcoming Solicitations" bulletin ingest.
   DGS publishes a monthly PDF of contracts it anticipates releasing soon (not
   yet open for bid). No robots.txt restriction on dgs.ca.gov, static PDF, no
   JS rendering required (confirmed by direct fetch — see repo notes).

   The bulletin filename is dated (OBAS-Upcoming-Solicitations-MMYYYY.pdf) and
   there's no discovered stable/canonical URL that always points to the
   current one, so this tries the current month, then falls back to the
   previous month (bulletins are sometimes fetched a few days into a new
   month before that month's file is posted). If both fail, this needs a
   manual URL check — see the console output.

   Table layout is tab-delimited text: Category / Location / Title / UNSPSC /
   Anticipated Release Date / Contract Estimate. No per-row contact info in
   the bulletin itself — only a shared OBAS office contact in the footer,
   used for every row.

   Per directive: the UNSPSC code is stored as metadata only, NOT used as a
   matching key (extract-profile-ca.js's existing NAICS/UNSPSC-crosswalk-is-
   out-of-scope decision stands). Matching instead runs through the same
   concept-tag dictionary used for capability statements — see tagText() call
   below and js/concept-match.js. */

const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE_URL = 'https://www.dgs.ca.gov/-/media/Divisions/PD/Acquisitions/Statewide-Contracts/PD-and-OBAS-Upcoming-Solicitations/';
const CONTACT = '279-946-7874 | OBASAdvocate@dgs.ca.gov';

function bulletinUrl(date) {
  var mm = String(date.getMonth() + 1).padStart(2, '0');
  var yyyy = String(date.getFullYear());
  return BASE_URL + 'OBAS-Upcoming-Solicitations-' + mm + yyyy + '.pdf';
}

async function fetchPdf(url) {
  var res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  var ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function fetchCurrentBulletin() {
  var now = new Date();
  var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (var d of [now, prev]) {
    var url = bulletinUrl(d);
    console.log('[ingest-obas] trying', url);
    var buf = await fetchPdf(url);
    if (buf) { console.log('[ingest-obas] fetched', buf.length, 'bytes'); return { url: url, buf: buf }; }
    console.log('[ingest-obas]  not found');
  }
  return null;
}

function parseMoney(s) {
  var n = Number(String(s || '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(s) {
  var m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
}

function stableId(row) {
  var h = crypto.createHash('sha1')
    .update([row.category, row.location, row.title, row.unspsc_code].join('|'))
    .digest('hex').slice(0, 12);
  return 'obas-' + h;
}

// Rows are tab-delimited: Category \t Location \t Title \t UNSPSC \t Date \t $Estimate
var ROW_RE = /^(.+?)\s*\t\s*(.+?)\s*\t\s*(.+?)\s*\t\s*(\d{6,8})\s*\t\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\t\s*(\$[\d,]+)\s*$/;

function parseRows(text) {
  var rows = [];
  var skipped = [];
  text.split('\n').forEach(function (line) {
    line = line.trim();
    if (!line) return;
    var m = line.match(ROW_RE);
    if (!m) {
      // Header/footer/wrapped lines — expected to not match, not an error by itself.
      if (/^(Construction|IT -|Non-IT)/.test(line)) skipped.push(line); // looks like a data row that failed to parse — worth surfacing
      return;
    }
    rows.push({
      category: m[1].trim(),
      location: m[2].trim(),
      title: m[3].trim(),
      unspsc_code: m[4].trim(),
      anticipated_release_date: parseDate(m[5]),
      contract_estimate: parseMoney(m[6]),
    });
  });
  return { rows: rows, skipped: skipped };
}

async function main() {
  var fetched = await fetchCurrentBulletin();
  if (!fetched) {
    console.log('[ingest-obas] Could not fetch current or previous month bulletin. Check ' +
      'https://www.dgs.ca.gov/OBAS/Bid-Opportunities manually for the current filename pattern.');
    process.exit(1);
  }

  var parser = new PDFParse({ data: fetched.buf });
  var textResult = await parser.getText();
  await parser.destroy();

  var parsed = parseRows(textResult.text);
  if (parsed.skipped.length) {
    console.log('[ingest-obas] WARNING:', parsed.skipped.length, 'row(s) looked like data but failed to parse — check format drift:');
    parsed.skipped.forEach(function (l) { console.log('  ', l); });
  }

  // Concept-tag each description against the same dictionary used for capability
  // statements, flagging anything the dictionary doesn't recognize for review.
  var conceptMatchSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'concept-match.js'), 'utf8');
  var sandbox = { window: {} };
  require('vm').createContext(sandbox);
  require('vm').runInContext(conceptMatchSrc, sandbox);
  var ConceptMatch = sandbox.window.ConceptMatch;
  var dict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'concept-dictionary.json'), 'utf8'));

  var flagged = [];
  var opportunities = parsed.rows.map(function (row) {
    var tags = ConceptMatch.tagText(row.category + ' ' + row.title, dict);
    if (!tags.length) flagged.push({ title: row.title, category: row.category, unspsc_code: row.unspsc_code });
    return {
      id: stableId(row),
      category: row.category,
      location: row.location,
      title: row.title,
      unspsc_code: row.unspsc_code, // metadata only — not used as a matching key
      anticipated_release_date: row.anticipated_release_date,
      contract_estimate: row.contract_estimate,
      contact: CONTACT,
      status: 'upcoming', // not yet released for bid — distinct from open solicitations
      concept_tags: tags,
      _source: 'obas',
    };
  });

  var payload = {
    source: 'obas',
    bulletin_url: fetched.url,
    generatedAt: new Date().toISOString(),
    count: opportunities.length,
    flagged_count: flagged.length,
    opportunities: opportunities,
  };

  fs.writeFileSync(path.join(__dirname, '..', 'obas.json'), JSON.stringify(payload, null, 2));
  console.log('[ingest-obas] WROTE obas.json —', opportunities.length, 'opportunities,', flagged.length, 'flagged for dictionary review.');
  if (flagged.length) {
    console.log('[ingest-obas] Flagged (no concept-tag match):');
    flagged.forEach(function (f) { console.log('  -', f.title, '(' + f.category + ', UNSPSC ' + f.unspsc_code + ')'); });
  }
}

main().catch(function (e) { console.error('[ingest-obas] FAILED:', e.message); process.exit(1); });
