/**
 * Pagefind 搜索索引构建（计划书 P1-B5）。
 *
 * 在 astro build 之后运行：pagefind --site dist，
 * 并断言「被索引的页面数 === dist 中的可索引 HTML 页面数」——
 * 可索引 = 未在 <html>/<body> 上声明 data-pagefind-ignore 的页面（搜索页、404 等工具页整页排除）。
 * 由于 check-visibility.mjs 已证明 dist 不含 draft/private（夹具 slug 零出现），
 * 索引页数与可索引产物页数一致 + dist 无违规 ⇒ 搜索索引不可能包含非公开内容。
 * （Pagefind 索引文件为压缩格式，无法直接文本 grep，故采用该传递性校验。）
 */
import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'dist');

/** 解析 pagefind 平台二进制（npm 包含 extended 构建，支持 CJK） */
function resolvePagefindBinary() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const arch = process.env.npm_config_arch || os.arch();
  const ext = process.platform === 'win32' ? '.exe' : '';
  for (const name of ['pagefind_extended', 'pagefind']) {
    const p = path.join(ROOT, 'node_modules', '@pagefind', `${platform}-${arch}`, 'bin', `${name}${ext}`);
    try {
      accessSync(p);
      return p;
    } catch {
      /* 尝试下一个名字 */
    }
  }
  throw new Error(`未找到 pagefind 二进制（${platform}-${arch}），请重新 npm install`);
}

/** 整页级排除：<html> 或 <body> 标签上声明 data-pagefind-ignore（元素级排除不计入） */
const WHOLE_PAGE_IGNORE = /<(?:html|body)\b[^>]*\bdata-pagefind-ignore\b/;

async function countHtml(dir) {
  let total = 0;
  let indexable = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await countHtml(full);
      total += sub.total;
      indexable += sub.indexable;
    } else if (entry.name.endsWith('.html')) {
      total++;
      const content = await readFile(full, 'utf8');
      if (!WHOLE_PAGE_IGNORE.test(content)) indexable++;
    }
  }
  return { total, indexable };
}

const { total: htmlCount, indexable } = await countHtml(DIST);
if (htmlCount === 0) {
  console.error('[index-search] dist 中没有 HTML 页面，先运行 astro build');
  process.exit(1);
}

let output = '';
try {
  const binary = resolvePagefindBinary();
  const res = spawnSync(binary, ['--site', DIST], { encoding: 'utf8', windowsHide: true });
  output = (res.stdout ?? '') + (res.stderr ?? '');
  if (res.status !== 0) {
    console.error(`[index-search] pagefind 运行失败（exit ${res.status}）`);
    process.stdout.write(output);
    process.exit(1);
  }
} catch (err) {
  console.error(`[index-search] ${err.message}`);
  process.exit(1);
}
process.stdout.write(output + '\n');

const matched = Number(output.match(/Found (\d+) files matching/i)?.[1] ?? NaN);
const indexed = Number(output.match(/Indexed (\d+) pages/i)?.[1] ?? NaN);
const summary = output.match(/Indexed (\d+) pages/i) ? 'Indexed 行' : 'Found 行';

if (Number.isNaN(matched)) {
  console.error('[index-search] 无法从 pagefind 输出解析文件数');
  process.exit(1);
}
if (Number.isNaN(indexed)) {
  // 极旧版本 pagefind 没有 Indexed 行：退回「Found 数 === dist 全部页面数」的旧口径
  if (matched !== htmlCount) {
    console.error(
      `[index-search] 页数不一致：pagefind 匹配 ${matched}，dist 实际 ${htmlCount} —— 存在未被预期收录的页面`,
    );
    process.exit(1);
  }
} else if (indexed !== indexable) {
  console.error(
    `[index-search] 页数不一致：pagefind 索引 ${indexed}，dist 可索引页面 ${indexable}（共 ${htmlCount} 页，其中 ${htmlCount - indexable} 页被 data-pagefind-ignore 整页排除）—— 索引与产物不匹配`,
  );
  process.exit(1);
}
const finalCount = Number.isNaN(indexed) ? matched : indexed;
if (finalCount <= 0) {
  console.error('[index-search] 索引页数为 0');
  process.exit(1);
}
console.log(
  `[index-search] 搜索索引构建完成：${summary}=${finalCount}，与 dist 可索引页面数一致（${indexable}/${htmlCount}）；可见性由 check-visibility 传递保证`,
);
