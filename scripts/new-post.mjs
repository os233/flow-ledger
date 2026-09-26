/**
 * 新建文章脚本（计划书 P1：本地编辑体验）。
 *
 * 用法：
 *   npm run new -- <type> "<标题>" [选项]
 *
 *   类型：notes | archives | projects | posts | pages
 *   选项：
 *     --slug    <slug>    URL 片段（默认取标题中的 ASCII 词，纯中文标题建议手动给）
 *     --tags    a,b,c     标签（逗号分隔）
 *     --status  <status>  draft（默认）| public | private
 *     --summary "<摘要>"  摘要
 *     --date    YYYY-MM-DD  覆盖默认的今天
 *
 * 示例：
 *   npm run new -- posts "我的新文章" --slug my-post --tags 随笔,思考
 *   npm run new -- notes "一个想法"
 *   npm run new -- archives "与 Claude 讨论 X" --slug claude-x --provider claude
 *
 * 生成的 Frontmatter 默认 status: draft——私密安全默认，确认后再改 public。
 */
import { writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  notes: { dir: 'content/notes', extra: [] },
  archives: { dir: 'content/archives', extra: ['sourceUrl', 'provider', 'capturedAt', 'format'] },
  projects: { dir: 'content/projects', extra: ['repo', 'homepage', 'featured'] },
  posts: { dir: 'content/posts', extra: [] },
  pages: { dir: 'content/pages', extra: [] },
};

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        opts[key] = true; // 无值开关
      } else {
        opts[key] = next;
        i++;
      }
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

function yamlEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function deriveSlug(title) {
  const ascii = title
    .toLowerCase()
    .replace(/['’]/g, '')
    .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g);
  const slug = (ascii ?? []).join('-').slice(0, 60).replace(/^-+|-+$/g, '');
  return slug || '';
}

async function pickPath(dir, base) {
  for (let n = 1; n < 100; n++) {
    const name = n === 1 ? `${base}.md` : `${base}-${n}.md`;
    const full = path.join(ROOT, dir, name);
    try {
      await access(full);
    } catch {
      return { full, name };
    }
  }
  throw new Error(`无法为 ${base} 找到可用文件名`);
}

function frontmatter(type, o) {
  const q = (v) => `"${yamlEscape(v)}"`;
  const lines = [
    '---',
    `title: ${q(o.title)}`,
    `date: ${o.date}`,
  ];
  if (type === 'pages') {
    lines.push(`updated: ${o.date}`);
  } else {
    // lines.push(`updated: ${o.date}`); // 有修改时取消注释
    lines.push(`tags: [${o.tags.join(', ')}]`);
    lines.push(`status: ${o.status}`);
    lines.push(`summary: ${q(o.summary ?? '')}`);
  }
  if (type === 'archives') {
    lines.push(
      `sourceUrl: ${q(o.sourceUrl ?? 'https://example.com/share/xxx')}`,
      `provider: ${o.provider ?? 'chatgpt'}`,
      `capturedAt: ${o.date}`,
      `format: markdown`,
      // `originalHash: sha256:...`, // 可选：原文指纹
    );
  }
  if (type === 'projects') {
    lines.push(
      `repo: ${o.repo ?? 'owner/name'}`,
      // `homepage: https://...`, // 可选
      `featured: false`,
    );
  }
  lines.push('---', '');
  return lines.join('\n');
}

const BODY_HINTS = {
  notes: '想法本身，一两段即可。\n',
  posts: '## 背景\n\n正文……\n',
  archives: '> 归档说明：以下内容抓取自分享链接，转换损失见迁移报告。\n\n## 提问\n\n\n## 结论摘要\n\n',
  projects: '项目说明。卡片上的简介优先取 summary 字段。\n',
  pages: '页面内容。\n',
};

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [type, title] = opts._;

  if (opts.help || opts.h || !type || !title) {
    console.error('用法: npm run new -- <notes|archives|projects|posts|pages> "<标题>" [--slug s] [--tags a,b] [--status draft|public|private] [--summary "..."]');
    process.exit(1);
  }
  if (!TYPES[type]) {
    console.error(`未知类型 "${type}"，可选：${Object.keys(TYPES).join(' | ')}`);
    process.exit(1);
  }
  const status = opts.status ?? 'draft';
  if (!['draft', 'public', 'private'].includes(status)) {
    console.error(`非法 status "${status}"，可选：draft | public | private`);
    process.exit(1);
  }

  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`非法日期 "${date}"，需要 YYYY-MM-DD`);
    process.exit(1);
  }

  const slug = opts.slug ?? deriveSlug(title) ?? '';
  if (opts.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(`非法 slug "${slug}"（小写字母/数字/连字符）`);
    process.exit(1);
  }
  const base = `${date}-${slug || type}`;
  const tags = (opts.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const { dir } = TYPES[type];
  await mkdir(path.join(ROOT, dir), { recursive: true });
  const { full, name } = await pickPath(dir, base);

  const content =
    frontmatter(type, {
      title,
      date,
      status,
      summary: opts.summary,
      tags,
      sourceUrl: opts.sourceUrl,
      provider: opts.provider,
      repo: opts.repo,
    }) + (BODY_HINTS[type] ?? '');

  await writeFile(full, content, 'utf8');

  console.log(`已创建 ${path.relative(ROOT, full)}`);
  console.log(`  类型: ${type} | 状态: ${status}（确认后改为 public）| URL 将为 /${type}/${name.replace(/\.md$/, '')}/`);
  if (!opts.slug && !deriveSlug(title)) {
    console.log('  提示: 标题无 ASCII 词，slug 使用了类型名兜底，建议用 --slug 指定更友好的 URL。');
  }
  console.log('  下一步: 编辑内容 → npm run dev 预览 → 提交推送（合并 main 自动发布）');
}

main().catch((err) => {
  console.error(`失败: ${err.message}`);
  process.exit(1);
});
