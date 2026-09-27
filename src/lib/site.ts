/** 站点级常量与 URL 工具 */

export const SITE_TITLE = '流水账';
export const SITE_DESCRIPTION =
  '一个「先记下、再整理、可长期保存」的个人数字花园：灵感速记、AI 对话归档、项目动态与博客。';
export const OG_IMAGE_PATH = 'og-default.png';

/** GitHub 用户名（页脚个人主页链接） */
export const GITHUB_USERNAME = 'os233';
export const GITHUB_PROFILE_URL = GITHUB_USERNAME
  ? `https://github.com/${GITHUB_USERNAME}`
  : 'https://github.com/';
/** 仓库地址（页脚代码许可证链接） */
export const GITHUB_REPO_URL = GITHUB_USERNAME
  ? `https://github.com/${GITHUB_USERNAME}/flow-ledger`
  : GITHUB_PROFILE_URL;

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
  const url = new URL(pathname, site ?? 'https://example.github.io');
  // 构建期目录式页面的 pathname 可能无尾斜杠（如首页 /flow-ledger），
  // 统一补齐为与 sitemap、站内链接一致的规范形态（带扩展名的文件路径除外）
  const last = url.pathname.split('/').pop() ?? '';
  if (last && !last.includes('.')) url.pathname += '/';
  return url.toString();
}

/** 2026-09-26 形式的日期显示（内容日期按 UTC 解析，取值也用 UTC 保持一致，避免负偏移时区提前一天） */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
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

/** Stars 数格式化：52400 → 52.4k，1250000 → 1.3M */
export function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
