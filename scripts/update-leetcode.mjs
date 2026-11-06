import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublicData, normalize, chinaDate, renderCard, renderReadme } from './leetcode.mjs';

export async function refresh({root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),load=fetchPublicData,now=new Date()}={}) {
  const [template,readme,raw]=await Promise.all([
    readFile(join(root,'scripts/leetcode-card.svg'),'utf8'),
    readFile(join(root,'README.md'),'utf8'),
    load(),
  ]);
  const snapshot=normalize(raw.stats,raw.contest,chinaDate(now));
  const svg=renderCard(template,snapshot);
  const nextReadme=renderReadme(readme,snapshot,svg);
  // Fetch, validate and render everything before touching the previous snapshot.
  // The workflow publishes these three files together in a single Git commit.
  await mkdir(join(root,'assets'),{recursive:true});
  await mkdir(join(root,'data'),{recursive:true});
  await writeFile(join(root,'assets/leetcode-live.svg'),svg);
  await writeFile(join(root,'data/leetcode-latest.json'),JSON.stringify(snapshot,null,2)+'\n');
  await writeFile(join(root,'README.md'),nextReadme);
  return snapshot;
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const s=await refresh();
    console.log(`LeetCode refreshed: ${s.date}, ${s.solved.total} solved, rating ${s.contest.rating}.`);
  } catch (error) {
    console.error(`LeetCode refresh failed; no generated update will be published: ${error.message}`);
    process.exitCode=1;
  }
}
