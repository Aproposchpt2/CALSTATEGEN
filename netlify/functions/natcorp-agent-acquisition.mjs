import { acquisitionAgent, getRun, internalAuthorized, json } from './_shared/natcorp-runtime.mjs';
export default async (req) => {
  if (!internalAuthorized(req)) return json(401,{ok:false,error:'Unauthorized'});
  if (req.method !== 'POST') return json(405,{ok:false,error:'POST required'});
  try {
    const body = await req.json();
    const run = await getRun(body.run_id);
    if (!run) return json(404,{ok:false,error:'Run not found'});
    const output = await acquisitionAgent({ runId:body.run_id, run, input:body.input || {} });
    return json(200,{ok:true,output});
  } catch (error) { return json(500,{ok:false,error:error instanceof Error?error.message:String(error)}); }
};
