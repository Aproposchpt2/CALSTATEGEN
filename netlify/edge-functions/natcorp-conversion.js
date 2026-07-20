export default async function(_request, context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = await response.text();
  if (html.includes('/js/natcorp-brand.js')) return new Response(html, response);
  const injected = html.replace('</head>', '<script src="/js/natcorp-brand.js" defer></script></head>');
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
