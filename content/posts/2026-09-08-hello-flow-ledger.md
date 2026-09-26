---
title: 你好，流水账
date: 2026-09-08
updated: 2026-09-15
tags: [博客, 起点 ]
status: public
summary: 第一篇正式博客：为什么选择「先记下、再整理」，以及这个站点是如何构建的。
---

## 为什么叫「流水账」

记账的人都知道，流水账不是坏账本——它诚实、完整、按时间排列。写作也一样：先把想法流水般记下来，再整理成结构化的文章。这个站点同时容纳两者：

- **灵感速记**：一句话也值得留下；
- **正式博客**：被整理过、值得被搜索和引用的想法；
- **AI 对话归档**：与 AI 的有价值的讨论，保留原链接与抓取时间；
- **项目动态**：我在 GitHub 上的构建过程。

## 站点是怎么构建的

站点使用 Astro 构建，内容全部是仓库里的 Markdown 文件。一段示例代码：

```ts
// 构建时校验文章元数据，格式失控会在构建期报错
const posts = await getCollection('posts', ({ data }) => {
  return data.status === 'public';
});
```

### 技术选择

| 层级 | 选择 |
| --- | --- |
| 站点生成 | Astro + TypeScript |
| 内容 | Markdown + MDX |
| 样式 | Tailwind CSS + CSS 变量 |
| 部署 | GitHub Actions → GitHub Pages |

### 下一步

1. 写作导入导出工具（P1）
2. AI 分享链接解析归档（P2）
3. 主题市场（P3）

> 记下优先于完美。
