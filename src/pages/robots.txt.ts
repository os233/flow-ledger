import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  // sitemap 实际位于 base 子路径下（/flow-ledger/sitemap-index.xml），
  // site 配置不含 base，需要显式拼接
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const sitemapUrl = new URL(`${base}/sitemap-index.xml`, site ?? 'https://example.github.io');
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
