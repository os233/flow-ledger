# P1 阶段启动门槛：写作、导入与导出

依据《流水账开发计划书》（2026-09-26 复核版）第 9 节「阶段启动门槛」编写。P0 已于 2026-09-26 验收闭环（见 [p0-acceptance.md](p0-acceptance.md)）。

## 用户场景

1. **随手记**：我在手机/电脑上想到什么，30 秒内通过脚本或编辑器新建一条速记，推上去。
2. **搬家进来**：把散落在别处（旧博客、WordPress、HTML 页面）的存量文章批量导入本仓库，转换损失可追溯。
3. **搬出去**：随时把单篇或全站内容导出为标准 Markdown，可被另一个静态博客直接使用，不锁定。
4. **安全预览**：改动通过 PR 预览确认排版后才合并发布，草稿与私密内容绝不进入任何公开预览。

## 非目标

- 不做在线账号系统、数据库或服务端渲染（计划书 §2 范围约束）；
- 不做 GitHub App 自动提交 PR（依赖密钥与第三方应用审批，推迟到 V2 按需评估）；
- 不追求 WXR/HTML 转换的像素级还原——目标是「可追溯的合理转换 + 损失报告」，不是完美迁移；
- 浏览器端编辑器只做纯客户端草稿工具（写/下载 .md），不做保存到仓库。

## 依赖与前置条件

- P0 的内容模型、Zod schema、可见性规则（`isVisible`）与 CI 链路——均已就绪；
- 新增依赖控制在最小集：转换用 `turndown`（HTML→MD）、WXR 解析用正则+`fast-xml-parser`、ZIP 用 `archiver`，均为开发期工具链依赖，不进站点运行时；
- Pagefind：计划内最后一个接入项，锁定确切版本并选支持 CJK 的 extended 构建（计划书 §3）。

## 数据 / 权限流

- 导入器只读输入文件、只写 `content/` 与 `public/media/`，生成迁移报告到 `docs/migrations/`；不触碰工作流与配置；
- 导出器只读 `content/` 与 `dist/`，产物输出到 `export/`（已 gitignore）；
- 无新增密钥；`GITHUB_TOKEN` 使用范围不扩大。

## 隐私影响

- **红线不变**：任何导入/导出/预览产物都必须经过既有可见性规则；`check-visibility.mjs` 扩展覆盖导出与预览产物；
- PR 预览方案（GitHub Pages 无原生 PR 预览）：预览构建发布到 `/flow-ledger/preview/pr-<n>/` 子路径——**访问范围：公开（与主站同级，因此只包含 public 内容，draft/private 在预览构建中同样被过滤）**；**过期与删除**：PR 关闭/合并时由工作流自动删除对应目录；报告 URL 由工作流评论到 PR；
- 导入的存量内容默认 `status: draft`，人工确认后才改 `public`，不自动公开（计划书 §5 P2 同源原则）。

## 责任人与成本

- 责任人：os233（内容与验收）+ AI 协作（实现）；
- 成本上限：零固定成本（GitHub Actions/Pages 免费额度内）；npm 依赖均为开源工具链。

## 批次计划

| 批次 | 内容 | 验收锚点 |
| --- | --- | --- |
| B1（本次） | P1 门槛文档 + 新建文章脚本与 Frontmatter 模板 | 脚本生成的各类 Frontmatter 通过构建期 schema 校验 |
| B2 | 导入器：Markdown / HTML / WordPress WXR → content/ + 迁移报告 | 计划书 P1 验收样例集（编码/时区/相对图片/代码块/重复 slug/损坏 Frontmatter/大文件）逐项可追溯 |
| B3 | 导出器：单篇 MD/HTML、全站 ZIP、RSS 附件相对路径 | 导出 MD 可被一种指定静态博客（Astro 官方 blog 模板）直接导入 |
| B4 | PR 预览部署（preview 子路径 + 自动清理） | 预览不含 draft/private；关闭 PR 后预览目录被删除 |
| B5 | Pagefind 搜索（CJK extended，索引纳入可见性检查） | 搜索结果不含 draft/private；P0 验收第 5 条扩展通过 |

## 完成定义（DoD）

每个批次：`npm run build`（含类型检查）+ `check-links` + `check-visibility` 全绿、Conventional Commits 提交、文档同步更新。P1 整体验收对照计划书 §5 P1 验收条款在 B5 后执行并记录到 `docs/p1-acceptance.md`。
