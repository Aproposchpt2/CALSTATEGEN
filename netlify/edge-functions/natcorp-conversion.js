export default async function(request, context) {
  const url = new URL(request.url);
  const routeMap = {
    '/services': '/business-dna-builder-preview.html',
    '/services.html': '/business-dna-builder-preview.html',
    '/intake': '/business-dna-builder-preview.html',
    '/intake.html': '/business-dna-builder-preview.html',
    '/dashboard': '/aois-dashboard-preview.html',
    '/dashboard.html': '/aois-dashboard-preview.html',
    '/analyze-fit': '/analyze-fit-v2.html',
    '/analyze-fit.html': '/analyze-fit-v2.html'
  };

  const target = routeMap[url.pathname];
  if (target) {
    const redirectUrl = new URL(target, url.origin);
    redirectUrl.search = url.search;
    return Response.redirect(redirectUrl.toString(), 302);
  }

  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const html = await response.text();
  const scripts = [
    '<script src="/js/natcorp-session.js"></script>',
    '<script src="/js/natcorp-brand.js" defer></script>',
    '<script src="/js/aoie-dashboard.js" defer></script>',
    '<script src="/js/aois-advisor.js" defer></script>'
  ].filter(script => !html.includes(script.match(/src="([^"]+)/)?.[1] || ''));

  if (!scripts.length) return new Response(html, response);

  const injected = html.replace('</head>', scripts.join('') + '</head>');
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
