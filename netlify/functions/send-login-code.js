import crypto from 'node:crypto';

function json(status, body) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request) {
  const target = new URL(request.url);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin && origin !== target.origin) return false;
  if (referer) {
    try { if (new URL(referer).origin !== target.origin) return false; } catch { return false; }
  }
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  return origin === target.origin || Boolean(referer) || fetchSite === 'same-origin';
}

function dbHeaders(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

function challengeFor(email, issuedAt, secret) {
  const payload = `${email}|${issuedAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${signature}`).toString('base64url');
}

function codeHash(email, code, secret) {
  return crypto.createHmac('sha256', secret).update(`${email}|${code}`).digest('hex');
}

async function fetchRows(url, key, relation, query) {
  const response = await fetch(`${url}/rest/v1/${relation}?${query}`, { headers: dbHeaders(key) });
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  if (!isSameOrigin(request)) return json(403, { error: 'Same-origin NAT-CORP access is required.' });

  const supabaseUrl = (Netlify.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const serviceKey = Netlify.env.get('SUPABASE_SERVICE_KEY') || Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Netlify.env.get('RESEND_API_KEY') || '';
  const from = Netlify.env.get('RESEND_FROM_EMAIL') || 'National Corporate Contract Exchange <no-reply@aproposgroupllc.com>';
  const secret = Netlify.env.get('BC_VERIFY_SECRET') || '';
  if (!supabaseUrl || !serviceKey || !secret) return json(500, { error: 'Member access is not configured.' });

  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'Invalid JSON.' }); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'A valid email is required.' });

  const issuedAt = Date.now();
  const challenge = challengeFor(email, issuedAt, secret);
  const recentCutoff = new Date(issuedAt - 15 * 60 * 1000).toISOString();
  const recentQuery = new URLSearchParams({ select: 'id', email: `eq.${email}`, created_at: `gt.${recentCutoff}`, limit: '4' });
  const recent = await fetchRows(supabaseUrl, serviceKey, 'state_login_codes', recentQuery);
  if (recent.length >= 3) return json(429, { error: 'Too many code requests. Try again later.' });

  const subscriberQuery = new URLSearchParams({ select: 'email,business_name,state,keywords,commodity_codes', email: `eq.${email}`, status: 'eq.active', limit: '1' });
  let subscriber = (await fetchRows(supabaseUrl, serviceKey, 'state_alert_subscribers', subscriberQuery))[0] || null;

  if (!subscriber) {
    const memberSelect = 'email,business_name,industry,state,subscription_status,trial_end,bc_access_activated';
    const memberQuery = new URLSearchParams({ select: memberSelect, email: `eq.${email}`, bc_access_activated: 'eq.true', limit: '1' });
    const member = (await fetchRows(supabaseUrl, serviceKey, 'biz_center_members', memberQuery))[0] || null;
    const status = String(member?.subscription_status || '').toLowerCase();
    const trialValid = member?.trial_end && Date.parse(member.trial_end) > issuedAt;
    if (member && (['active', 'trial', 'trialing', 'paid', 'comp'].includes(status) || trialValid)) {
      const state = ['AZ', 'CA', 'NV'].includes(String(member.state || '').toUpperCase()) ? String(member.state).toUpperCase() : 'US';
      const keywords = [...new Set(String(member.industry || '').split(/[,/&|]+/).map((value) => value.trim()).filter(Boolean).slice(0, 12))];
      const payload = { email, business_name: member.business_name || 'Business Center Member', state, status: 'active', comp: true, keywords, commodity_codes: [], token: `member_${crypto.randomUUID()}` };
      const existingQuery = new URLSearchParams({ select: 'id', email: `eq.${email}`, limit: '1' });
      const existing = await fetchRows(supabaseUrl, serviceKey, 'state_alert_subscribers', existingQuery);
      const endpoint = existing.length ? `${supabaseUrl}/rest/v1/state_alert_subscribers?email=eq.${encodeURIComponent(email)}` : `${supabaseUrl}/rest/v1/state_alert_subscribers`;
      const method = existing.length ? 'PATCH' : 'POST';
      const provision = await fetch(endpoint, { method, headers: dbHeaders(serviceKey, { Prefer: 'return=representation' }), body: JSON.stringify(payload) });
      if (provision.ok) subscriber = (await provision.json().catch(() => []))[0] || payload;
    }
  }

  // Return a generic response for unknown addresses to avoid subscriber enumeration.
  if (!subscriber) return json(200, { ok: true, challenge });

  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(issuedAt + 10 * 60 * 1000).toISOString();
  await fetch(`${supabaseUrl}/rest/v1/state_login_codes?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers: dbHeaders(serviceKey, { Prefer: 'return=minimal' }) });
  const stored = await fetch(`${supabaseUrl}/rest/v1/state_login_codes`, {
    method: 'POST',
    headers: dbHeaders(serviceKey, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ email, state: subscriber.state || 'US', code: codeHash(email, code, secret), expires_at: expiresAt })
  });
  if (!stored.ok) return json(500, { error: 'The login code could not be created.' });

  if (resendKey) {
    const html = `<div style="background:#07152f;padding:34px 16px;font-family:Arial,sans-serif"><div style="max-width:460px;margin:0 auto;background:#10264f;border:1px solid #28477f;border-radius:10px;padding:32px;text-align:center"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9db0d4;margin-bottom:14px">National Corporate Contract Exchange</div><p style="color:#9db0d4;font-size:14px">Your one-time member access code:</p><div style="font-size:34px;letter-spacing:.28em;font-weight:700;color:#fff;background:#07111f;border:2px solid #6ee7a8;border-radius:10px;padding:18px;margin:18px 0">${code}</div><p style="color:#9db0d4;font-size:13px;line-height:1.6">This code expires in 10 minutes. Do not share it.</p></div></div>`;
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Your National Corporate Contract Exchange access code', html })
    });
    if (!emailResponse.ok) console.error('[send-login-code] Resend failure', emailResponse.status);
  }

  return json(200, { ok: true, challenge });
}
