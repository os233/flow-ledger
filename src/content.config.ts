import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 内容模型（《流水账开发计划书》第 4 节）
 *
 * 统一元数据：title、date、updated、tags、status（draft/private/public）、summary
 * - status: public 公开发布；draft 仅本地/开发预览可见；private 任何构建产物都不包含
 * - 项目额外：repo、homepage、featured
 * - AI 归档额外：sourceUrl、provider、capturedAt、format、originalHash
 */

const baseSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  // 标签会成为 /tags/<tag>/ 的 URL 段，禁止破坏路径形态的字符（含空格等仍可用，构建期会编码）
  tags: z
    .array(z.string().trim().min(1).regex(/^[^/#?%]+$/, '标签不能包含 / # ? % 字符'))
    .default([]),
  status: z.enum(['draft', 'private', 'public']).default('draft'),
  summary: z.string().optional(),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/notes' }),
  schema: baseSchema,
});

const archives = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/archives' }),
  schema: baseSchema.extend({
    sourceUrl: z.string().url(),
    provider: z.string().min(1),
    // 缺省按缺失处理（展示层条件渲染）；不用构建时刻兜底，避免「抓取于」变成「构建于」
    capturedAt: z.coerce.date().optional(),
    format: z.enum(['markdown', 'html', 'json']).default('markdown'),
    originalHash: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/projects' }),
  schema: baseSchema.extend({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo 需为 "owner/name" 形式'),
    homepage: z.string().url().optional(),
    featured: z.boolean().default(false),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/posts' }),
  schema: baseSchema,
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/pages' }),
  schema: z.object({
    title: z.string().min(1),
    updated: z.coerce.date().optional(),
    summary: z.string().optional(),
  }),
});

export const collections = { notes, archives, projects, posts, pages };
