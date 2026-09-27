import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const groups = new Map();
for (const f of files) {
  const key = f.replace(/-\d+\.json$/, '');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(f);
}

for (const [key, list] of [...groups.entries()].sort()) {
  const perf = [];
  const a11y = [];
  let contrast = 0;
  for (const f of list) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    // score 为 null（audit 崩溃的报告）时按 0 计并归入中位数，避免 Math.round(null*100) 的隐式行为
    perf.push(Math.round((r.categories?.performance?.score ?? 0) * 100));
    a11y.push(Math.round((r.categories?.accessibility?.score ?? 0) * 100));
    // 累加组内所有文件的对比度问题数（此前每轮覆盖，只反映最后一个文件）
    contrast += (r.audits?.['color-contrast']?.details?.items ?? []).length;
  }
  console.log(
    `${key}: n=${list.length} perf median=${med(perf)}(${perf.join(',')}) ` +
      `a11y median=${med(a11y)}(${a11y.join(',')}) contrastFails=${contrast}`,
  );
}
