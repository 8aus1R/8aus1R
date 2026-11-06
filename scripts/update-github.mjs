import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGithubContributions,normalizeGithub,renderGithubReadme } from './github-contributions.mjs';
import { renderGithubCard } from './github-card.mjs';

export async function refreshGithub({root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),load=fetchGithubContributions,now=new Date()}={}) {
  const [readme,data]=await Promise.all([readFile(join(root,'README.md'),'utf8'),load({now})]);
  const snapshot=normalizeGithub(data,now);
  const svg=renderGithubCard(snapshot);
  const nextReadme=renderGithubReadme(readme,snapshot,svg);
  // Nothing is written until the complete calendar, card and README have passed validation.
  await mkdir(join(root,'assets'),{recursive:true});await mkdir(join(root,'data'),{recursive:true});
  await writeFile(join(root,'assets/github-contributions.svg'),svg);
  await writeFile(join(root,'data/github-contributions.json'),JSON.stringify(snapshot,null,2)+'\n');
  await writeFile(join(root,'README.md'),nextReadme);
  return snapshot;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const s=await refreshGithub();
    console.log(`GitHub refreshed: ${s.range.from}..${s.range.to}, ${s.total_contributions} contributions, ${s.active_days} active days.`);
  } catch(error) {
    console.error(`GitHub card refresh failed; no generated update will be published: ${error.message}`);
    process.exitCode=1;
  }
}
