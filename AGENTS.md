# Flow Ledger（流水账）项目指引

## 权威资料与开始任务

- 项目需求、分期规划与技术决策以仓库外计划书 `D:\project\src\flow-ledger计划书\flow-ledger-development-plan.md` 为准。开始开发任务前先阅读；计划书与代码/文档冲突时，暂停冲突部分并向用户说明差异、确认依据后再改。
- 同时阅读 `README.md`、`docs/architecture.md`、`docs/content-guide.md` 中与任务相关的部分。项目总览见根目录 `programs.md`。
- 动手前确认当前阶段。当前仓库架构基线是 **P0：可发布基础站**；P1（写作导入导出）、P2（AI 分享解析归档）、P3（主题市场）属于后续规划。不要把规划能力写成已实现功能。

## 项目定位与关键事实

Flow Ledger 是“先记下、再整理、可长期保存”的个人数字花园。速记（notes）、AI 对话归档（archives）、GitHub 项目（projects）、正式博客（posts）共用 Markdown 内容资产，并静态发布到 GitHub Pages。

- `content/{notes,archives,projects,posts,pages}` 是唯一内容源；元数据由 Astro Content Collections 与 Zod 校验。
- `status: private` 的条目不得生成页面，也不得进入列表、RSS 或 sitemap；不可用前端隐藏替代构建期过滤。`draft` 在生产构建不可见，可在本地开发预览。
- 当前技术栈：Astro 5、TypeScript、Markdown/MDX、Tailwind CSS 4（`@tailwindcss/vite`）、RSS、sitemap、Shiki。部署目标是 GitHub Pages，项目基础路径 `/flow-ledger/`。
- 当前实现与模块、内容字段和脚本以 `docs/architecture.md`、`docs/content-guide.md`、源码及 `package.json` 为准。
- `main` 始终保持可发布；功能使用 `feat/<name>` 分支并通过 PR 合并。提交信息遵循 Conventional Commits（如 `feat:`、`fix:`、`docs:`、`chore:`）。
- 代码采用 MIT；内容采用 CC BY 4.0 或保留版权；第三方主题、图片等保留原许可证与署名。

## AI 代理职责

AI 代理作为协作开发者，负责理解任务、定位代码和规范、提出与实施最小且完整的变更，并向用户清楚说明结果。

- 先核对已有实现和约定，再编辑；优先复用现有组件、工具函数、样式令牌和内容模型。
- 只处理用户授权范围内的工作。不得擅自发布、部署、合并 PR、改动外部服务或发送消息；遇到这些操作需取得明确授权。
- 不臆造产品功能、内容字段、命令或当前进度。发现计划书、源码、文档之间有实质冲突，先停在受影响的决策点并请用户裁定。
- 保护内容与凭据：不将私密内容复制到公开示例或生成产物；不把密钥写入源码、内容或日志；任何抓取/导入能力都不得绕过登录、访问控制或平台限制。
- 保留用户已有改动，不为清理工作区而覆盖、回滚或删除无关内容。
- 遵守仓库根目录及目标目录中的 `AGENTS.md`；规范有冲突时遵循用户指令并说明必要差异。

## 协作方式

- 先以简短进度说明任务理解和核对范围；任务跨多个文件或有重要取舍时，先给出执行顺序。
- 以当前会话代理为主要协调者。只有用户或适用指引明确要求并行/委派时，才拆分给其他代理；拆分后明确文件/问题边界，避免并发改写同一文件。
- 将发现、假设、阻塞点和完成情况及时反馈；新消息视为对当前任务的补充或纠正，除非用户明确取消或替换目标。
- 遇到需要用户决定的冲突或缺失信息时，继续完成不依赖该决定的工作，并把问题限定在必要范围。

## 任务流程

1. **理解**：提炼目标、交付物、范围与验收条件；识别任务属于当前阶段还是后续规划。
2. **对齐**：阅读计划书以及相关 README、架构、内容指南和局部指引；检查实际源码、脚本与配置。
3. **检查状态**：查看工作区已有修改，避免覆盖；确认相关实现和现有约定。
4. **实施**：用最小完整改动满足目标；需要时同步更新受影响的文档、类型、内容 schema、路由或工作流。
5. **核对**：按任务要求检查 diff、链接和一致性。仅在用户要求验证，或明确交付需要验证时运行相应命令；报告运行的命令及结果，不声称未执行的检查已通过。
6. **交付**：总结改动文件、关键决策、验证结果与尚存限制。外部发布或其他不可逆动作需用户明确授权后再执行。

## 行为与实现规范

- 保持 README、`docs/architecture.md`、`docs/content-guide.md`、`programs.md` 与实现一致；新功能标明阶段和真实状态。
- 页面内部 URL 使用 `src/lib/site.ts` 的 `withBase()` 等既有封装，兼容 `/flow-ledger/` 子路径；主题样式使用 `src/styles/global.css` 中的设计令牌，避免无故硬编码。
- 所有内容字段按内容指南和 Zod schema；修改 schema 时检查现有内容兼容性。保护 `private`、`draft` 与 RSS/sitemap 的可见性规则。
- GitHub 项目卡片读取构建期缓存，不让站点构建依赖网络。密钥仅可放在获准的运行时秘密存储中。
- 不为未经计划或用户确认的 P1–P3 能力增加依赖或服务端组件；新增依赖需说明用途与影响。
- 文档用简明中文说明项目约定；命令以 `package.json` 实际脚本为准。

## 常用命令

```bash
npm install        # 安装依赖
npm run dev        # 本地开发服务器
npm run check      # Astro 同步与类型检查
npm run build      # 检查并构建到 dist/
npm run preview    # 预览构建产物
npm run fetch:github # 刷新 GitHub 项目缓存
```

Node.js 要求、部署说明与内容字段详情以 README 和 `docs/` 文档为准。
