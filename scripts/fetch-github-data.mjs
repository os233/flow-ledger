/**
 * 刷新 GitHub 项目卡片数据（《流水账开发计划书》P0）。
 *
 * 读取 content/projects/*.md 中的 `repo: owner/name` 字段，
 * 调用 GitHub REST API 拉取简介 / Stars / Forks / 语言 / 最近更新，
 * 写入 src/data/github-cache.json 供构建期静态引用。
 *
 * - 失败的仓库保留上一次缓存值，构建永不因本脚本失败；
 * - 可选环境变量 GITHUB_TOKEN：仅用于提高匿名限额（Actions 中用 github.token）；
 * - 每日由 .github/workflows/refresh-github-data.yml 定时执行并提交。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS_DIR = path.join(ROOT, 'content', 'projects');
const CACHE_FILE = path.join(ROOT, 'src', 'data', 'github-cache.json');

/** 从 Markdown 原文提取 repo 字段（仅需要一行 YAML，避免引入解析依赖） */
function extractRepos(md) {
  const repos = [];
  const re = /^repo:\s*["']?([\w.-]+\/[\w.-]+)["']?\s*$/gm;
  let m;
  while ((m = re.exec(md)) !== null) repos.push(m[1]);
  return repos;
}

async function collectRepos() {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith('.md'));
  const repos = new Set();
  for (const file of files) {
    const md = await readFile(path.join(PROJECTS_DIR, file), 'utf8');
    for (const repo of extractRepos(md)) repos.add(repo);
  }
  return [...repos];
}

async function fetchRepo(repo, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'flow-ledger-site',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    description: data.description ?? undefined,
    stars: data.stargazers_count,
    forks: data.forks_count,
    language: data.language ?? undefined,
    pushedAt: data.pushed_at,
    htmlUrl: data.html_url,
  };
}

async function main() {
  const token = process.env.GITHUB_TOKEN || '';
  const repos = await collectRepos();

  let previous = { fetchedAt: '', repos: {} };
  if (existsSync(CACHE_FILE)) {
    try {
      previous = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
    } catch {
      // 缓存损坏则从空开始重建
    }
  }

  // 以本轮 repos 为白名单重建：失败的仓库保留旧缓存，已从内容中移除的仓库不再残留
  const next = {};
  const results = [];
  for (const repo of repos) {
    try {
      next[repo] = await fetchRepo(repo, token);
      results.push(`  ✓ ${repo}`);
    } catch (err) {
      const kept = previous.repos?.[repo];
      if (kept) next[repo] = kept;
      results.push(`  ✗ ${repo}（${err.message}，${kept ? '保留旧缓存' : '无缓存可用'}）`);
    }
  }

  // 数据无变化时不写文件：fetchedAt 保留上次值，也让 refresh 工作流的
  // git diff 检查真正生效，避免每天产生空转提交
  if (JSON.stringify(next) === JSON.stringify(previous.repos ?? {})) {
    console.log(`[fetch-github-data] ${repos.length} 个仓库，数据与上次缓存一致，不更新文件`);
    for (const line of results) console.log(line);
    return;
  }

  const cache = {
    fetchedAt: new Date().toISOString(),
    repos: next,
  };
  await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');

  console.log(`[fetch-github-data] ${repos.length} 个仓库，写入 ${path.relative(ROOT, CACHE_FILE)}`);
  for (const line of results) console.log(line);
}

main().catch((err) => {
  // 构建链路不允许因数据刷新失败而中断
  console.error(`[fetch-github-data] 失败（不影响构建）: ${err.message}`);
});
