import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,basename,resolve } from 'node:path';
import { normalizeGithub,renderGithubReadme } from './github-contributions.mjs';
import { renderGithubCard } from './github-card.mjs';
import { refreshGithub } from './update-github.mjs';

const now=new Date('2026-11-06T07:00:00Z');
function fixture() {
  const start=Date.parse('2025-11-02T00:00:00Z');
  const cells=Array.from({length:370},(_,i)=>{
    const d=new Date(start+i*86400000),date=d.toISOString().slice(0,10),day=d.getUTCDate();
    const suffix=day%100>=11&&day%100<=13?'th':({1:'st',2:'nd',3:'rd'}[day%10]??'th');
    const label=d.toLocaleString('en-US',{month:'long',timeZone:'UTC'})+' '+day+suffix;
    const n=[0,1,2,3,340,341,369].includes(i)?2:0;
    return '<td class="ContributionCalendar-day" id="d-'+i+'" data-date="'+date+'" data-level="'+(n?1:0)+'"></td><tool-tip for="d-'+i+'">'+(n?n+' contributions':'No contributions')+' on '+label+'.</tool-tip>';
  }).join('');
  return '<h2 id="js-contribution-activity-description">14 contributions in the last year</h2><div class="js-calendar-graph" data-graph-url="/users/8aus1R/contributions" data-url="/8aus1R" data-from="2025-11-02 00:00:00 UTC" data-to="2026-11-06 23:59:59 UTC">'+cells+'</div>';
}

test('daily counts drive total, active days, longest streak and inclusive last 30 days',()=>{
  const s=normalizeGithub(fixture(),now);
  assert.equal(s.total_contributions,14);assert.equal(s.active_days,7);assert.equal(s.longest_streak,4);assert.equal(s.recent_30_days,6);
  assert.equal(s.days.length,370);assert.equal(s.days[369].weekday,5);
});

test('a Beijing next-day refresh keeps UTC dates and still renders successfully',()=>{
  const midnight=new Date('2026-11-06T16:00:00Z');
  const s=normalizeGithub(fixture(midnight),midnight);
  assert.equal(s.date,'2026-11-07');assert.equal(s.range.to,'2026-11-06');
  assert.ok(renderGithubCard(s).includes('2026-11-07'));
});

test('SVG includes each day once; README preserves LeetCode and changes cache key',()=>{
  const s=normalizeGithub(fixture(),now),svg=renderGithubCard(s);
  for(const day of s.days)assert.ok(svg.includes(day.date));
  assert.ok(svg.includes('700')&&svg.includes('代码足迹'));
  const base='Header\n<!-- GITHUB:START -->\n<!-- GITHUB:END -->\n<!-- LEETCODE:START -->Keep my card<!-- LEETCODE:END -->\nFooter';
  const result=renderGithubReadme(base,s,svg);
  assert.ok(result.endsWith('<!-- LEETCODE:START -->Keep my card<!-- LEETCODE:END -->\nFooter'));
  assert.ok(result.startsWith('Header\n'));
  assert.notEqual(result,renderGithubReadme(base,s,svg+'\n'));
  assert.throws(()=>renderGithubReadme('missing markers',s,svg));
});

test('fetch and validation failure preserve files; successful refresh leaves other card intact',async()=>{
  const root=await mkdtemp(join(tmpdir(),'github-profile-'));
  try {
    await mkdir(join(root,'assets'));await mkdir(join(root,'data'));
    const readme='Header\n<!-- GITHUB:START -->\n<!-- GITHUB:END -->\nLeetCode unchanged';
    await writeFile(join(root,'README.md'),readme);await writeFile(join(root,'assets/github-contributions.svg'),'old SVG');await writeFile(join(root,'data/github-contributions.json'),'old JSON');
    for(const load of [async()=>{throw Error('offline');},async()=>({})]) {
      await assert.rejects(refreshGithub({root,now,load}));
      assert.equal(await readFile(join(root,'README.md'),'utf8'),readme);assert.equal(await readFile(join(root,'assets/github-contributions.svg'),'utf8'),'old SVG');assert.equal(await readFile(join(root,'data/github-contributions.json'),'utf8'),'old JSON');
    }
    await refreshGithub({root,now,load:async()=>fixture()});
    assert.ok((await readFile(join(root,'README.md'),'utf8')).endsWith('LeetCode unchanged'));
    assert.equal(JSON.parse(await readFile(join(root,'data/github-contributions.json'),'utf8')).days.length,370);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('github-profile-'));
    await rm(root,{recursive:true,force:true});
  }
});
