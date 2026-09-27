import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { COLLECTION_LABELS, COLLECTION_PATHS } from '@/lib/content';
import { SITE_DESCRIPTION, SITE_TITLE, withBase } from '@/lib/site';

export const GET: APIRoute = async (context) => {
  // RSS 只收录 public 内容：draft 与 private 一律不出现在订阅源
  const collections = await Promise.all([
    getCollection('notes'),
    getCollection('archives'),
    getCollection('projects'),
    getCollection('posts'),
  ]);

  const items = collections
    .flat()
    .filter((e) => e.data.status === 'public')
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map((e) => ({
      title: `[${COLLECTION_LABELS[e.collection]}] ${e.data.title}`,
      description: e.data.summary ?? '',
      pubDate: e.data.date,
      link: withBase(`${COLLECTION_PATHS[e.collection]}/${e.id}/`),
      categories: e.data.tags,
    }));

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // context.site 不含部署 base，频道级 <link> 需显式拼接，否则订阅器里的站点链接落到域名根路径
    site: new URL(withBase('/'), context.site ?? 'https://example.github.io'),
    items,
    customData: '<language>zh-CN</language>',
  });
};
