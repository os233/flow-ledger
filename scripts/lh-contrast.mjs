import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, file] = process.argv.slice(2);
const r = JSON.parse(readFileSync(join(dir, file), 'utf8'));
const items = r.audits['color-contrast'].details?.items ?? [];
console.log('count:', items.length);
for (const it of items) {
  const n = it.node ?? {};
  console.log('---');
  console.log('selector:', (n.selector ?? '').slice(0, 120));
  console.log('snippet:', (n.snippet ?? '').replace(/\s+/g, ' ').slice(0, 120));
  console.log('explanation:', (n.explanation ?? '').replace(/\s+/g, ' ').slice(0, 220));
}
