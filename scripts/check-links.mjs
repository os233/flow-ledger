/**
 * 内部链接检查（计划书 P0 CI 任务之一）。
 * 扫描 dist/ 下所有 HTML 中的 href/src，验证站内目标真实存在。
 * 外链（http/mailto）、锚点、内联数据一律跳过；发现断链时以退出码 1 失败。
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 默认检查 dist/；PR 预览工作流通过 DIST_DIR 指向合并后的产物目录
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'dist');
// 部署 base（与 astro.config 的 BASE_PATH 同源，逗号分隔支持多层，如合并预览产物）
const BASES = (process.env.BASE_PATHS ?? process.env.BASE_PATH ?? '/flow-ledger')
  .split(',')
  .map((b) => b.trim().replace(/\/$/, ''))
  .filter(Boolean);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** 畸形转义序列（如 %zz）decode 会抛异常，按原文处理 */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveTarget(fromHtml, href) {
  const [withoutHash] = href.split('#');
  const withoutQuery = withoutHash.split('?')[0];
  if (withoutQuery === '') return null; // 纯锚点

  if (withoutQuery.startsWith('/')) {
    // 站内绝对路径：剥离部署 base 前缀后映射到产物根
    // （项目 Pages 的产物根对应 /flow-ledger/，因此 href 需先去掉 base 再定位文件）
    let rel = withoutQuery;
    for (const b of BASES) {
      if (withoutQuery === b || withoutQuery.startsWith(b + '/')) {
        rel = withoutQuery.slice(b.length) || '/';
        break;
      }
    }
    return path.join(DIST, safeDecode(rel));
  }
  const target = path.resolve(path.dirname(fromHtml), safeDecode(withoutQuery));
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
  // 前置空白边界：排除 data-src 之类的其他属性被误当链接
  const attrs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const href of attrs) {
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('data:') ||
      href.startsWith('#')
    ) {
      continue;
    }
    const target = resolveTarget(file, href);
    // 去重键用解析结果而非原始 href：相对链接的解析依赖所在目录，
    // 按原文字符串去重会让 A 页面解析成功的写法掩盖 B 页面同写法的断链
    const key = target ?? `unresolvable:${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
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
