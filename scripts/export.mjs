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
import { readDecoded, splitFrontmatter, parseSimpleFrontmatter, yamlEscape, slugify, parseTags } from './lib/content-io.mjs';

const require = createRequire(import.meta.url);
const archiver = require('archiver'); // archiver 为 CJS 包，无可靠 ESM 命名导出

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const TYPES = ['notes', 'archives', 'projects', 'posts', 'pages'];

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opts[a.slice(2)] = true;
      else {
        opts[a.slice(2)] = next;
        i++;
      }
    } else opts._.push(a);
  }
  return opts;
}

/** 遍历 content/，解析每篇的 frontmatter */
async function collectEntries() {
  const entries = [];
  for (const type of TYPES) {
    const dir = path.join(CONTENT_DIR, type);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of files.filter((f) => /\.(md|mdx)$/i.test(f))) {
      const full = path.join(dir, name);
      const { text } = await readDecoded(full);
      const split = splitFrontmatter(text);
      const fm = split.frontmatter !== null ? parseSimpleFrontmatter(split.frontmatter).data : {};
      entries.push({
        type,
        id: name.replace(/\.(md|mdx)$/i, ''),
        file: full,
        status: fm.status ?? 'public',
        fm,
        body: split.body,
      });
    }
  }
  return entries;
}

/** 把正文里的 /media/... 站内绝对路径改为相对路径并收集附件 */
async function extractMedia(body, destDir) {
  const mediaRoot = path.join(destDir, 'media');
  const refs = [...body.matchAll(/\((\/media\/[^)\s]+)\)/g)].map((m) => m[1]);
  const copied = new Set();
  for (const ref of refs) {
    if (copied.has(ref)) continue;
    const src = path.join(ROOT, 'public', ref.replace(/^\//, ''));
    try {
      await stat(src);
      await mkdir(mediaRoot, { recursive: true });
      await copyFile(src, path.join(mediaRoot, path.basename(ref)));
      copied.add(ref);
    } catch {
      console.warn(`  ⚠ 附件缺失，保留原路径：${ref}`);
    }
  }
  for (const ref of copied) {
    body = body.split(`(${ref})`).join('(media/' + path.basename(ref) + ')');
  }
  return { body, copied: [...copied] };
}

function frontmatterForExport(e) {
  const lines = [
    '---',
    `title: "${yamlEscape(e.fm.title ?? e.id)}"`,
  ];
  if (e.fm.date) lines.push(`date: ${e.fm.date}`, `pubDate: ${e.fm.date}`); // pubDate：Astro blog 模板别名字段
  if (e.fm.updated) lines.push(`updated: ${e.fm.updated}`);
  if (e.type !== 'pages') {
    lines.push(`tags: [${parseTags(e.fm.tags).join(', ')}]`);
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
<title>${(e.fm.title ?? e.id).replace(/</g, '&lt;')}</title>
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
  const e = entries.find((x) => x.id === slug || `${x.type}/${x.id}` === slug);
  if (!e) {
    console.error(`未找到内容 "${slug}"。可用 slug：\n  ` + entries.map((x) => `${x.type}/${x.id} (${x.status})`).join('\n  '));
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
