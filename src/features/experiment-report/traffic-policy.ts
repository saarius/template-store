/** Conservative request classification only. Nothing from the request is retained. */
export function isPublicTrafficPage(path: string): boolean {
  return /^\/(?:|shop|cart|checkout|account|search|field-notes|shipping|returns|test-store|products\/[a-z0-9-]+|categories\/[a-z0-9-]+|field-note-[a-z0-9-]+|dashboard(?:\/(?:history|contributions|instructions(?:\/[a-z0-9-]+)?))?)$/.test(path);
}

export function qualifiesTraffic(request: Request, response: Response): boolean {
  const url = new URL(request.url);
  if (url.hostname !== 'backroadbum.com' || !isPublicTrafficPage(url.pathname) ||
      request.method !== 'GET' || response.status !== 200 ||
      !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '')) return false;
  const headers = request.headers;
  if (url.searchParams.has('_preview') || url.searchParams.has('_edit') || headers.has('authorization') ||
      /(?:^|;)\s*emdash-edit-mode=true(?:;|$)/.test(headers.get('cookie') ?? '')) return false;
  if (headers.get('sec-fetch-mode') !== 'navigate' || headers.get('sec-fetch-dest') !== 'document' ||
      !headers.get('accept')?.includes('text/html') ||
      headers.get('x-backroadbum-self-check') === '1' ||
      /prefetch|prerender/i.test(`${headers.get('purpose') ?? ''} ${headers.get('sec-purpose') ?? ''}`)) return false;
  const agent = headers.get('user-agent') ?? '';
  return agent.startsWith('Mozilla/') &&
    !/bot|spider|crawler|slurp|headless|lighthouse|pagespeed|curl|wget|python|urllib|httpx|undici|playwright|puppeteer|selenium|selfcheck|health|uptime|monitor|facebookexternalhit|preview|chatgpt|claude|openai|anthropic/i.test(agent);
}
