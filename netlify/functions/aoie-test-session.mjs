import { issueAoieTestSession, isSameSiteRequest } from './_shared/aoie-test-session.mjs';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers });
const env = (name) => globalThis.Netlify?.env?.get(name) || process.env[name] || '';
const values = (value) => Array.isArray(value) ? value : value == null ? [] : [value];

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!isSameSiteRequest(req)) return json(403, { error: 'Same-site request required.' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON.' }); }
  const localToken = String(body.local_token || '');
  const profile = body.profile || {};
  const evidence = [profile.keywords, profile.services, profile.core_competencies, profile.naics_codes, profile.unspsc_codes, profile.commodity_codes]
    .some((item) => values(item).filter(Boolean).length > 0);

  if (!localToken.startsWith('local-') || localToken.length < 16) return json(401, { error: 'Valid local test session required.' });
  if (!profile.business_name || !evidence) return json(400, { error: 'Business name and capability evidence are required.' });

  const secret = env('AOIE_SESSION_SECRET');
  if (!secret) return json(500, { error: 'AOIE test-session configuration missing.' });
  const audience = new URL(req.url).host;
  const session = issueAoieTestSession(secret, audience, 7200);
  return json(200, { ok: true, token: session.token, expires_at: session.expires_at, mode: 'live-test-session' });
}

export const config = { path: '/api/aoie-test-session' };
