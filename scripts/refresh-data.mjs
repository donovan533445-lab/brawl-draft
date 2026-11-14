import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const source = 'https://brawlapi-v1.pages.dev/v1/';
await fs.mkdir(path.join(root, 'dist/data'), {recursive:true});
for (const type of ['brawlers','maps']) {
  const res = await fetch(source + type, {signal:AbortSignal.timeout(30000)});
  if (!res.ok) throw Error(`${type}: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.list) || !data.list.length) throw Error('Invalid data');
  await fs.writeFile(path.join(root,'dist/data',type+'.json'), JSON.stringify(data));
  console.log(`${type}: ${data.list.length}`);
}
await fs.writeFile(path.join(root,'dist/data/meta.json'), JSON.stringify({fetchedAt:new Date().toISOString(),source:'https://brawlapi.com/',api:source}));
