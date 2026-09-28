# P2 阶段启动门槛：AI 分享解析与归档（首批：手工归档流）

依据《流水账开发计划书》（2026-09-26 复核版）第 9 节「阶段启动门槛」编写。P0 于 2026-09-26、P1 于 2026-09-27 验收闭环（见 [p0-acceptance.md](p0-acceptance.md)、[p1-acceptance.md](p1-acceptance.md)）。

P2 完整范围（Worker 在线解析、逐平台适配器、LLM 增强）按计划书 §5 执行；本文件只覆盖**首批**，并在「非目标」记录裁剪决策与 Worker 批次的启动条件。

## 用户场景

1. **手工归档**：我把 AI 对话内容（分享页复制出的 Markdown，或保存的分享页 HTML）存成文件，一条命令生成 `content/archives/` 归档草稿，本地预览确认后发布。
2. **来源可追溯**：每篇归档带 `sourceUrl`、`provider`、`capturedAt`、`format`、`originalHash`（原文指纹）；HTML 输入可保留原始快照，转换损失在控制台逐条提示。
3. **敏感信息把关**：入库前本机正则扫描疑似邮箱、API key、手机号、私钥块等，逐条提示人工处理——归档对话最容易夹带凭据，不能靠肉眼兜底。

## 非目标（首批裁剪）

- **不部署 Cloudflare Worker、不做 ChatGPT/Claude/Gemini 分享链接的自动解析适配器**。裁剪依据：计划书 §2「不因『可扩展』而提前引入服务」，分享页内容手工复制即可稳定获得，在线解析在首批没有成本合理的使用场景；
- **不接 LLM API**（标题/摘要/标签由人工维护、敏感信息提示由本机正则承担）。LLM 接入随 Worker 批次决策，届时按计划书 §5 P2 要求先写明数据发送内容、提供方、费用上限、保留期与同意方式；
- 不做浏览器端抓取、不读取登录态、不绕过任何平台限制——只处理用户手工保存到本地的文件；
- **Worker 批次启动条件**：开通 Cloudflare 账号并获得部署授权 + 有真实的分享链接解析需求；启动时另立批次计划并复检本文件隐私条款。

## 依赖与前置条件

- P0 的内容模型、archives Zod schema（`sourceUrl` 必填、`provider` 必填）与可见性规则——均已就绪；
- P1 的工具链复用：`scripts/lib/content-io.mjs`（参数/编码/日期/slug）、turndown（HTML→MD，P1 已引入）；
- **零新增依赖**：不新增 npm 包、服务端组件或外部服务；全程本地运行。

## 数据 / 权限流

- 输入：用户手工保存到本地的 Markdown/HTML 文件；
- 输出：`content/archives/YYYY-MM-DD-slug.md`；`--snapshot` 时将原始 HTML 存为同目录 `YYYY-MM-DD-slug.original.html`；
- 全程本地内存处理，无网络请求、无密钥；不触碰工作流、构建配置与外部服务。

## 隐私影响

- 红线不变：归档一律默认 `status: draft`，绝不自动公开；改 `public` 前必须人工检查正文与提示清单（计划书 §5 P2「提交前须由用户确认」同源原则）；
- **快照不进 `public/media/`**：静态托管下未引用文件仍可被直接 URL 访问，草稿期的原始快照只存 `content/archives/`（构建产物不包含，仅入 Git 长期保存）；
- 敏感信息扫描只在本机内存中进行，结果仅打印到终端，不写入文件、不外发；
- 可见性回归由既有 `scripts/check-visibility.mjs` 兜底：draft/private 不进任何产物、列表、RSS、sitemap 与 Pagefind 索引。

## 责任人与成本

- 责任人：os233（内容与验收）+ AI 协作（实现）；
- 成本上限：零固定成本——无新服务，GitHub Actions/Pages 免费额度内。

## 批次计划

| 批次 | 内容 | 验收锚点 |
| --- | --- | --- |
| B1 ✅（2026-09-28） | 首批门槛文档（本文） | 裁剪决策与启动条件已记录 |
| B2 | `npm run archive` 手工归档脚本：MD/HTML 输入识别、完整 archives frontmatter、HTML→MD、敏感信息扫描、可选原始快照 | Markdown 与 HTML 两个样例走通，生成文件通过构建期 schema 校验，扫描告警命中 |
| B3 | 文档同步：content-guide 归档流程、architecture 阶段状态、README 命令表 | 文档与实现一致，不把规划写成已实现 |
| B4 | 首批验收：可见性回归 + 验收记录 | draft 归档不出现在 dist/RSS/sitemap；记录见 [p2-acceptance.md](p2-acceptance.md) |

## 完成定义（DoD）

每个批次：`npm run build`（含类型检查）+ `check:links` + `check:visibility` 全绿、Conventional Commits 提交、文档同步更新。首批验收对照本文件验收锚点在 B4 执行并记录到 `docs/p2-acceptance.md`。
