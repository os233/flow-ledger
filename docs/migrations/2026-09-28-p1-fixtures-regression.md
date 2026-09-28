# 导入迁移报告

- 运行时间：2026-09-28T07:23:02.489Z
- 目标集合：`content/posts/`，导入状态：`draft`
- 输入：scripts/import-fixtures（共 9 个文件，产出 8 篇，跳过 2 篇）

## 汇总

| 源文件 | 标题 | 日期 | 结果 | 损失数 |
| --- | --- | --- | --- | --- |
| scripts\import-fixtures\broken-frontmatter.md | — | — | ⚠️ 跳过 | 0 |
| scripts\import-fixtures\code-block.html | Code Block Roundtrip Post | 2026-09-28 | ✅ 2026-09-28-code-block-roundtrip-post.md | 0 |
| scripts\import-fixtures\duplicate-1.md | Same Title Post | 2025-03-01 | ✅ 2025-03-01-same-title-post.md | 0 |
| scripts\import-fixtures\duplicate-2.md | Same Title Post | 2025-03-02 | ✅ 2025-03-02-same-title-post.md | 0 |
| scripts\import-fixtures\encoding-gbk.html | GBK 编码文章 | 2026-09-28 | ✅ 2026-09-28-gbk.md | 0 |
| scripts\import-fixtures\legacy-post.md | Legacy Blog Post | 2024-11-15 | ✅ 2024-11-15-legacy-blog-post.md | 0 |
| scripts\import-fixtures\relative-images\post.html | Relative Image Post | 2026-09-28 | ✅ 2026-09-28-relative-image-post.md | 1 |
| scripts\import-fixtures\timezone-post.html | Timezone Aware Post | 2025-05-01 | ✅ 2025-05-01-timezone-aware-post.md | 0 |
| scripts\import-fixtures\wxr-export.xml | WordPress 迁移文章 | 2025-09-15 | ✅ 2025-09-15-wordpress.md | 1 |
| scripts\import-fixtures\wxr-export.xml | 已删除的草稿页 | — | ⚠️ 跳过 | 0 |

## 逐项明细

### scripts\import-fixtures\broken-frontmatter.md

- 格式：markdown
- 备注：已跳过：frontmatter 解析异常

### scripts\import-fixtures\code-block.html → 2026-09-28-code-block-roundtrip-post.md

- 格式：html
- 备注：源编码: utf-8

### scripts\import-fixtures\duplicate-1.md → 2025-03-01-same-title-post.md

- 格式：markdown
- 备注：源编码: utf-8

### scripts\import-fixtures\duplicate-2.md → 2025-03-02-same-title-post.md

- 格式：markdown
- 备注：源编码: utf-8

### scripts\import-fixtures\encoding-gbk.html → 2026-09-28-gbk.md

- 格式：html
- 备注：源编码: gbk

### scripts\import-fixtures\legacy-post.md → 2024-11-15-legacy-blog-post.md

- 格式：markdown
- 备注：源编码: utf-8

### scripts\import-fixtures\relative-images\post.html → 2026-09-28-relative-image-post.md

- 格式：html
- 备注：源编码: utf-8
- 备注：图片为绝对 URL，保留原链接：https://example.com/remote.png
- 备注：落盘图片 1 张到 public/media/import-*/
- 损失：相对图片源文件不存在，正文移除并记录：./imgs/missing.png

### scripts\import-fixtures\timezone-post.html → 2025-05-01-timezone-aware-post.md

- 格式：html
- 备注：源编码: utf-8
- 备注：日期含时区（2025-05-01T08:30:00+08:00 → UTC 2025-05-01T00:30:00.000Z），记录 UTC 日期

### scripts\import-fixtures\wxr-export.xml → 2025-09-15-wordpress.md

- 格式：wxr
- 备注：WXR item: post_type=post, wp:status=publish
- 备注：日期含时区（Mon, 15 Sep 2025 10:00:00 +0000 → UTC 2025-09-15T10:00:00.000Z），记录 UTC 日期
- 损失：相对图片源文件不存在，正文移除并记录：uploads/2025/09/wp-img.png

### scripts\import-fixtures\wxr-export.xml

- 格式：wxr
- 备注：WXR item: post_type=page, wp:status=trash
- 备注：非文章或已删除，跳过正文，仅记录
