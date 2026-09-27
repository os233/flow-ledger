/**
 * 内容导出器（计划书 P1-B3）：内容主权出口，随时把内容搬去别的静态博客。
 *
 * 用法：
 *   npm run export -- <slug>                    单篇导出到 export/<slug>/（index.md + index.html + media/）
 *   npm run export -- --all                     全站内容 ZIP（content/ + public/media/）
 *   选项：
 *     --format md|html        单篇导出时只导一种格式（默认两种都导）
 *     --with-drafts           --all 时包含 draft（默认仅 public）
 *     --with-private          --all 时包含 private（默认排除；导出即脱离可见性保护，请自行保管）
 *     --out <dir>             输出目录（默认 export/）
 *
 * 可见性约定（docs/p1-charter.md 隐私影响节）：
 *   - 全站导出默认只含 public 内容；draft/private 需对应显式开关；
 *   - 单篇导出非 public 内容同样需要对应开关；
 *   - Markdown 导出附带 pubDate/description 别名字段，可直接放入
 *     Astro 官方 blog 模板（src/content/blog/）使用（B3 验收锚点）。
 */
import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { readDecoded, splitFrontmatter, parseSimpleFrontmatter, yamlEscape, slugify, parseTags, parseArgs } from './lib/content-io.mjs';

const require = createRequire(import.meta.url);
const archiver = require('archiver'); // archiver 为 CJS 包，无可靠 ESM 命名导出

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const TYPES = ['notes', 'archives', 'projects', 'posts', 'pages'];

/** 递归收集目录下的 Markdown（与内容集合的 glob 语义一致，含子目录） */
async function walkMd(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkMd(full, out);
    else if (/\.(md|mdx)$/i.test(entry.name)) out.push(full);
  }
}

/** 遍历 content/，解析每篇的 frontmatter */
async function collectEntries() {
  const entries = [];
  for (const type of TYPES) {
    const dir = path.join(CONTENT_DIR, type);
    const files = [];
    try {
      await walkMd(dir, files);
    } catch {
      continue;
    }
    for (const full of files) {
      // id 先于解析告警使用，必须在前声明（Astro glob loader 语义：相对集合目录路径去扩展名）
      const id = path.relative(dir, full).replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '');
      const { text } = await readDecoded(full);
      const split = splitFrontmatter(text);
      const parsed = split.frontmatter !== null ? parseSimpleFrontmatter(split.frontmatter) : { data: {}, broken: false };
      if (parsed.broken) {
        console.warn(`  ⚠ frontmatter 无法完整解析，按非公开内容处理（导出需 --with-drafts/--with-private）：${type}/${id}`);
      }
      const fm = parsed.data;
      // 可见性与构建期语义对齐：frontmatter 解析失败或其余集合缺 status 的条目
      // 不得默认按 public 导出（Zod schema 默认为 draft）；pages 无 status 概念，恒为 public
      const status = parsed.broken ? 'draft' : (fm.status ?? (type === 'pages' ? 'public' : 'draft'));
      entries.push({
        type,
        id,
        file: full,
        status,
        fm,
        body: split.body,
      });
    }
  }
  return entries;
}

/** 把正文里的 /media/... 站内绝对路径改为相对路径并收集附件（覆盖 Markdown 圆括号与 HTML 属性两种形态） */
async function extractMedia(body, destDir) {
  const mdRefs = [...body.matchAll(/\((\/media\/[^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  const attrRefs = [...body.matchAll(/\s(?:src|href)="(\/media\/[^"]+)"/g)].map((m) => m[1]);
  const refs = [...new Set([...mdRefs, ...attrRefs])];
  const copied = new Map(); // 原始引用 → 导出目录内相对路径
  for (const ref of refs) {
    if (copied.has(ref)) continue;
    // 引用是 URL 编码形式（如 my%20pic.png），先解码再探测真实文件
    let decoded = ref;
    try {
      decoded = decodeURIComponent(ref);
    } catch {
      // 畸形转义序列按原文处理
    }
    const src = path.join(ROOT, 'public', decoded.replace(/^\//, ''));
    try {
      await stat(src);
      // 定位文件用解码路径；改写正文保留原始编码形式——文件名含空格时
      // 裸空格在 Markdown 圆括号语法里是非法的（会被解析成标题）
      const relPath = ref.replace(/^\//, '');
      const dest = path.join(destDir, ...decoded.replace(/^\//, '').split('/'));
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      copied.set(ref, relPath);
    } catch {
      console.warn(`  ⚠ 附件缺失，保留原路径：${ref}`);
    }
  }
  for (const [ref, relPath] of copied) {
    // 圆括号形式（含可选标题）与 HTML 属性形式分别改写
    body = body.split(`(${ref})`).join(`(${relPath})`);
    body = body.split(`(${ref} `).join(`(${relPath} `);
    body = body.split(`"${ref}"`).join(`"${relPath}"`);
  }
  return { body, copied: [...copied.keys()] };
}

function frontmatterForExport(e) {
  const lines = [
    '---',
    `title: "${yamlEscape(e.fm.title ?? e.id)}"`,
  ];
  if (e.fm.date) lines.push(`date: ${e.fm.date}`, `pubDate: ${e.fm.date}`); // pubDate：Astro blog 模板别名字段
  if (e.fm.updated) lines.push(`updated: ${e.fm.updated}`);
  if (e.type !== 'pages') {
    // 标签重新引号序列化：原值含逗号/引号时裸值会产出损坏 YAML
    lines.push(`tags: [${parseTags(e.fm.tags).map((t) => `"${yamlEscape(t)}"`).join(', ')}]`);
    // description 始终导出：Astro blog 模板 schema 中为必填
    lines.push(`description: "${yamlEscape(e.fm.summary ?? '')}"`);
    if (e.fm.summary) lines.push(`summary: "${yamlEscape(e.fm.summary)}"`);
    lines.push(`status: ${e.status}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

const HTML_CSS = `
  body { max-width: 46rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.8;
         font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
         color: #1c1917; background: #fafaf9; }
  article h1, article h2, article h3 { line-height: 1.4; }
  article h2::before, article h3::before { content: '# '; color: #2563eb; opacity: 0.55; font-weight: 400; }
  pre { background: #f5f5f4; border: 1px solid #e2e1de; border-radius: 0.75rem; padding: 1rem; overflow-x: auto; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 0.875em; }
  img { max-width: 100%; border-radius: 0.75rem; }
  a { color: #1d4ed8; }
  footer { margin-top: 3rem; border-top: 1px solid #e2e1de; padding-top: 1rem; color: #78716c; font-size: 0.875rem; }
`;

async function exportSingle(e, outDir, format) {
  const dest = path.join(outDir, e.id);
  await mkdir(dest, { recursive: true });
  const { body } = await extractMedia(e.body, dest);

  if (format !== 'html') {
    const md = frontmatterForExport(e) + body.trim() + '\n';
    await writeFile(path.join(dest, 'index.md'), md, 'utf8');
  }
  if (format !== 'md') {
    const htmlBody = marked.parse(body);
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${(e.fm.title ?? e.id).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>
<style>${HTML_CSS}</style>
</head>
<body>
<article>
${htmlBody}
</article>
<footer>导出自 流水账（Flow Ledger）· ${new Date().toISOString().slice(0, 10)}</footer>
</body>
</html>
`;
    await writeFile(path.join(dest, 'index.html'), html, 'utf8');
  }
  console.log(`  ✓ ${e.type}/${e.id} → export/${e.id}/`);
}

async function exportAll(outDir, opts) {
  const entries = await collectEntries();
  const allowed = (s) => s === 'public' || (s === 'draft' && opts['with-drafts']) || (s === 'private' && opts['with-private']);
  const included = entries.filter((e) => allowed(e.status));
  const excluded = entries.length - included.length;

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const zipPath = path.join(outDir, `flow-ledger-content-${stamp}.zip`);
  await mkdir(outDir, { recursive: true });
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  // 不监听 error 会让目录缺失等问题变成 uncaughtException；finalize 只保证归档封装完成，还需等输出流落盘
  const flushed = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  for (const e of included) {
    archive.append(await readFile(e.file), { name: path.relative(ROOT, e.file).replace(/\\/g, '/') });
  }
  archive.directory(MEDIA_DIR, 'public/media');
  archive.append(
    [
      '# Flow Ledger 内容导出包',
      '',
      `导出时间：${new Date().toISOString()}`,
      `内容条目：${included.length}（public ${entries.filter((e) => e.status === 'public').length}，` +
        `draft ${opts['with-drafts'] ? '包含' : '排除'}，private ${opts['with-private'] ? '包含' : '排除'}）`,
      '',
      '## 结构',
      '- content/          全部内容（Markdown + Frontmatter，字段规范见 docs/content-guide.md）',
      '- public/media/     图片与附件（正文中以 /media/ 绝对路径引用，导入其他站点时改为相对路径）',
      '',
      '## 导入其他静态博客（Astro 官方 blog 模板示例）',
      '1. 将 content/posts/*.md 复制到模板的 src/content/blog/；',
      '2. 每篇已含 pubDate/description 别名字段，模板 schema 可直接校验；',
      '3. 图片复制到模板 public/ 下并按需调整路径。',
      '',
      'RSS 订阅源：站点 /rss.xml（本包未包含，属构建产物）。',
      '',
      '许可：代码 MIT，内容 CC BY 4.0（转载内容保留原作者署名）。',
    ].join('\n'),
    { name: 'EXPORT-README.md' },
  );
  await archive.finalize();
  await flushed;
  console.log(`  ✓ 全站内容包 → ${path.relative(ROOT, zipPath)}（${included.length} 篇，排除 ${excluded} 篇非公开内容）`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(opts.out ?? path.join(ROOT, 'export'));
  const entries = await collectEntries();

  if (opts.all) {
    await exportAll(outDir, opts);
    return;
  }

  const slug = opts._[0];
  if (!slug) {
    console.error('用法: npm run export -- <slug> [--format md|html] | npm run export -- --all [--with-drafts] [--with-private]');
    process.exit(1);
  }
  // type/slug 精确匹配优先；裸 slug 重名时（notes/foo 与 posts/foo）要求消歧
  const matches = entries.filter((x) => x.id === slug || `${x.type}/${x.id}` === slug);
  const e = matches.find((x) => `${x.type}/${x.id}` === slug) ?? (matches.length === 1 ? matches[0] : undefined);
  if (!e) {
    if (matches.length > 1) {
      console.error(`"${slug}" 在多个类型下重名，请用 type/slug 形式指定：\n  ` + matches.map((x) => `${x.type}/${x.id} (${x.status})`).join('\n  '));
    } else {
      console.error(`未找到内容 "${slug}"。可用 slug：\n  ` + entries.map((x) => `${x.type}/${x.id} (${x.status})`).join('\n  '));
    }
    process.exit(1);
  }
  // 可见性红线：非 public 内容导出需显式开关
  if (e.status !== 'public') {
    const flag = e.status === 'draft' ? '--with-drafts' : '--with-private';
    if (!(e.status === 'draft' ? opts['with-drafts'] : opts['with-private'])) {
      console.error(`"${slug}" 状态为 ${e.status}，导出需显式开关 ${flag}（导出后内容脱离可见性保护，请自行保管）`);
      process.exit(1);
    }
  }
  const format = opts.format;
  if (format && !['md', 'html'].includes(format)) {
    console.error(`非法 format "${format}"，可选：md | html`);
    process.exit(1);
  }
  await exportSingle(e, outDir, format);
  console.log(`输出目录：${path.relative(ROOT, outDir)}`);
}

main().catch((err) => {
  console.error(`失败: ${err.message}`);
  process.exit(1);
});
