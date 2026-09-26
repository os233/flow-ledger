# 流水账（Flow Ledger）

一个「先记下、再整理、可长期保存」的个人数字花园：灵感速记、AI 对话分享归档、GitHub 项目动态与博客共用一套 Markdown 内容资产。

- 线上地址：`https://<GitHub用户名>.github.io/flow-ledger/`
- 内容全部保存在本仓库 `content/` 目录下的 Markdown 文件中，Git 即内容源。
- 开发计划见《流水账开发计划书》。

## 内容结构

```
content/
  notes/        # 灵感速记：短内容，可标记为私密、草稿或公开
  archives/     # AI 分享内容的原链接、解析结果、来源与归档日期
  projects/     # 手工说明 + GitHub 仓库标识
  posts/        # 正式博客（Markdown/MDX）
  pages/        # 关于、订阅、使用说明
public/media/   # 图片与附件
```

统一元数据（Frontmatter）：`title`、`date`、`updated`、`tags`、`status`（`draft` / `private` / `public`）、`summary`。字段规范见 [docs/content-guide.md](docs/content-guide.md)。

> 标为 `status: private` 的内容在构建期被过滤，不会进入线上产物。

## 本地开发

要求 Node.js ≥ 18.17（CI 与部署当前使用 Node 20）。

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 http://localhost:4321
npm run build      # 类型检查 + 产出静态站点到 dist/
npm run preview    # 本地预览构建产物
```

刷新 GitHub 项目卡片缓存数据（可选，无需 token，匿名限额每小时 60 次）：

```bash
npm run fetch:github
```

## 部署（GitHub Pages）

1. 在 GitHub 创建公开仓库 `flow-ledger`，将本目录推送上去（`main` 分支）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 之后每次推送或合并到 `main`，会自动执行类型检查、构建、链接检查并发布。

相关工作流：

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| CI | push / PR | 类型检查、构建、内部链接检查 |
| Deploy | push main | 构建并部署到 GitHub Pages |
| Refresh GitHub data | 每日定时 | 刷新项目卡片的 Stars/Forks 等缓存数据 |

## 许可证

- 代码：[MIT](LICENSE)
- 内容（`content/`）：CC BY 4.0（转载内容保留原作者署名）
