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

> 标为 `status: private` 的内容在构建期被过滤，不会进入线上产物。**但构建期过滤不是访问控制**：公开仓库及其 Git 历史对任何人都可读，敏感内容不得提交到公开仓库，详见 [docs/content-guide.md](docs/content-guide.md) 的「隐私红线」。

## 本地开发

推荐 Node.js 24 LTS（CI 与部署使用 Node 24，见计划书第 3 节「版本与运行时基线」；Node 22 亦可，仅使用仍受上游支持的 LTS 版本）。

> PowerShell 用户：首次运行 `npm` 若报「无法加载文件 npm.ps1，因为在此系统上禁止运行脚本」，执行一次
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` 即可（仅当前用户，无需管理员）；或改用 `npm.cmd run ...` / Git Bash。

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 http://127.0.0.1:4321/flow-ledger/
npm run build      # 类型检查 + 产出静态站点到 dist/
npm run preview    # 本地预览构建产物
npm run new        # 新建内容：npm run new -- posts "标题" --slug my-post --tags a,b
npm run import     # 导入内容：npm run import -- <文件或目录> --type posts
npm run export     # 导出内容：npm run export -- <slug> | --all [--with-drafts]
```

> 开发/预览服务器显式绑定 `127.0.0.1`：部分环境下 `localhost` 会被解析为 IPv6（`[::1]`）且浏览器不回退，导致 `ERR_CONNECTION_REFUSED`。访问时请用 `127.0.0.1` 地址。

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
| CI | push / PR | 类型检查、构建、内部链接与内容可见性检查 |
| Deploy | push main | 构建并部署到 GitHub Pages |
| PR Preview | PR 打开/更新/关闭 | 预览部署到 `preview/pr-<编号>/` 子路径并评论链接；关闭时自动清理 |
| Refresh GitHub data | 每日定时 | 刷新项目卡片的 Stars/Forks 等缓存数据 |

## 备份与恢复

Git 远端**不是**私密内容的安全边界，也不等同于独立备份（计划书第 9 节）：

- **备份对象**：仓库本身 + `content/`（内容源）+ `src/data/github-cache.json`（可重建，非关键）；
- **恢复步骤**（从克隆重建站点，已演练验证）：

  ```bash
  git clone <仓库地址> flow-ledger-restore
  cd flow-ledger-restore
  npm ci
  npm run build          # 产出 dist/，含类型检查、链接与可见性检查
  npm run preview        # 验证站点可正常渲染
  ```

- **恢复点目标**：每次 push 到远端即为一个恢复点；本地未提交内容不在任何恢复点内，重要草稿请尽早提交；
- 私密内容不走公开仓库备份，按「隐私红线」使用私有仓库或加密备份。

## 许可证

- 代码：[MIT](LICENSE)
- 内容（`content/`）：CC BY 4.0（转载内容保留原作者署名）
