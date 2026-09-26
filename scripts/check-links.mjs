/**
 * 内部链接检查（计划书 P0 CI 任务之一）。
 * 扫描 dist/ 下所有 HTML 中的 href/src，验证站内目标真实存在。
 * 外链（http/mailto）、锚点、内联数据一律跳过；发现断链时以退出码 1 失败。
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function resolveTarget(fromHtml, href) {
  const [withoutHash] = href.split('#');
  const [withoutQuery] = withoutHash.split('?');
  if (withoutQuery === '') return null; // 纯锚点
  const base = path.dirname(fromHtml);
  const target = path.resolve(base, decodeURIComponent(withoutQuery));
  const rel = path.relative(DIST, target);
  if (rel.startsWith('..')) return null; // 越出 dist 的路径不做判断
  return target;
}

async function exists(target) {
  try {
    const s = await stat(target);
    if (s.isFile()) return true;
    // 目录形式链接 → index.html
    return await stat(path.join(target, 'index.html'))
      .then(() => true)
      .catch(() => false);
  } catch {
    return false;
  }
}

const htmlFiles = [];
for await (const file of walk(DIST)) {
  if (file.endsWith('.html')) htmlFiles.push(file);
}

const seen = new Set();
const broken = [];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const attrs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const href of attrs) {
    if (
      seen.has(href) ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('data:') ||
      href.startsWith('#')
    ) {
      continue;
    }
    seen.add(href);
    const target = resolveTarget(file, href);
    if (target && !(await exists(target))) {
      broken.push({ from: path.relative(DIST, file), href });
    }
  }
}

if (broken.length > 0) {
  console.error(`[check-links] 发现 ${broken.length} 个断链：`);
  for (const b of broken) console.error(`  ✗ ${b.href}  (被 ${b.from} 引用)`);
  process.exit(1);
}
console.log(`[check-links] ${htmlFiles.length} 个页面、${seen.size} 个站内链接全部有效`);
