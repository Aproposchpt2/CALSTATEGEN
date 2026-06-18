'use strict';
/* CalStateGen — PlanetBids ingest (DIAGNOSTIC v2: why won't the SPA boot headless?).
   Adds a stealth browser context + captures console errors / page errors so we can see
   whether it's bot-detection or a boot crash. */

const { chromium } = require('playwright');

const PORTALS = [{ id: 17950, agency: 'City of San Diego' }];
const PORTAL_URL = id => `https://vendors.planetbids.com/portal/${id}/bo/bo-search`;

async function scrapePortal(browser, portal) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = window.chrome || { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });
  const page = await ctx.newPage();

  const pageErrors = [], consoleErrors = [], apiUrls = [];
  page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('response', r => { const u = r.url(); if (/api-external\.prod\.planetbids/i.test(u)) apiUrls.push(`${r.status()} ${u.slice(0, 120)}`); });

  try {
    await page.goto(PORTAL_URL(portal.id), { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(12000);
  } catch (e) { console.log(`[${portal.id}] nav: ${e.message}`); }

  let title = '', bodyLen = 0, htmlSnippet = '';
  try {
    title = await page.title();
    bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.length : 0));
    htmlSnippet = await page.evaluate(() => (document.querySelector('#main, .ember-application, [class*="portal"]') || document.body || {}).innerHTML?.slice(0, 200) || '');
  } catch (e) {}
  await ctx.close();

  console.log(`[${portal.id}] title="${title}" bodyTextLen=${bodyLen}`);
  console.log(`[${portal.id}] api-external calls: ${apiUrls.length}`); apiUrls.slice(0, 10).forEach(u => console.log('   ' + u));
  console.log(`[${portal.id}] pageErrors(${pageErrors.length}):`); pageErrors.slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log(`[${portal.id}] consoleErrors(${consoleErrors.length}):`); consoleErrors.slice(0, 6).forEach(e => console.log('   c ' + e));
  console.log(`[${portal.id}] mount HTML snippet: ${htmlSnippet.replace(/\s+/g, ' ').slice(0, 180)}`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
  for (const portal of PORTALS) {
    try { await scrapePortal(browser, portal); } catch (e) { console.log(`[${portal.id}] failed: ${e.message}`); }
  }
  await browser.close();
  console.log('DIAGNOSTIC v2 complete.');
})();
