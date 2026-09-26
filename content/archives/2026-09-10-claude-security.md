---
title: 与 Claude 讨论链接解析的安全边界
date: 2026-09-10
tags: [AI归档, Claude, 安全]
status: public
sourceUrl: https://claude.ai/share/example-security-boundary
provider: claude
capturedAt: 2026-09-10
format: markdown
summary: 抓取第三方分享链接的 Worker 必须有来源白名单、限流与 SSRF 防护，且解析结果永不自动公开。
---

> 示例归档：以下为演示用占位文本。

## 提问

流水账 V2 想做「粘贴 AI 分享链接 → 自动解析为 Markdown → 存为草稿」，解析服务需要哪些安全约束？

## 结论摘要

- 来源白名单：只处理明确授权的分享域名。
- 限流与大小/超时限制，防止被滥用或拖垮。
- SSRF 防护：禁止访问内网地址、重定向到私有网段。
- 解析结果一律先存草稿，人工确认后才发布。
- 失败时保留手工粘贴 Markdown 的替代入口。
