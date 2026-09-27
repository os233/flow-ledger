/**
 * 导入/导出脚本共享工具（P1-B2/B3）。
 * 仅覆盖内容 frontmatter 的受控子集——完整校验仍由 Astro Content Collections + Zod 在构建期执行。
 */
import { readFile } from 'node:fs/promises';
import iconv from 'iconv-lite';

/** 读文件并检测编码：UTF-8 BOM / 声明的 charset（支持 GBK/GB18030）/ 默认 UTF-8 */
export async function readDecoded(file) {
  const buf = await readFile(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: iconv.decode(buf.subarray(3), 'utf8'), encoding: 'utf-8 (BOM)' };
  }
  const head = buf.subarray(0, 4096).toString('latin1');
  const meta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i);
  const declared = meta?.[1]?.toLowerCase();
  if (declared && declared !== 'utf-8' && declared !== 'utf8' && iconv.encodingExists(declared)) {
    return { text: iconv.decode(buf, declared), encoding: declared };
  }
  const utf8 = buf.toString('utf8');
  if (Buffer.compare(Buffer.from(utf8, 'utf8'), buf) === 0) {
    return { text: utf8, encoding: 'utf-8' };
  }
  return { text: iconv.decode(buf, 'gb18030'), encoding: 'gb18030 (未声明，按 GB 兜底)' };
}

export function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: text, broken: false };
  return { frontmatter: m[1], body: m[2], broken: false };
}

/** 极简 YAML frontmatter 读取：仅取顶层简单值，缩进/嵌套视为损坏 */
export function parseSimpleFrontmatter(fm) {
  const data = {};
  let broken = false;
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) {
      if (line.trim() && !line.startsWith('#')) broken = true;
      continue;
    }
    data[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return { data, broken };
}

export function yamlEscape(v) {
  return (
    String(v)
      // 换行折叠为空格：双引号标量内的换行会改变 YAML 语义，且逐行解析器会把续行判为损坏
      .replace(/\r?\n/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
  );
}

/** 本地时区日期，YYYY-MM-DD（toISOString 是 UTC，东八区凌晨会得到「昨天」） */
export function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 命令行参数解析：--key value、--key=value、无值开关均可；
 * 位置参数收集到 opts._。import/export/new-post 共用。
 */
export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 2) {
        opts[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
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

export function slugify(text) {
  const ascii = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g);
  return (ascii ?? []).join('-').slice(0, 60).replace(/^-+|-+$/g, '');
}

/** frontmatter 数组字段：[a, b] 或 a, b 均可 */
export function parseTags(raw) {
  return (raw ?? '')
    .replace(/[[\]]/g, '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 带时区的时间归一为 UTC 日期（YYYY-MM-DD），变化写入 tzNote */
export function normalizeDate(input, tzNote = [], source = '') {
  if (!input) {
    tzNote.push(`未提供日期${source ? `（${source}）` : ''}，已用今天代替`);
    return localDate();
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    tzNote.push(`无法解析日期 "${input}"${source ? `（${source}）` : ''}，已用今天代替`);
    return localDate();
  }
  if (/[T-Z+]/i.test(String(input).trim())) {
    tzNote.push(`日期含时区（${input} → UTC ${d.toISOString()}），记录 UTC 日期`);
  }
  return d.toISOString().slice(0, 10);
}
