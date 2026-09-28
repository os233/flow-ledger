# Flow Ledger 项目说明

## 项目背景

Flow Ledger（流水账）是一个“先记下、再整理、可长期保存”的个人数字花园。灵感速记、AI 对话分享归档、GitHub 项目动态和正式博客共用一套可读、可版本管理的 Markdown 内容资产，构建为静态网站并发布到 GitHub Pages。

项目优先保证内容可迁移、构建轻量、移动端可读。网站仓库是内容源；GitHub Pages 适合发布公开静态页面，不用于保管服务密钥或提供安全的私密内容托管。

## 当前阶段

当前代码基线为计划中的 **P0：可发布基础站**。P1 写作导入导出、P2 AI 分享解析与归档、P3 主题市场是后续阶段规划，不能视为已上线能力。推进阶段变化以开发计划书及用户确认的任务为准。

## 技术架构

- **生成与路由：** Astro 5 + TypeScript，输出静态页面。
- **内容：** Markdown/MDX、YAML Frontmatter、Astro Content Collections 与 Zod schema。
- **样式：** Tailwind CSS 4，通过 `@tailwindcss/vite` 接入；CSS 设计令牌集中在 `src/styles/`。
- **内容呈现：** Shiki 代码高亮、RSS 与 sitemap。
- **项目数据：** GitHub REST API 数据由脚本刷新为构建期 JSON 缓存，页面构建不依赖实时网络请求。
- **部署：** GitHub Actions 构建并部署至 GitHub Pages；项目站点基础路径为 `/flow-ledger/`。

## 内容与模块

### 内容目录

`content/` 是唯一内容源，包含：

| 目录 | 职责 |
| --- | --- |
| `content/notes/` | 灵感速记 |
| `content/archives/` | AI 分享对话归档及来源信息 |
| `content/projects/` | 项目说明及 GitHub 仓库标识 |
| `content/posts/` | 正式博客文章 |
| `content/pages/` | 关于等独立页面 |

常用通用字段为 `title`、`date`、`updated`、`tags`、`status`、`summary`。归档、项目和页面有各自的附加字段与约束，新增内容时查阅 [内容写作规范](docs/content-guide.md)，不要只依赖本概览。

`status` 有三种值：`public` 可发布；`draft` 在生产构建中不显示、本地开发可预览；`private` 在任何构建中都不得生成页面，也不得进入列表、RSS 或 sitemap。私密信息不能靠浏览器端隐藏保护。

### 代码目录

具体文件以仓库现状和 [架构说明](docs/architecture.md) 为准，主要边界如下：

- `.github/workflows/`：CI、Pages 部署、GitHub 项目数据定时刷新。
- `src/content.config.ts`：内容集合和 Zod schema。
- `src/lib/`：站点 URL、格式化、内容可见性与聚合逻辑。
- `src/components/`、`src/layouts/`：共享界面组件与页面布局。
- `src/pages/`：内容列表、详情页、标签、静态页面、RSS 等路由。
- `src/styles/`：全局样式及设计令牌。
- `scripts/`：内容新建/手工归档/导入/导出、GitHub 数据刷新、链接与可见性检查、搜索索引。
- `public/`：静态资源；文章图片与附件放在 `public/media/`。
- `docs/`：架构、内容字段及写作约定。

## 开发规范

- 开发任务先读仓库外开发计划书，并核对 README、架构说明、内容指南和相关源码；计划书与实现冲突时先向用户确认。
- 保持 `main` 可发布；功能在 `feat/<name>` 分支开发，经 PR 合并。提交使用 Conventional Commits，例如 `feat:`、`fix:`、`docs:`、`chore:`。
- `content/` 是唯一内容源。字段必须符合 schema 与内容指南；文件名通常采用 `YYYY-MM-DD-slug.md`。
- `private` 内容不能进入任何线上产物。新增列表、详情、RSS、sitemap 路由时都要遵守统一可见性逻辑。
- 内部链接通过项目的 `withBase()` 等既有工具生成，确保 GitHub Pages 子路径正确；样式沿用 CSS 设计令牌。
- GitHub 数据在构建期使用仓库缓存；不要增加会令构建依赖实时 API 的逻辑，也不要将凭据写入仓库。
- 不把规划阶段功能描述成现有功能。新增依赖、服务或数据字段应有明确需求依据，并更新相关文档。
- 代码采用 MIT；内容的许可和署名遵循 README/内容来源要求；第三方资产保留其许可和署名。

## 安装、运行与构建

要求 Node.js ≥ 18.17（CI 与部署当前使用 Node 20）。

```bash
npm install
npm run dev
```

开发服务器默认在 `http://localhost:4321`。常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run check` | Astro 同步并执行类型检查 |
| `npm run build` | 检查并构建静态产物到 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run fetch:github` | 刷新 GitHub 项目卡片缓存数据 |

部署需要将仓库 Pages 来源设置为 GitHub Actions。推送或合并至 `main` 后，工作流负责检查、构建和发布；部署地址及 `/flow-ledger/` 基础路径配置见 README 与架构说明。

## 相关文档

- [README](README.md)：快速开始、部署与许可。
- [架构说明](docs/architecture.md)：模块细节、可见性、数据缓存与 CI/CD 决策。
- [内容写作规范](docs/content-guide.md)：字段、示例、文件命名与附件。
- [AGENTS.md](AGENTS.md)：AI 代理职责、协作、任务流程与行为规范。
