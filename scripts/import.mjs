/**
 * 内容导入器（计划书 P1-B2）。
 *
 * 用法：
 *   npm run import -- <文件或目录...> [--type posts] [--status draft] [--report <路径>]
 *
 * 支持格式（按扩展名与内容自动识别）：
 *   - Markdown（.md/.markdown）：frontmatter 归一化 + 损坏检测
 *   - HTML（.html/.htm）：turndown 转 Markdown，图片落盘到 public/media/
 *   - WordPress WXR（.xml，含 wp 命名空间）：解析 item，pubDate 时区归一为 UTC 日期
 *
 * 行为约定（对应 docs/p1-charter.md 隐私影响节）：
 *   - 一律导入为 status: draft（可用 --status 覆盖），绝不自动公开；
 *   - slug 冲突自动加 -2/-3 后缀；
 *   - 相对路径图片复制到 public/media/import-<slug>/ 并改写链接；
 *   - 每次运行生成迁移报告（标题/日期/图片/代码块/标签/损失逐项可追溯）；
 *   - frontmatter 损坏的 Markdown 跳过并记录，不做猜测性修复。
 */
import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import { XMLParser } from 'fast-xml-parser';
import { readDecoded, splitFrontmatter, parseSimpleFrontmatter, yamlEscape, slugify, parseTags, normalizeDate } from './lib/content-io.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const CONTENT_DIR = path.join(ROOT, 'content');
const TYPES = ['notes', 'archives', 'projects', 'posts', 'pages'];

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
// 保留 WordPress 常见但 turndown 默认丢弃的块级元素，转成报告可追溯的占位注释
turndown.addRule('reportLosses', {
  filter: ['iframe', 'form', 'button', 'style', 'script'],
  replacement: (_content, node) => `\n\n<!-- 迁移损失：丢弃 <${node.nodeName.toLowerCase()}> 元素 -->\n\n`,
});
turndown.addRule('wpCaption', {
  filter: (node) => node.nodeName === 'FIGURE' || node.nodeName === 'FIGCAPTION',
  replacement: (content, node) => {
    if (node.nodeName === 'FIGCAPTION') return content.trim() ? `_${content.trim()}_\n` : '\n';
    return `\n\n${content.trim()}\n\n`;
  },
});

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

const usedSlugs = new Set();
async function pickPath(dir, base) {
  let candidate = base;
  let n = 1;
  while (usedSlugs.has(candidate)) {
    n++;
    candidate = `${base}-${n}`;
  }
  usedSlugs.add(candidate);
  return { name: `${candidate}.md`, full: path.join(dir, `${candidate}.md`), renamed: n > 1 ? String(n) : '' };
}

/** 复制一张相对图片；成功返回目标 URL，失败返回 null 并记录损失 */
async function copyImage(src, baseFile, slug) {
  const abs = path.resolve(path.dirname(baseFile), src.split(/[?#]/)[0]);
  try {
    await stat(abs);
    const imgDir = path.join(MEDIA_DIR, `import-${slug}`);
    await mkdir(imgDir, { recursive: true });
    const dest = path.join(imgDir, path.basename(abs));
    await copyFile(abs, dest);
    return `/media/import-${slug}/${path.basename(abs)}`;
  } catch {
    return null;
  }
}

/** HTML 内容里的 <img>：相对路径图片落盘改写；缺失/内联的记为损失，绝不留相对路径在正文 */
async function processImages(html, slug, notes, losses, baseFile) {
  const imgs = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  let copied = 0;
  for (const m of imgs) {
    const src = m[1];
    if (/^(https?:)?\/\//.test(src)) {
      notes.push(`图片为绝对 URL，保留原链接：${src}`);
      continue;
    }
    if (/^data:/i.test(src)) {
      losses.push(`内联 data: 图片未落盘（${src.slice(0, 40)}…）`);
      html = html.replace(m[0], `<p>【迁移损失】内联 data: 图片未落盘</p>`);
      continue;
    }
    const dest = await copyImage(src, baseFile, slug);
    if (dest) {
      html = html.replace(m[0], `<img src="${dest}" alt="">`);
      copied++;
    } else {
      losses.push(`相对图片源文件不存在，正文移除并记录：${src}`);
      // 文本段落占位：turndown 会丢弃 HTML 注释，只有元素文本能穿透转换
      html = html.replace(m[0], `<p>【迁移损失】图片缺失：${src}</p>`);
    }
  }
  if (copied) notes.push(`落盘图片 ${copied} 张到 public/media/import-*/`);
  return { html, copied };
}

/** Markdown 内容里的 ![alt](src)：与 HTML 同策略，缺失即替换为损失注释 */
async function processMarkdownImages(md, slug, notes, losses, baseFile) {
  const imgs = [...md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  let copied = 0;
  for (const m of imgs) {
    const [, alt, src] = m;
    if (/^(https?:)?\/\//.test(src)) continue;
    const dest = await copyImage(src, baseFile, slug);
    if (dest) {
      md = md.replace(m[0], `![${alt}](${dest})`);
      copied++;
    } else {
      losses.push(`相对图片源文件不存在，正文移除并记录：${src}`);
      md = md.replace(m[0], `<!-- 迁移损失：图片缺失 ${src} -->`);
    }
  }
  if (copied) notes.push(`落盘图片 ${copied} 张到 public/media/import-*/`);
  return { md, copied };
}

async function importMarkdown(file, o) {
  const { text, encoding } = await readDecoded(file);
  const notes = [`源编码: ${encoding}`];
  const losses = [];
  const size = (await stat(file)).size;
  if (size > 1024 * 1024) notes.push(`大文件：${(size / 1024 / 1024).toFixed(1)} MB`);

  const split = splitFrontmatter(text);
  if (split.broken) throw Object.assign(new Error('frontmatter 结构损坏（缩进/嵌套异常）'), { skip: true });
  let data = {};
  if (split.frontmatter !== null) {
    const parsed = parseSimpleFrontmatter(split.frontmatter);
    if (parsed.broken) throw Object.assign(new Error('frontmatter 解析异常'), { skip: true });
    data = parsed.data;
  }
  const title = data.title ?? path.basename(file).replace(/\.(md|markdown)$/i, '');
  const tzNote = [];
  const date = normalizeDate(data.date ?? fileDate(file), tzNote, 'frontmatter');
  notes.push(...tzNote);
  if (data.status && data.status !== 'public') notes.push(`源 status: ${data.status} → 导入状态 ${o.status}`);

  const slug = slugify(title) || 'md';
  const img = await processMarkdownImages(split.body.trim(), slug, notes, losses, file);
  if (img.copied) notes.push(`落盘图片 ${img.copied} 张到 public/media/import-*/`);

  return {
    title,
    date,
    tags: parseTags(data.tags),
    summary: data.summary ?? '',
    body: img.md,
    sourceLink: data.sourceurl ?? null,
    notes,
    losses,
  };
}

async function importHtml(file, o) {
  const { text, encoding } = await readDecoded(file);
  const notes = [`源编码: ${encoding}`];
  const losses = [];
  const title =
    text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ??
    text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ??
    path.basename(file, '.html');
  const dateMatch =
    text.match(/<time[^>]*datetime=["']([^"']+)["']/i) ??
    text.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
  const tzNote = [];
  const date = normalizeDate(dateMatch?.[1] ?? fileDate(file), tzNote, dateMatch ? 'time/meta 标签' : '文件时间');
  notes.push(...tzNote);

  // 抽取 body，避免把 head 里的脚本样式转成 Markdown
  const body = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? text;
  let html = body.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const img = await processImages(html, slugify(title) || 'html', notes, losses, file);
  html = img.html;
  if (img.copied) notes.push(`落盘图片 ${img.copied} 张到 public/media/import-*/`);

  const md = turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
  const tagMatches = [...text.matchAll(/<meta[^>]+property=["']article:tag["'][^>]+content=["']([^"']+)["']/gi)].map((m) => m[1]);
  return {
    title,
    date,
    tags: tagMatches,
    summary: text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '',
    body: md,
    sourceLink: null,
    notes,
    losses,
  };
}

async function importWxr(file, o) {
  const { text, encoding } = await readDecoded(file);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const xml = parser.parse(text);
  const channel = xml.rss?.channel;
  const itemsRaw = channel?.item ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];
  const out = [];
  for (const item of items) {
    const postType = item['wp:post_type'] ?? 'post';
    const postStatus = item['wp:status'] ?? 'publish';
    const notes = [`WXR item: post_type=${postType}, wp:status=${postStatus}`];
    const losses = [];
    if (postType !== 'post' || postStatus === 'trash') {
      notes.push('非文章或已删除，跳过正文，仅记录');
      out.push({ title: item.title ?? '(untitled)', skipped: true, notes, losses });
      continue;
    }
    const tzNote = [];
    const date = normalizeDate(item['wp:post_date_gmt'] ?? item.pubDate, tzNote, 'wp:post_date_gmt/pubDate');
    notes.push(...tzNote);
    const contentHtml = item['content:encoded'] ?? '';
    const img = await processImages(contentHtml, slugify(item.title ?? 'wxr') || 'wxr', notes, losses, file);
    const categories = [].concat(item.category ?? []).map((c) => (typeof c === 'string' ? c : c?.['#text'] ?? '')).filter(Boolean);
    out.push({
      title: item.title ?? '(untitled)',
      date,
      tags: categories,
      summary: item.description ?? '',
      body: turndown.turndown(img.html).replace(/\n{3,}/g, '\n\n').trim(),
      sourceLink: item.link ?? null,
      notes,
      losses,
    });
  }
  return out;
}

function fileDate(file) {
  return new Date().toISOString().slice(0, 10);
}

const CONTENT_EXT = /\.(md|markdown|html?|htm|xml)$/i;

async function collectFiles(target) {
  const s = await stat(target);
  if (s.isFile()) return [target];
  const out = [];
  async function walk(dir) {
    for (const f of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) await walk(full);
      else if (CONTENT_EXT.test(f.name)) out.push(full);
    }
  }
  await walk(target);
  return out;
}

function detectFormat(file, head) {
  if (/\.(md|markdown)$/i.test(file)) return 'markdown';
  if (/\.xml$/i.test(file) || head.includes('xmlns:wp')) return 'wxr';
  if (/\.(html?|htm)$/i.test(file)) return 'html';
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts._.length) {
    console.error('用法: npm run import -- <文件或目录...> [--type posts] [--status draft] [--report docs/migrations/xxx.md]');
    process.exit(1);
  }
  const type = opts.type ?? 'posts';
  if (!TYPES.includes(type)) {
    console.error(`未知内容类型 "${type}"，可选：${TYPES.join(' | ')}`);
    process.exit(1);
  }
  const status = opts.status ?? 'draft';
  if (!['draft', 'public', 'private'].includes(status)) {
    console.error(`非法 status "${status}"`);
    process.exit(1);
  }

  const files = [];
  const missing = [];
  for (const t of opts._) {
    const abs = path.resolve(t);
    try {
      files.push(...(await collectFiles(abs)));
    } catch {
      missing.push(path.relative(ROOT, abs) || abs);
    }
  }

  const outDir = path.join(CONTENT_DIR, type);
  await mkdir(outDir, { recursive: true });
  const entries = [];
  const startedAt = new Date();

  for (const m of missing) {
    entries.push({ file: m, skipped: true, notes: ['输入路径不存在，已跳过'], losses: [] });
  }

  for (const file of files) {
    const head = (await readFile(file)).subarray(0, 2048).toString('utf8');
    const format = detectFormat(file, head);
    const rel = path.relative(ROOT, file);
    if (!format) {
      entries.push({ file: rel, skipped: true, notes: ['无法识别格式（既非 Markdown/HTML/WXR）'], losses: [] });
      continue;
    }
    try {
      const results =
        format === 'wxr'
          ? await importWxr(file, opts)
          : [await (format === 'html' ? importHtml : importMarkdown)(file, opts)];
      for (const r of results) {
        r.format = format;
        r.file = rel;
        entries.push(r);
      }
    } catch (err) {
      entries.push({
        file: rel,
        skipped: true,
        format,
        notes: [err.skip ? `已跳过：${err.message}` : `导入失败：${err.message}`],
        losses: [],
      });
    }
  }

  // 生成内容文件（跳过项除外）
  const created = [];
  for (const e of entries) {
    if (e.skipped) continue;
    const slugBase = slugify(e.title) || `${type}-item`;
    const { name, full, renamed } = await pickPath(outDir, `${e.date}-${slugBase}`);
    const fm = [
      '---',
      `title: "${yamlEscape(e.title)}"`,
      `date: ${e.date}`,
      `tags: [${e.tags.join(', ')}]`,
      `status: ${status}`,
      `summary: "${yamlEscape(e.summary ?? '')}"`,
      e.sourceLink ? `sourceUrl: "${yamlEscape(e.sourceLink)}"` : null,
      '---',
      '',
      e.body,
      '',
    ].filter((l) => l !== null).join('\n');
    await writeFile(full, fm, 'utf8');
    created.push(name);
    e.created = name;
    e.renamed = renamed;
  }

  // 迁移报告
  const reportLines = [
    `# 导入迁移报告`,
    '',
    `- 运行时间：${startedAt.toISOString()}`,
    `- 目标集合：\`content/${type}/\`，导入状态：\`${status}\``,
    `- 输入：${opts._.join(' ')}（共 ${files.length} 个文件，产出 ${created.length} 篇，跳过 ${entries.filter((e) => e.skipped).length} 篇）`,
    '',
    '## 汇总',
    '',
    '| 源文件 | 标题 | 日期 | 结果 | 损失数 |',
    '| --- | --- | --- | --- | --- |',
    ...entries.map((e) => `| ${e.file} | ${e.title ?? '—'} | ${e.date ?? '—'} | ${e.skipped ? '⚠️ 跳过' : `✅ ${e.created}`}${e.renamed ? `（slug 重名 +${e.renamed}）` : ''} | ${e.losses.length} |`),
    '',
    '## 逐项明细',
    '',
  ];
  for (const e of entries) {
    reportLines.push(`### ${e.file}${e.created ? ` → ${e.created}` : ''}`, '');
    reportLines.push(`- 格式：${e.format ?? '未知'}`);
    for (const n of e.notes) reportLines.push(`- 备注：${n}`);
    for (const l of e.losses) reportLines.push(`- 损失：${l}`);
    reportLines.push('');
  }

  const reportPath = path.resolve(opts.report ?? path.join(ROOT, 'docs', 'migrations', `${startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}-import-report.md`));
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, reportLines.join('\n'), 'utf8');

  console.log(`导入完成：产出 ${created.length} 篇到 content/${type}/，跳过 ${entries.filter((e) => e.skipped).length} 篇`);
  console.log(`迁移报告：${path.relative(ROOT, reportPath)}`);
  for (const c of created) console.log(`  ✓ ${c}`);
}

main().catch((err) => {
  console.error(`失败: ${err.message}`);
  process.exit(1);
});
