---
title: 草稿夹具（构建回归用，不应出现在线上）
date: 2026-09-22
tags: [灵感, 夹具]
status: draft
summary: "status: draft 的回归夹具——生产构建不得包含本文；本地开发模式可见并带「草稿」徽章。"
---

这是一条 `status: draft` 的内容夹具，配合 `scripts/check-visibility.mjs` 做构建回归：

- 生产构建产物（HTML、RSS、sitemap）不得出现本文件（slug：`2026-09-22-draft-fixture`）；
- 本地 `npm run dev` 时可见，列表与详情页带「草稿」徽章，便于预览排版；
- 与私密夹具（`2026-09-20-private-idea`）共同覆盖两种非公开状态的过滤行为。

如果你在生产站点看到了这篇文章，说明草稿过滤失效，请立即检查 `src/lib/content.ts` 的 `isVisible` 规则。
