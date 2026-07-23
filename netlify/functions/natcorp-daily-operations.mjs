import { commandAuthorized, db, env, json, nowIso, runSnapshot, sameOrigin } from './_shared/natcorp-runtime.mjs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    if (!commandAuthorized(req)) return json(401, { ok:false, error:'Command Center access key required.' });
    if (req.method === 'GET') {
      const requested = url.searchParams.get('run_id');
      let runId = requested;
      if (!runId) {
        const rows = await db('natcorp_daily_runs','GET','?select=run_id&order=created_at.desc&limit=1');
        runId = rows?.[0]?.run_id || null;
      }
      return json(200, runId ? { ok: true, ...(await runSnapshot(runId)) } : { ok: true, run: null, jobs: [], brief: null, events: [] });
    }
    if (req.method !== 'POST') return json(405, { ok: false, error: 'GET or POST required.' });
    if (!sameOrigin(req)) return json(403, { ok: false, error: 'Same-origin command required.' });
    let body = {}; try { body = await req.json(); } catch {}
    const action = body.action === 'resume' ? 'resume' : 'begin';
    let runId = body.run_id || null;
    if (action === 'resume') {
      if (!runId) return json(400, { ok: false, error: 'run_id is required to resume.' });
      const runs = await db('natcorp_daily_runs','GET',`?run_id=eq.${encodeURIComponent(runId)}&select=*`);
      if (!runs?.[0]) return json(404, { ok: false, error: 'Run not found.' });
      await db('natcorp_daily_runs','PATCH',`?run_id=eq.${encodeURIComponent(runId)}`,{ status:'queued', completed_at:null, error_message:null, current_stage:'resume_queued' },'return=minimal');
    } else {
      const active = await db('natcorp_daily_runs','GET','?status=in.(queued,running)&select=run_id,status,created_at&limit=1');
      if (active?.length) return json(409, { ok: false, error: 'A daily run is already active.', run_id: active[0].run_id });
      const rows = await db('natcorp_daily_runs','POST','',[{ status:'queued', triggered_by:'natcorp-command', current_stage:'queued', total_jobs:5, completed_jobs:0, failed_jobs:0, summary:{ requested_at:nowIso() } }],'return=representation');
      runId = rows?.[0]?.run_id;
      if (!runId) throw new Error('Daily run creation failed.');
    }
    const origin = url.origin;
    const internalToken = env('NATCORP_INTERNAL_TOKEN_PRODUCTION') || env('NATCORP_INTERNAL_TOKEN');
    const response = await fetch(`${origin}/.netlify/functions/natcorp-daily-operations-background`, {
      method:'POST', headers:{ 'content-type':'application/json', 'x-natcorp-internal-token': internalToken },
      body:JSON.stringify({ run_id:runId, base_url:origin }), signal:AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 202) throw new Error(`Background orchestrator rejected the request (${response.status}).`);
    return json(202, { ok:true, run_id:runId, status:'queued', action });
  } catch (error) {
    return json(500, { ok:false, error:error instanceof Error ? error.message : String(error) });
  }
};
export const config = { path:'/api/natcorp-daily-operations' };
