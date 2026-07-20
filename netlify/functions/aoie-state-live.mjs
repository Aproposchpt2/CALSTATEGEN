import { isSameSiteRequest, verifyAoieTestSession } from './_shared/aoie-test-session.mjs';

const env = (name) => globalThis.Netlify?.env?.get(name) || process.env[name] || '';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!isSameSiteRequest(req)) return json(403, { error: 'Same-site request required.' });

  const authorization = req.headers.get('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  const target = new URL('/api/aoie-state-shadow', req.url);
  const headers = { 'Content-Type': 'application/json' };

  if (bearer.startsWith('aoie_test.')) {
    const payload = verifyAoieTestSession(bearer, env('AOIE_SESSION_SECRET'), new URL(req.url).host);
    if (!payload) return json(401, { error: 'AOIE live-test session is invalid or expired.' });
    const internal = env('AOIE_INTERNAL_TOKEN');
    if (!internal) return json(500, { error: 'AOIE internal authorization is not configured.' });
    headers['x-aoie-token'] = internal;
  } else {
    if (!bearer) return json(401, { error: 'Authorization required.' });
    headers.Authorization = authorization;
  }

  const response = await fetch(target, { method: 'POST', headers, body: await req.text(), signal: AbortSignal.timeout(30000) });
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const config = { path: '/api/aoie-state-live' };
