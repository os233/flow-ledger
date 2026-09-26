/**
 * 内容可见性回归检查（计划书 P0 验收：产物/列表/RSS/sitemap 不得含草稿与私密内容）。
 *
 * 以夹具 slug 为标记扫描 dist 全部文本产物：
 * - 私密夹具 2026-09-20-private-idea 与草稿夹具 2026-09-22-draft-fixture：
 *   任何产物文件中出现即失败（页面、站内链接、RSS、sitemap 均覆盖）；
 * - 正向对照：公开笔记 2026-09-01-first-note 必须存在，防止空产物静默通过。
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 默认检查 dist/；PR 预览工作流通过 DIST_DIR 指向合并后的产物目录
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'dist');

const PRIVATE_SLUG = '2026-09-20-private-idea';
const DRAFT_SLUG = '2026-09-22-draft-fixture';
const PUBLIC_SLUG = '2026-09-01-first-note';

const TEXT_EXTENSIONS = new Set([
  '.html',
  '.xml',
  '.txt',
  '.json',
  '.js',
  '.css',
  '.svg',
]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const violations = [];
let publicSlugFound = false;
let scanned = 0;

for await (const file of walk(DIST)) {
  if (!TEXT_EXTENSIONS.has(path.extname(file))) continue;
  const text = await readFile(file, 'utf8');
  scanned += 1;
  const rel = path.relative(DIST, file);
  if (text.includes(PRIVATE_SLUG)) violations.push(`私密夹具出现在 ${rel}`);
  if (text.includes(DRAFT_SLUG)) violations.push(`草稿夹具出现在 ${rel}`);
  if (text.includes(PUBLIC_SLUG)) publicSlugFound = true;
}

if (!publicSlugFound) {
  violations.push('正向对照失败：公开笔记 slug 未出现在任何产物中（产物可能为空或异常）');
}

if (violations.length > 0) {
  console.error(`[check-visibility] 发现 ${violations.length} 处可见性违规：`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  process.exit(1);
}
console.log(
  `[check-visibility] ${scanned} 个文本产物检查通过：私密/草稿夹具未泄漏，公开内容对照存在`,
);
