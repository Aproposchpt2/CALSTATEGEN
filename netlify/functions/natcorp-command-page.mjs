export default async (req) => {
  const url = new URL(req.url);
  const source = await fetch(`${url.origin}/natcorp-command.html`, { headers:{accept:'text/html'}, signal:AbortSignal.timeout(15000) });
  if (!source.ok) return new Response('Command Center unavailable.',{status:502});
  return new Response(await source.text(),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
};
export const config = { path:'/natcorp-command', preferStatic:false };
