# Astro 7 升级记录

- 日期：2026-09-28
- 范围：`astro` 5.18.2 → 7.3.5，`@astrojs/mdx` 4.3.14 → 8.0.2（捆绑升级，见「破坏性变更」）
- 对应计划书第 9 节「运行时升级」：独立变更、记录构建结果与回退方案、同步文档。

## 升级原因

- 计划书（2026-09-26 复核版）记录 Astro 5.18.2 / Node 20 为基线并要求升级出 EOL 运行时；CI 与部署工作流已先行切换到 Node 24。
- 计划书当时的目标版本为 Astro 6.x；按计划书「执行升级前重新核实官方当前版本」的要求复核，Astro 7 为当前主版本，且实测与本项目内容、脚本兼容，故直接升入 7.x。
- Dependabot 的 astro-7.3.4 与 @astrojs/mdx-8.0.2 两个 PR 单独均无法安装（peer 依赖互相锁定），本分支按捆绑方式完成同等升级。

## 破坏性变更与处理

| 变更 | 处理 |
| --- | --- |
| `@astrojs/mdx@8` peer 要求 `astro@^7.2.10`，`@astrojs/mdx@4` peer 锁定 `astro@^5` | 两个依赖必须同一次变更内捆绑升级，不能分步 |
| Astro 7 依赖 esbuild 0.28.2，其 postinstall 不在 `package.json` `allowScripts` 白名单内，新环境安装会被拦截导致构建失败 | `allowScripts` 增加 `"esbuild@0.28.2": true` |
| Astro 7 最低 Node ≥ 22.12.0 | 本地与 CI/部署工作流均已为 Node 24，无需改动 |
| TypeScript 7 暂不可升 | `@astrojs/check@0.9.10` peer 仅接受 `typescript@^5 \|\| ^6`，维持 5.9.x，待上游支持后另立变更 |

## 验证证据

- `npm run check`：0 错误 0 警告；
- `npm run build`：30 页面，Pagefind 索引行数与 dist 页面数一致；
- `npm run check:visibility`：77 个文本产物通过，私密/草稿夹具未泄漏（含搜索索引）；
- `npm run check:links`：30 页面、33 个站内链接全部有效（与升级前 main 基线同日验收记录一致）；
- `npm run export -- --all`：全站 ZIP 打包正常（8 篇公开内容）。

文档同步：`AGENTS.md`、`programs.md`、`docs/architecture.md` 的技术栈表述，`programs.md` 的 Node 要求（修正为 ≥ 22.12，与工作流 Node 24 一致）。

## 回退方案

合并后如需回退：revert 本 PR（`package.json` + `package-lock.json` + `allowScripts` + 文档同批回滚），或按提交历史恢复到升级前的 main 快照；内容与可见性规则未变，回退后直接 `npm ci && npm run build` 即可复现原构建。
