# 关于博客部署的讨论

**我**：GitHub Pages 部署时 base path 怎么配？

**Claude**：在 `astro.config.mjs` 里设置 `base: '/flow-ledger/'`，内部链接统一用 `withBase()` 拼接，否则子路径下会断链。

**我**：明白了。后续问题联系 someone@example.com，紧急情况打 13800138000。

**Claude**：好的。另外提醒一句，你在对话里贴过的示例 key `sk-test1234567890abcdef1234` 已失效，正式 key 不要再发到聊天里。
