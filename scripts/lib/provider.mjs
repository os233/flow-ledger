/**
 * AI 归档来源标识推断（new-archive.mjs 与 import.mjs 共用，避免域名表两处漂移）。
 * 只做确定性映射，未命中交人工维护。
 */

/** 常见 AI 平台分享域名 → provider */
export const PROVIDER_HOSTS = [
  [/chatgpt\.com|openai\.com/, 'chatgpt'],
  [/claude\.ai|anthropic\.com/, 'claude'],
  [/gemini\.google\.com|bard\.google\.com/, 'gemini'],
  [/chat\.deepseek\.com/, 'deepseek'],
  [/kimi\.moonshot\.cn|kimi\.com/, 'kimi'],
  [/doubao\.com/, 'doubao'],
  [/yuanbao\.tencent\.com/, 'yuanbao'],
  [/chatglm\.cn|bigmodel\.cn|chat\.z\.ai/, 'glm'],
];

/** 按 sourceUrl 域名推断 provider；无法解析或未命中返回 null */
export function inferProvider(url) {
  try {
    const host = new URL(url).hostname;
    return PROVIDER_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}
