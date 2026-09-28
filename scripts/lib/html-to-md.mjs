/**
 * HTML→Markdown 共享转换器（P2-B2 自 import.mjs 抽出，供归档与后续脚本复用）。
 * 每次调用返回全新实例：调用方在其上追加的 addRule 不会互相污染。
 */
import TurndownService from 'turndown';

export function createTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  // 保留 turndown 默认丢弃的块级元素，转成报告可追溯的占位注释
  td.addRule('reportLosses', {
    filter: ['iframe', 'form', 'button', 'style', 'script'],
    replacement: (_content, node) => `\n\n<!-- 迁移损失：丢弃 <${node.nodeName.toLowerCase()}> 元素 -->\n\n`,
  });
  return td;
}
