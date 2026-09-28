/**
 * 手工归档脚本（计划书 P2 首批，见 docs/p2-charter.md）。
 *
 * 用法：
 *   npm run archive -- <文件> [选项]
 *
 * 输入：AI 分享页手工复制保存的 Markdown 或 HTML 文件（自动识别格式，HTML 自动转 Markdown）。
 *
 * 选项：
 *   --source-url  <url>       分享链接；缺省写入占位符，修正后再公开
 *   --provider    <name>      来源标识；缺省按 sourceUrl 域名推断，仍无法确定用 unknown
 *   --title       "<标题>"    缺省从内容提取（MD 首个标题 / HTML <title>/<h1>）
 *   --slug        <slug>      URL 片段（默认取标题中的 ASCII 词）
 *   --tags        a,b,c       标签（逗号分隔）
 *   --summary     "<摘要>"    摘要（不自动生成，人工维护）
 *   --date        YYYY-MM-DD  归档日期（默认今天）
 *   --captured-at YYYY-MM-DD  抓取日期（默认今天）
 *   --status      draft（默认）| private | public
 *   --snapshot                HTML 输入时保存原始页面快照到 content/archives/
 *
 * 行为约定（docs/p2-charter.md 隐私影响节）：
 *   - 一律默认 status: draft，绝不自动公开；
 *   - originalHash 记录原文 SHA-256 指纹，快照只存 content/archives/（构建产物不含，避免草稿期被静态托管直接访问）；
 *   - 敏感信息扫描（邮箱/API key/手机号/私钥块/JWT 等）只在本机内存运行，结果仅打屏、不落盘。
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDecoded, splitFrontmatter, parseSimpleFrontmatter, yamlEscape, slugify, parseTags, normalizeDate, localDate, parseArgs } from './lib/content-io.mjs';
import { createTurndown } from './lib/html-to-md.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE_DIR = path.join(ROOT, 'content', 'archives');

/** 常见 AI 平台分享域名 → provider。只做确定性映射，未命中交人工维护 */
const PROVIDER_HOSTS = [
  [/chatgpt\.com|openai\.com/, 'chatgpt'],
  [/claude\.ai|anthropic\.com/, 'claude'],
  [/gemini\.google\.com|bard\.google\.com/, 'gemini'],
  [/chat\.deepseek\.com/, 'deepseek'],
  [/kimi\.moonshot\.cn|kimi\.com/, 'kimi'],
  [/doubao\.com/, 'doubao'],
  [/yuanbao\.tencent\.com/, 'yuanbao'],
  [/chatglm\.cn|bigmodel\.cn|chat\.z\.ai/, 'glm'],
];

function inferProvider(url) {
  try {
    const host = new URL(url).hostname;
    return PROVIDER_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

function detectFormat(file, head) {
  if (/\.(md|markdown)$/i.test(file)) return 'markdown';
  if (/\.(html?|htm)$/i.test(file)) return 'html';
  // 无扩展名/.txt 兜底：按内容识别
  if (head.includes('<!doctype html') || head.includes('<html')) return 'html';
  return 'markdown';
}

function htmlTitle(html) {
  // 分享页 <title> 常带「- 平台名」后缀，优先取正文 h1
  const raw =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    '';
  return raw.replace(/<[^>]+>/g, '').trim();
}

function mdTitle(body) {
  const heading = body.match(/^#{1,6}\s+(.+)$/m)?.[1];
  const firstLine = body.split(/\r?\n/).find((l) => l.trim());
  return (heading ?? firstLine ?? '').replace(/^[#>*\s]+/, '').trim();
}

/** 抽取 body 并剥离 script/style（与 import.mjs 同策略），再转 Markdown */
function htmlToMarkdown(html) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const cleaned = body.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  return createTurndown().turndown(cleaned).replace(/\n{3,}/g, '\n\n').trim();
}

function maskSample(s) {
  const t = s.trim();
  return t.length <= 8 ? '****' : `${t.slice(0, 4)}****${t.slice(-4)}`;
}

/** 高置信敏感信息规则：宁可提示后由人工排除，不追求零误报 */
const SCAN_RULES = [
  { type: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: 'API key（OpenAI sk-）', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { type: 'API key（GitHub）', re: /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{20,}\b|github_pat_[A-Za-z0-9_]{20,}/g },
  { type: 'API key（AWS）', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'API key（Google）', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: 'API key（Slack）', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: '私钥块', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { type: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { type: '手机号', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  { type: '疑似密码/令牌赋值', re: /(?:密码|password|passwd|pwd|secret|api[_-]?key|token)\s*[:=＝]\s*\S+/gi },
];

/** 只扫将发布的正文，逐行定位；命中上限防刷屏 */
function scanSensitive(text, limit = 30) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (hits.length >= limit) return;
    for (const { type, re } of SCAN_RULES) {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) {
        hits.push({ line: i + 1, type, sample: maskSample(m[0]) });
        if (hits.length >= limit) break;
      }
    }
  });
  return hits;
}

async function fileExists(p) {
  return stat(p).then(() => true).catch(() => false);
}

/** 同名自动加 -2/-3 后缀，不覆盖已有归档 */
async function pickPath(dir, base, ext) {
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${base}${ext}` : `${base}-${n}${ext}`;
    const full = path.join(dir, name);
    if (!(await fileExists(full))) return { name, full };
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts._.length || opts._[0] === true) {
    console.error('用法: npm run archive -- <Markdown/HTML 文件> [--source-url <url>] [--provider claude] [--title "标题"] [--tags a,b] [--snapshot]');
    process.exit(1);
  }
  const input = path.resolve(opts._[0]);
  let buf;
  try {
    buf = await readFile(input);
  } catch {
    console.error(`失败: 无法读取输入文件 ${input}`);
    process.exit(1);
  }
  const { text, encoding } = await readDecoded(input);
  const notes = [`源编码: ${encoding}`];

  const format = detectFormat(input, text.slice(0, 2048).toLowerCase());
  let bodyMd;
  let fmTitle;
  let fmTags = [];
  let fmSummary = '';
  if (format === 'html') {
    bodyMd = htmlToMarkdown(text);
    fmTitle = htmlTitle(text);
    notes.push('HTML 输入已转 Markdown；快照可用 --snapshot 保存');
  } else {
    const split = splitFrontmatter(text);
    if (split.frontmatter !== null) {
      const parsed = parseSimpleFrontmatter(split.frontmatter);
      if (parsed.broken) {
        notes.push('输入自带 frontmatter 结构异常，已整体按正文处理');
        bodyMd = text.trim();
      } else {
        bodyMd = split.body.trim();
        fmTitle = parsed.data.title;
        fmTags = parseTags(parsed.data.tags);
        fmSummary = parsed.data.summary ?? '';
      }
    } else {
      bodyMd = text.trim();
    }
  }
  if (!bodyMd) {
    console.error('失败: 转换后正文为空，请检查输入文件内容');
    process.exit(1);
  }

  // 来源：sourceUrl 是 schema 必填项
  let sourceUrl = typeof opts['source-url'] === 'string' ? opts['source-url'] : '';
  let provider = typeof opts.provider === 'string' ? opts.provider : '';
  if (sourceUrl) {
    if (!/^https?:\/\//i.test(sourceUrl)) {
      console.error(`失败: --source-url 必须是完整 URL（含 http(s)://），收到 "${sourceUrl}"`);
      process.exit(1);
    }
  } else {
    sourceUrl = 'https://example.com/share/xxx';
    notes.push('sourceUrl 已用占位符，修正后再公开');
  }
  if (!provider) provider = inferProvider(sourceUrl) ?? '';
  if (!provider) {
    provider = 'unknown';
    notes.push('provider 未能确定，发布前请改为实际来源');
  }

  const title = (typeof opts.title === 'string' && opts.title) || fmTitle || mdTitle(bodyMd) || path.basename(input).replace(/\.[^.]+$/, '');
  const status = opts.status ?? 'draft';
  if (!['draft', 'private', 'public'].includes(status)) {
    console.error(`非法 status "${status}"，可选 draft | private | public`);
    process.exit(1);
  }
  const tzNote = [];
  // parseArgs 对「开关漏值」会给出布尔 true，必须挡在 new Date() 之外，否则得到 1970-01-01
  const date = normalizeDate(typeof opts.date === 'string' ? opts.date : undefined, tzNote, '--date');
  const capturedAt = normalizeDate(typeof opts['captured-at'] === 'string' ? opts['captured-at'] : undefined, tzNote, '--captured-at');
  notes.push(...tzNote);
  const tags = typeof opts.tags === 'string' ? parseTags(opts.tags) : fmTags;
  const summary = (typeof opts.summary === 'string' ? opts.summary : '') || fmSummary;
  const originalHash = `sha256:${createHash('sha256').update(buf).digest('hex')}`;

  const slugBase = (typeof opts.slug === 'string' && opts.slug) || slugify(title) || 'archive';
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const { name, full } = await pickPath(ARCHIVE_DIR, `${date}-${slugBase}`, '.md');

  const fm = [
    '---',
    `title: "${yamlEscape(title)}"`,
    `date: ${date}`,
    `tags: [${tags.map((t) => `"${yamlEscape(t)}"`).join(', ')}]`,
    `status: ${status}`,
    `summary: "${yamlEscape(summary)}"`,
    `sourceUrl: "${yamlEscape(sourceUrl)}"`,
    `provider: "${yamlEscape(provider)}"`,
    `capturedAt: ${capturedAt}`,
    'format: markdown',
    `originalHash: ${originalHash}`,
    '---',
    '',
    bodyMd,
    '',
  ].join('\n');
  await writeFile(full, fm, 'utf8');

  // 快照：只存 content/archives/，构建产物不包含（docs/p2-charter.md 隐私影响节）
  if (opts.snapshot) {
    if (format === 'html') {
      const snap = await pickPath(ARCHIVE_DIR, `${date}-${slugBase}`, '.original.html');
      await writeFile(snap.full, text, 'utf8');
      notes.push(`原始快照: content/archives/${snap.name}`);
    } else {
      notes.push('--snapshot 仅对 HTML 输入有意义：Markdown 正文即原文');
    }
  }

  const hits = scanSensitive(bodyMd);

  console.log(`✓ 已创建 content/archives/${name}`);
  console.log(`  title: ${title}`);
  console.log(`  provider: ${provider} | sourceUrl: ${sourceUrl}`);
  console.log(`  date: ${date} | capturedAt: ${capturedAt} | originalHash: ${originalHash.slice(0, 19)}…`);
  for (const n of notes) console.log(`  备注: ${n}`);
  if (hits.length) {
    console.log(`⚠ 敏感信息扫描：${hits.length} 处待人工确认（仅提示，不阻塞）`);
    for (const h of hits) console.log(`   - 第 ${h.line} 行 [${h.type}] ${h.sample}`);
  } else {
    console.log('✓ 敏感信息扫描：未命中已知模式（仍请人工通读）');
  }
  if (status === 'public') {
    console.log('⚠ status 为 public：合并到 main 后立即公开，请先完成上方核对');
  }
  console.log('后续: npm run dev 预览草稿 → 核对扫描清单与 sourceUrl/provider → 确认后把 status 改为 public');
}

main().catch((err) => {
  console.error(`失败: ${err.message}`);
  process.exit(1);
});
