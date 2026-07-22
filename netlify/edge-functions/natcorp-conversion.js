export default async function(_request, context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const html = await response.text();
  const scripts = [
    '<script src="/js/natcorp-session.js"></script>',
    '<script src="/js/natcorp-brand.js" defer></script>',
    '<script src="/js/aoie-capability-profile.js" defer></script>',
    '<script src="/js/aoie-dashboard.js" defer></script>'
  ].filter(script => !html.includes(script.match(/src="([^"]+)/)?.[1] || ''));

  if (!scripts.length) return new Response(html, response);

  const injected = html.replace('</head>', scripts.join('') + '</head>');
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
