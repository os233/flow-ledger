import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * 内容可见性规则（计划书第 4 节安全约束）：
 * - private：任何情况下都不构建进产物，绝不依赖前端隐藏；
 * - draft：生产构建不可见，本地开发可见（便于预览排版）；
 * - public：始终可见。
 */
export function isVisible(status: 'draft' | 'private' | 'public'): boolean {
  if (status === 'private') return false;
  if (status === 'draft') return import.meta.env.DEV;
  return true;
}

/** 出现在首页时间流中的内容类型 */
export type FeedCollectionName = 'notes' | 'archives' | 'projects' | 'posts';
export type FeedEntry = CollectionEntry<FeedCollectionName>;

export const COLLECTION_LABELS: Record<FeedCollectionName, string> = {
  notes: '灵感',
  archives: '归档',
  projects: '项目',
  posts: '博客',
};

export const COLLECTION_PATHS: Record<FeedCollectionName, string> = {
  notes: 'notes',
  archives: 'archives',
  projects: 'projects',
  posts: 'posts',
};

/** 按类型取可见条目（生产构建过滤 private + draft） */
export async function getVisibleEntries<C extends FeedCollectionName>(
  name: C,
): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(name);
  return entries.filter((e) => isVisible(e.data.status));
}

/** 首页时间流：四类内容合并，按日期倒序 */
export async function getFeedEntries(): Promise<FeedEntry[]> {
  const [notes, archives, projects, posts] = await Promise.all([
    getVisibleEntries('notes'),
    getVisibleEntries('archives'),
    getVisibleEntries('projects'),
    getVisibleEntries('posts'),
  ]);
  const all: FeedEntry[] = [...notes, ...archives, ...projects, ...posts];
  return all.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

/** 全站标签集合（仅可见内容），值为标签、为出现次数 */
export async function getTagCounts(
  entries: FeedEntry[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}
