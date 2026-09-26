// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// 部署到 GitHub Pages 项目站点（https://<user>.github.io/flow-ledger/）。
// 本地以根路径预览时：BASE_PATH=/ SITE=https://example.com npm run build
const site = process.env.SITE ?? 'https://example.github.io';
const base = process.env.BASE_PATH ?? '/flow-ledger';

export default defineConfig({
  site,
  base,
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      // high-contrast 变体：注释等低强调 token 也能满足 WCAG AA 对比度
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
