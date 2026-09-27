# 架构说明

本文描述流水账 P0（可发布基础站）的技术架构，供后续阶段（P1 写作导入导出、P2 AI 解析归档、P3 主题市场）扩展时对照。

## 总体结构

```
flow-ledger/
  .github/workflows/        # ci.yml（检查）、deploy.yml（Pages 部署）、refresh-github-data.yml（每日数据刷新）
  content/                  # 唯一内容源：notes / archives / projects / posts / pages
  docs/                     # 架构与内容规范
  public/                   # 静态资源：media/、favicon.svg、og-default.png
  scripts/
    fetch-github-data.mjs   # 拉取项目卡片数据 → src/data/github-cache.json
    check-links.mjs         # 构建产物内部链接检查
  src/
    content.config.ts       # 内容集合定义 + Zod schema
    data/github-cache.json  # GitHub 项目数据构建期缓存（提交进仓库）
    layouts/                # BaseLayout（站点骨架）、ArticleLayout（详情页）
    components/             # Header / MobileDrawer / ThemeToggle / FeedCard / ProjectCard / Toc / Footer
    lib/                    # site.ts（URL/格式化）、content.ts（可见性/聚合）
    pages/                  # 路由：四类内容列表+详情、tags、about、404、rss.xml、robots.txt
    styles/global.css       # 设计令牌（CSS 变量）+ Tailwind
```

## 技术选型（对应计划书第 3 节）

| 层级 | 实现 |
| --- | --- |
| 站点生成 | Astro 5 + TypeScript（strict） |
| 内容 | Markdown / MDX + YAML Frontmatter，Astro Content Collections + Zod 校验 |
| 样式 | Tailwind CSS 4 + CSS 变量设计令牌 |
| 搜索 | 预留（Pagefind，P1 接入） |
| 部署 | GitHub Actions → GitHub Pages（项目站点 `/flow-ledger/`） |
| GitHub 数据 | REST API + 构建期缓存（`github-cache.json`，Actions 每日刷新并提交） |

## 关键设计决策

### 1. 内容可见性（安全约束）

`src/lib/content.ts` 的 `isVisible()` 是唯一判定入口：

- `private`：任何构建（包括本地 dev）都不生成页面、不进列表、不进 RSS/sitemap；
- `draft`：生产构建不可见，`astro dev` 可见并带「草稿」徽章；
- `public`：始终可见。

每个 `getStaticPaths` 与列表页都必须经过 `isVisible` 过滤。**不得依赖前端隐藏私密内容**（计划书第 4 节）。

**仓库隐私红线**：`private` 的构建期过滤不是访问控制，公开仓库及其 Git 历史可被读取，敏感内容不得提交到公开仓库。

### 2. 部署 base 与站点地址

GitHub Pages 项目站点部署在 `<owner>.github.io/flow-ledger/` 子路径下：

- `SITE`（默认 `https://example.github.io`）、`BASE_PATH`（默认 `/flow-ledger`）通过环境变量注入，`deploy.yml` 按仓库归属自动计算；
- 所有内部链接经由 `withBase()`（`src/lib/site.ts`）拼接，本地以根路径预览时设 `BASE_PATH=/` 即可。

### 3. 设计令牌与主题边界（为 P3 预留）

`src/styles/global.css` 顶部集中定义颜色/字体/圆角/布局四类 CSS 变量，Tailwind 通过 `@theme inline` 引用。P3 主题市场落地时，一套主题 = 一组令牌覆盖 + 组件 slot 实现；组件与页面不硬编码主题值。

组件命名已对齐 P3 的 slot 约定：Header、Feed（首页时间流）、Card（FeedCard/ProjectCard）、Article（ArticleLayout）、Footer。

### 4. GitHub 项目数据

- `content/projects/*.md` 只写 `repo: owner/name` 等人工描述；
- `scripts/fetch-github-data.mjs` 读出全部 repo 标识，调用 REST API，按当前内容的 repo 白名单重建写入 `src/data/github-cache.json`（失败仓库保留旧值，已移除的仓库不再残留）；
- 构建期 `ProjectCard` 直接 import 该 JSON——构建不依赖网络；
- `refresh-github-data.yml` 每日 UTC 02:23 刷新，数据有变化才提交，并在提交后显式 `workflow_dispatch` 触发 Deploy（GITHUB_TOKEN 的 push 不会自动触发其他工作流），token 仅存在于 Actions 运行时。

## CI/CD

| 工作流 | 触发 | 步骤 |
| --- | --- | --- |
| CI | PR | npm ci → sync+check+build → check-links |
| Deploy | push main / 手动 | npm ci → build（注入 SITE/BASE_PATH）→ check-links → upload → deploy-pages |
| Refresh GitHub data | 每日定时 / 手动 | fetch 数据 → 有变化则提交 → 提交后触发 Deploy |

仓库规范：`main` 始终可发布；功能走 `feat/<name>` 分支 PR 合并；Conventional Commits；Dependabot（npm + actions）周更。

## 后续阶段的接入点

- **P1**：`scripts/` 下加导入器（MD/HTML/WXR → content/）与导出器；`docs/content-guide.md` 提供新建文章模板；Pagefind 在 build 后挂 `pagefind` 索引步骤（选用支持中日韩索引的 extended 构建）。
- **P2**：Cloudflare Worker 独立部署，产出标准 Markdown 落到 `content/archives/`（经 PR 确认），复用 archives schema 的 `sourceUrl/provider/capturedAt/format/originalHash`。
- **P3**：主题以 npm 包或 GitHub 仓库形式提供令牌与 slot 组件，`theme-manifest.json` 登记元数据；安装走 PR + 许可证扫描 + 构建回归。
