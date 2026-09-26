# P0 验收记录

对照《流水账开发计划书》（2026-09-26 复核版）第 5 节 P0 验收标准逐项记录。线上地址：https://os233.github.io/flow-ledger/

## 1. 视口人工检查（360 / 768 / 1280）

- 日期：2026-09-26；浏览器：ZCode 内置 Chromium（IAB）；生产构建 `astro preview` 本地预览。
- 360×740：首页单列时间流正常，摘要两行截断；导航折叠为汉堡按钮，抽屉滑出/遮罩/关闭正常；无横向溢出。
- 768×1024：导航完整显示（≥768px 断点），抽屉按钮隐藏；卡片布局舒适。
- 1280×800：博客详情页目录侧栏粘性滚动正常；项目页双列卡片；代码块、表格、引用块渲染正常。
- 结果：三档视口均无横向溢出，浏览/导航/切换主题等主要任务可完成。✅

## 2. 键盘与无障碍（自动化扫描 + 人工走查）

- 已实现：跳转链接（Skip to main）、`:focus-visible` 聚焦环、抽屉焦点管理与 Tab 循环、Esc 关闭、语义化标题/导航/aria-label、`prefers-reduced-motion` 降级。
- 键盘路径：Tab 到跳转链接 → 导航 → 内容链接 → 主题切换 →（窄屏）抽屉开关，均已人工走查。✅
- **axe-core 4.10.2 自动扫描**（首页/博客详情/项目页，桌面视口）：
  - 扫描时线上版本（旧令牌）唯一 serious 问题为 color-contrast（13/11/14 处）+ 1 处 moderate（aside 嵌套 landmark）；
  - 两项均已修复：三级文字令牌加深（浅色 #78716c ≈ 4.65:1、深色 #a8a29e ≈ 7.9:1）、Shiki 换用 github-*-high-contrast 高对比主题（注释 token 对比度达标）、目录 aside 改为普通容器；
  - 修复版本地复扫：**零违规（所有影响级别）**。✅（待推送后线上复核）
- 屏幕阅读器人工检查：未做（记录为已知缺口，不阻塞 P0 发布）。

## 3. Lighthouse（性能 / 无障碍 ≥ 90）

- 环境：Lighthouse（Chrome 137+ headless，默认移动设备模拟，性能 + 无障碍两类）；首页与代表性文章页各运行 3 次取中位数。
- **线上当前版本**（2026-09-26）：首页 性能 100 / 无障碍 95；文章页 性能 100 / 无障碍 96——**已达标** ✅
- **无障碍修复版**（本地生产构建预览，各 3 次）：首页 性能 100 / 无障碍 **100**，文章页 性能 100 / 无障碍 **100**，color-contrast 失败清零。✅
- 说明：Lighthouse 无头模式以深色方案渲染，暴露了 Shiki github-dark 注释 token 的对比度问题，换用 high-contrast 主题后解决。

## 4. CI 与 Pages 部署

- Deploy 工作流首跑：构建、产物上传成功；deploy 步骤 404——原因是 Pages 未启用（新仓库默认关闭），在 Settings → Pages → Source 选 GitHub Actions 并 Re-run 后部署成功。✅
- 生产地址返回新版本：已核验 https://os233.github.io/flow-ledger/ 返回最新构建；页脚链接（commit `145f9a9`）与 robots 修复（`3b203e8`）待推送，推送后以页脚链接指向 `github.com/os233` 为版本标记复核。
- 部署失败回退：Pages 保留最近成功部署版本；`dist` 产物可在本地完整重建。
- 定时刷新保护：`refresh-github-data.yml` 仅在缓存变化时提交，推送前 `git fetch + rebase`，不会覆盖内容提交；脚本失败保留旧缓存，构建不依赖实时 API。

## 5. 内容可见性回归夹具

- 夹具：公开 `2026-09-01-first-note`、草稿 `2026-09-22-draft-fixture`、私密 `2026-09-20-private-idea`。
- 本地自动检查：`scripts/check-visibility.mjs` 36 个文本产物中私密/草稿 slug 零出现、公开对照存在。✅
- **线上核验**：`/notes/2026-09-20-private-idea/` 与 `/notes/2026-09-22-draft-fixture/` 均 404；sitemap-0.xml 中夹具 slug 零出现。✅
- 开发模式行为：草稿在 `npm run dev` 可见并带「草稿」徽章；私密在任何模式均无页面。
- P1 备注：接入 Pagefind 后，搜索索引必须纳入同一检查。

## 6. GitHub 项目卡片数据

- `fetch-github-data.mjs` 已拉取真实数据（withastro/astro 等），失败保留旧缓存；站点构建不发起任何网络请求（构建期只读本地缓存 JSON）。
- 每日刷新工作流：UTC 02:23 定时执行；次日可在 Actions 页确认首跑结果。

## 7. 备份与恢复演练

- 日期：2026-09-26；演练对象：commit `54a3a8d`。
- 步骤与结果：`git clone`（本地路径模拟）→ `npm ci` 干净安装 → `npm run build`（29 页，含类型检查）→ 链接检查通过。恢复路径可用，步骤已写入 README「备份与恢复」。

## 8. 线上 SEO 产物核验（2026-09-26）

- robots.txt、sitemap-index.xml、rss.xml 均在线上可达且域名正确（`os233.github.io/flow-ledger/`）。✅
- 发现并修复：robots.txt 的 Sitemap 地址缺少 base 子路径（`3b203e8`）。
- 已知限制：RSS 频道 `<link>` 为域名根，条目链接正确——@astrojs/rss 硬编码 channel link 取 site 配置，改 site 会破坏条目链接解析，收益极小故不改。

## 遗留与后续

1. 推送待上线提交：`145f9a9`（页脚用户名）、`3b203e8`（robots 修复）、无障碍修复与验收记录（见最新提交）；
2. 推送后线上复核：axe 零违规 + Lighthouse 无障碍 100 的线上确认（以页脚链接为版本标记）；
3. 每日数据刷新工作流次日实跑确认；
4. 屏幕阅读器人工检查（非阻塞缺口，可在 P1 补做）。
