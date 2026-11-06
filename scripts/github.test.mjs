import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,basename,resolve } from 'node:path';
import { contributionRange,fetchGithubContributions,normalizeGithub,renderGithubReadme } from './github-contributions.mjs';
import { renderGithubCard } from './github-card.mjs';
import { refreshGithub } from './update-github.mjs';

const now=new Date('2026-11-06T07:00:00Z');
function fixture(time=now) {
  const range=contributionRange(time),start=Date.parse(range.from);
  const contributionDays=Array.from({length:365},(_,i)=>{
    const date=new Date(start+i*86400000),n=([0,1,2,3,335,336,364].includes(i)?2:0);
    return {date:date.toISOString().slice(0,10),contributionCount:n,contributionLevel:n?'FIRST_QUARTILE':'NONE',weekday:date.getUTCDay()};
  });
  return {user:{login:'8aus1R',contributionsCollection:{contributionCalendar:{totalContributions:14,weeks:[{contributionDays}]}}}};
}
const calendar=x=>x.user.contributionsCollection.contributionCalendar;

test('UTC range is exactly 365 days, including leap years and midnight in China',()=>{
  assert.deepEqual(contributionRange(now),{from:'2025-11-07',to:'2026-11-06'});
  assert.deepEqual(contributionRange(new Date('2024-03-01T00:00:00Z')),{from:'2023-03-03',to:'2024-03-01'});
  assert.equal(contributionRange(new Date('2026-11-06T16:00:00Z')).to,'2026-11-06');
});

test('daily counts drive total, active days, longest streak and inclusive last 30 days',()=>{
  const s=normalizeGithub(fixture(),now);
  assert.equal(s.total_contributions,14);assert.equal(s.active_days,7);assert.equal(s.longest_streak,4);assert.equal(s.recent_30_days,6);
  assert.equal(s.days.length,365);assert.equal(s.days[364].weekday,5);
});

test('a Beijing next-day refresh keeps UTC dates and still renders successfully',()=>{
  const midnight=new Date('2026-11-06T16:00:00Z');
  const s=normalizeGithub(fixture(midnight),midnight);
  assert.equal(s.date,'2026-11-07');assert.equal(s.range.to,'2026-11-06');
  assert.ok(renderGithubCard(s).includes('2026-11-07'));
});

test('wrong account, missing dates, duplicates, bad totals and invalid values fail',()=>{
  for(const mutate of [x=>x.user.login='another-user',x=>calendar(x).weeks[0].contributionDays.pop(),x=>calendar(x).weeks[0].contributionDays[1]=calendar(x).weeks[0].contributionDays[0],x=>calendar(x).totalContributions=99,x=>calendar(x).weeks[0].contributionDays[0].contributionCount=null,x=>calendar(x).weeks[0].contributionDays[0].weekday=99]) {
    const x=fixture();mutate(x);assert.throws(()=>normalizeGithub(x,now));
  }
});

test('an all-zero year is valid and partial-week padding is excluded',()=>{
  const x=fixture();calendar(x).totalContributions=0;
  for(const d of calendar(x).weeks[0].contributionDays){d.contributionCount=0;d.contributionLevel='NONE';}
  calendar(x).weeks[0].contributionDays.push({date:'2026-11-07',contributionCount:123,contributionLevel:'FOURTH_QUARTILE',weekday:6});
  const s=normalizeGithub(x,now);assert.equal(s.total_contributions,0);assert.equal(s.longest_streak,0);assert.equal(s.days.length,365);
});

test('API credentials only go to GitHub; GraphQL and HTTP errors are rejected',async()=>{
  let calls=0;
  const raw=await fetchGithubContributions({now,token:'test-token',attempts:1,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.github.com/graphql');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer test-token');
    const v=JSON.parse(options.body).variables;assert.equal(v.login,'8aus1R');assert.equal(v.from,'2025-11-07T00:00:00Z');
    return {ok:true,json:async()=>({data:fixture()})};
  }});
  assert.equal(calls,1);assert.equal(normalizeGithub(raw,now).total_contributions,14);
  await assert.rejects(fetchGithubContributions({token:'',attempts:1}));
  await assert.rejects(fetchGithubContributions({token:'test-token',attempts:1,fetchImpl:async()=>({ok:false,status:403})}));
  await assert.rejects(fetchGithubContributions({token:'test-token',attempts:1,fetchImpl:async()=>({ok:true,json:async()=>({errors:[{message:'not available'}]})})}));
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
    assert.equal(JSON.parse(await readFile(join(root,'data/github-contributions.json'),'utf8')).days.length,365);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('github-profile-'));
    await rm(root,{recursive:true,force:true});
  }
});
