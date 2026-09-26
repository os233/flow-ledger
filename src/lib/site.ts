/** 站点级常量与 URL 工具 */

export const SITE_TITLE = '流水账';
export const SITE_DESCRIPTION =
  '一个「先记下、再整理、可长期保存」的个人数字花园：灵感速记、AI 对话归档、项目动态与博客。';
export const OG_IMAGE_PATH = 'og-default.png';

/** TODO: 替换为你的 GitHub 用户名（页脚个人主页链接） */
export const GITHUB_USERNAME = '';
export const GITHUB_PROFILE_URL = GITHUB_USERNAME
  ? `https://github.com/${GITHUB_USERNAME}`
  : 'https://github.com/';

/** Astro 注入的基础路径：部署为 '/flow-ledger'，本地根路径预览时为 '/' */
const RAW_BASE = import.meta.env.BASE_URL;
const BASE = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE;

/** 拼接站点内相对路径（自动带上部署 base，兼容根路径模式） */
export function withBase(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`;
}

/** 基于当前请求的规范链接（canonical） */
export function canonicalUrl(pathname: string, site: URL | undefined): string {
  return new URL(pathname, site ?? 'https://example.github.io').toString();
}

/** 2026-09-26 形式的日期显示 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** x 天前的相对时间描述 */
export function relativeDays(date: Date): string {
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.round(days / 30)} 个月前`;
  return `${(days / 365).toFixed(1)} 年前`;
}

/** Stars 数格式化：52400 → 52.4k */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
