# 内容写作规范

所有内容都是 `content/` 下的 Markdown 文件，Frontmatter 由 Zod 在构建期校验，字段写错会在 `npm run build` 时直接报错。

## 目录与类型

| 目录 | 用途 | 额外字段 |
| --- | --- | --- |
| `content/notes/` | 灵感速记（短内容） | — |
| `content/archives/` | AI 对话分享归档 | `sourceUrl`、`provider`、`capturedAt`、`format`、`originalHash` |
| `content/projects/` | GitHub 项目 | `repo`（`owner/name`）、`homepage`、`featured` |
| `content/posts/` | 正式博客（.md / .mdx） | — |
| `content/pages/` | 关于等单页 | 仅 `title`、`updated`、`summary` |

## 通用字段

```yaml
---
title: 必填，文章标题
date: 必填，YYYY-MM-DD 或完整时间戳
updated: 可选，最后修改日期
tags: 可选，字符串数组，如 [灵感, 元想法]
status: draft | private | public（默认 draft）
summary: 可选，摘要，用于列表卡片与 SEO 描述
---
```

### status 的含义（重要）

- `public`：公开发布，进入站点、RSS、站点地图；
- `draft`：写作中。生产构建不可见，本地 `npm run dev` 可见并带「草稿」徽章；
- `private`：私密内容。**任何构建都不包含**（无页面、无列表、无 RSS），只保存在仓库中。不要依赖前端隐藏私密内容。

> **隐私红线（计划书第 4 节）**：`private` 的构建期过滤**不是访问控制**。
>
> - 公开 Git 仓库及其**全部历史**中的文件对任何人都可读——敏感内容（密码、密钥、住址、他人隐私等）**不得提交到公开仓库**，即使构建会过滤也不例外；
> - 私密内容的正确存放位置：本地未提交文件、私有仓库/私有分支，或加密备份；
> - 误提交敏感内容时按泄露事件处理：从工作区删除后还必须**清除 Git 历史**（如 `git filter-repo`），已发布过的话同时轮换可能泄露的凭据；
> - 构建回归：`scripts/check-visibility.mjs` 以私密/草稿夹具自动验证产物不泄漏（CI 与本地 `npm run check:visibility` 均会执行）。

## 各类型示例

### 灵感速记

```markdown
---
title: 一句话的灵感
date: 2026-09-26
tags: [灵感]
status: public
---

想法本身，一两段即可。
```

### AI 归档

```markdown
---
title: 与 ChatGPT 讨论 X
date: 2026-09-26
tags: [AI归档, ChatGPT]
status: public
sourceUrl: https://chatgpt.com/share/xxxx
provider: chatgpt
capturedAt: 2026-09-26
format: markdown
---

> 提示可保留原对话结构：提问 / 结论摘要 / 我的追问。
```

### 项目

```markdown
---
title: 项目名称
date: 2026-09-26
tags: [项目]
status: public
repo: owner/name        # Stars/Forks/语言/最近更新由 GitHub API 每日刷新
homepage: https://...   # 可选
featured: true          # 可选，首页/列表突出显示
---

项目的手工说明（卡片上的简介优先取 summary 字段）。
```

## 文件命名

`YYYY-MM-DD-slug.md`，slug 用小写英文与连字符（如 `2026-09-08-hello-flow-ledger.md`）。文件名即 URL 的一部分，命名后尽量避免改动。

## 图片与附件

放入 `public/media/`。注意部署在 `/flow-ledger/` 子路径时，正文中引用图片建议使用相对路径或构建期处理（P1 的导入器会统一处理此问题）。

## 快速开始

1. 用脚本新建（推荐，自动生成合法 Frontmatter，默认 `status: draft`）：

   ```bash
   npm run new -- posts "我的新文章" --slug my-post --tags 随笔
   npm run new -- notes "一个想法"
   npm run new -- archives "与 Claude 讨论 X" --provider claude
   npm run new -- projects "项目名" --repo owner/name
   ```

   也可以复制任一现有文件为新文件，按上面模板手工改 Frontmatter；
2. 写正文；
3. `npm run dev` 本地预览（草稿可见并带「草稿」徽章）；
4. 确认后把 `status` 改为 `public`，提交并推送（Conventional Commits，如 `feat: 新文章 <标题>`），合并到 `main` 后自动发布。
