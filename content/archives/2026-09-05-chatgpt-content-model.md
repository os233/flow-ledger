---
title: 与 ChatGPT 讨论静态博客的内容模型
date: 2026-09-05
tags: [AI归档, ChatGPT, 内容模型]
status: public
sourceUrl: https://chatgpt.com/share/example-content-model
provider: chatgpt
capturedAt: 2026-09-05
format: markdown
originalHash: sha256:0a1b2c3d4e5f60718293a4b5c6d7e8f9
summary: 让 AI 对比几种静态博客内容组织方式，结论是「按内容类型分目录 + 统一 Frontmatter」最可持续。
---

> 示例归档：以下对话内容为演示用占位文本，展示 AI 分享归档的元数据与正文格式。

## 提问

我想把灵感、AI 对话、项目动态和博客放进同一个 Git 仓库，怎么组织内容模型最不容易失控？

## 结论摘要

1. 按内容类型分目录（notes / archives / projects / posts），而不是按日期。
2. 所有类型共用统一元数据字段，类型差异用额外字段表达。
3. 用 Zod 在构建期校验 Frontmatter，格式失控会在构建时报错，而不是烂在线上。

## 我的追问

- 私密内容怎么办？——状态字段 + 构建期过滤，不靠前端隐藏。
- 将来迁移怎么办？——一切皆 Markdown，导出即迁移。
