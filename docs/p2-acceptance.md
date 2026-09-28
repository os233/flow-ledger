# P2 首批验收记录（手工归档流）

对照 [p2-charter.md](p2-charter.md) 批次计划。P2 首批于 2026-09-28 完成全部批次。Cloudflare Worker 在线解析、平台适配器与 LLM 增强按启动门槛裁剪，仍为规划（见 charter「非目标」）。

## 验收结论

**通过。** B1–B4 全部完成并验证；手工归档流从粘贴文件到草稿落盘、敏感信息提示、可见性回归均有机器化证据。

## 批次完成度

| 批次 | 状态 | 证据 |
| --- | --- | --- |
| B1 门槛文档 | ✅ | [p2-charter.md](p2-charter.md)：裁剪决策、Worker 启动条件、隐私条款齐备 |
| B2 归档脚本 | ✅ | `npm run archive`；版本化样例集 `scripts/archive-fixtures/`（Markdown + HTML）实测走通 |
| B3 文档同步 | ✅ | content-guide「AI 对话手工归档」、architecture 脚本清单与阶段接入点、README 命令表、programs.md |
| B4 可见性回归 | ✅ | 草稿归档零进产物（见下），机器检查全绿 |

## 验收证据

### 脚本行为（B2）

- **Markdown 样例**（`sample-chat.md`，经 `--source-url https://claude.ai/share/abc123`）：
  - 标题自动提取（首个 `#` 标题）；`provider: claude` 由 sourceUrl 域名推断；
  - Frontmatter 完整且通过构建期 Zod 校验：`sourceUrl`、`capturedAt`、`format: markdown`、`originalHash`（原文 SHA-256）；
  - 敏感信息扫描命中 3 处并逐条输出（第 7 行邮箱、第 7 行手机号、第 9 行 `sk-` 形态 key），样例值掩码显示、不阻塞。
- **HTML 样例**（`sample-share.html`，`--snapshot`）：
  - 标题优先取正文 h1（避开分享页 `<title>` 的「- 平台名」后缀）；turndown 转 Markdown，代码块保留 fenced 形态；
  - `<iframe>` 转换后留「迁移损失」占位注释，可追溯；
  - 原始快照写入 `content/archives/2026-09-28-archive-fields.original.html`（构建产物不包含，仅入 Git）；
  - 未提供 sourceUrl 时按约定写占位符并提示「修正后再公开」；provider 无法推断时记 `unknown` 并提示。
- 输出文件名冲突自动加 `-2` 后缀，不覆盖既有归档。

### 可见性回归（B4）

测试归档（draft，slug `archive-fields`，含 `.original.html` 快照）在场时执行：

- `npm run build` 通过（类型检查 + 构建 + Pagefind 索引：30 页，索引数与 dist 页面数一致）；
- `grep -r archive-fields dist/` → **0 命中**；`dist/rss.xml`、`dist/sitemap-*.xml` → 0 命中；
- `npm run check:visibility` → 77 个文本产物通过（含 Pagefind 索引碎片解压扫描），公开对照存在；
- `npm run check:links` → 30 页面、33 个站内链接全部有效；
- `npm run check` → 41 文件 0 错误 0 警告。

验证完成后测试归档已从 `content/archives/` 移除；样例保留在 `scripts/archive-fixtures/`，可随时复跑。

## 裁剪与遗留

1. **Worker 在线解析、平台适配器、LLM 增强**：按 charter 非目标裁剪；启动条件（Cloudflare 账号 + 部署授权 + 真实解析需求）满足后另立批次计划。
2. **敏感信息扫描为高置信正则**：存在误报/漏报可能，公开前人工通读正文仍是必须步骤（脚本输出末尾固定提示）。
3. **P1 存量缺口（实测确认）**：`npm run import -- <md> --type archives` 生成的 Frontmatter 缺 schema 必填的 `provider`（`capturedAt`/`format` 靠缺省值通过，`provider` 无缺省），该路径的文件在构建期会报错；且无 frontmatter 时标题回退为文件名而非首个标题。属导入器归档路径的存量问题，与手工归档流无关，建议后续批次修复 import.mjs 后补跑 P1 七类样例回归。
