import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { normalize, renderCard, renderReadme, chinaDate, fetchPublicData } from './leetcode.mjs';
import { refresh } from './update-leetcode.mjs';

const byDifficulty = counts => ['EASY', 'MEDIUM', 'HARD'].map((difficulty,i)=>({difficulty,count:counts[i]}));
const stats = () => ({
  userProfileUserQuestionProgress: {numAcceptedQuestions:byDifficulty([611,808,210])},
  userProfileUserQuestionSubmitStats: {acSubmissionNum:byDifficulty([1356,1838,393]),totalSubmissionNum:byDifficulty([1599,2467,570])},
  profileCommunityAchievement: [{date:'2026-11-05',viewCount:30549,voteCount:1364,favoriteCount:299},{date:'2026-11-06',viewCount:30561,voteCount:1365,favoriteCount:299}],
  reputationUserReputations:[{level:4}],
});
const contest = () => ({userContestRanking:{rating:2555.144,topPercentage:0.35},userProfileUserLevelMedal:{current:{name:'Guardian'}}});
const template = await readFile(new URL('./leetcode-card.svg',import.meta.url),'utf8');

test('public fields use accepted-question counts, submission acceptance, newest community date and API contest percentage',()=>{
  const s=normalize(stats(),contest(),'2026-11-06');
  assert.deepEqual(s.solved,{total:1629,easy:611,medium:808,hard:210});
  assert.equal(s.acceptance_rate_percent,77.37);
  assert.equal(s.community.views,30561);
  assert.equal(s.community.likes,1365);
  assert.equal(s.community.source_date,'2026-11-06');
  assert.equal(s.community.views_display,'30.6K');
  assert.equal(s.community.likes_display,'1.4K');
  assert.equal(s.contest.rating,2555);
  assert.equal(s.contest.top_percent_display,'0.35%');
});

test('missing, duplicated and inconsistent source fields fail instead of becoming zero',()=>{
  const missing=stats();missing.userProfileUserQuestionProgress.numAcceptedQuestions.pop();
  assert.throws(()=>normalize(missing,contest(),'2026-11-06'));
  const duplicate=stats();duplicate.userProfileUserQuestionProgress.numAcceptedQuestions.push({difficulty:'HARD',count:210});
  assert.throws(()=>normalize(duplicate,contest(),'2026-11-06'));
  const invalid=stats();invalid.profileCommunityAchievement[1].viewCount=null;
  assert.throws(()=>normalize(invalid,contest(),'2026-11-06'));
  const impossible=stats();impossible.userProfileUserQuestionSubmitStats.acSubmissionNum[0].count=99999;
  assert.throws(()=>normalize(impossible,contest(),'2026-11-06'));
  assert.throws(()=>normalize(stats(),{userContestRanking:null},'2026-11-06'));
});

test('classic card preserves all visual markup and handles XML text safely',()=>{
  const s=normalize(stats(),contest(),'2026-11-06');
  const svg=renderCard(template,s);
  assert.ok(svg.includes('77.37%')&&svg.includes('30.6K')&&svg.includes('1629'));
  assert.ok(!svg.includes('{{'));
  const shapes=text=>text.replace(/>([^<]*)</g,'><');
  assert.equal(shapes(svg),shapes(template));
});

test('README updates only marked section, escapes text, and changes image cache key when data changes',()=>{
  const s=normalize(stats(),contest(),'2026-11-06');
  const original='Keep this\n<!-- LEETCODE:START -->\nold\n<!-- LEETCODE:END -->\nAnd this\n';
  const one=renderReadme(original,s,renderCard(template,s));
  assert.ok(one.startsWith('Keep this\n')&&one.endsWith('\nAnd this\n'));
  assert.ok(one.includes('leetcode-live.svg?v=')&&one.includes('Guardian'));
  const two=renderReadme(original,{...s,date:'2026-11-07'},renderCard(template,{...s,date:'2026-11-07'}));
  assert.notEqual(one.match(/\?v=([a-f0-9]+)/)[1],two.match(/\?v=([a-f0-9]+)/)[1]);
  const escaped=renderReadme(original,{...s,contest:{...s.contest,tier:'A&B <test>'}},renderCard(template,s));
  assert.ok(escaped.includes('A&amp;B &lt;test&gt;'));
  assert.throws(()=>renderReadme('unmarked',s,renderCard(template,s)));
});

test('date follows Asia/Shanghai midnight',()=>{
  assert.equal(chinaDate(new Date('2026-11-06T15:59:59Z')),'2026-11-06');
  assert.equal(chinaDate(new Date('2026-11-06T16:00:00Z')),'2026-11-07');
});

test('HTTP and GraphQL failures are rejected and requests never include credentials',async()=>{
  await assert.rejects(fetchPublicData(async(url,options)=>{
    assert.equal(options.credentials,'omit');assert.ok(!options.headers.Cookie&&!options.headers.Authorization);
    return {ok:true,json:async()=>({errors:[{message:'unavailable'}]})};
  },{attempts:1}));
  await assert.rejects(fetchPublicData(async()=>({ok:false,status:503}),{attempts:1}));
});

test('failure leaves previous files byte-for-byte intact; success is deterministic on the same day',async()=>{
  const root=await mkdtemp(join(tmpdir(),'leetcode-profile-'));
  try {
    await mkdir(join(root,'scripts'));await mkdir(join(root,'assets'));await mkdir(join(root,'data'));
    await writeFile(join(root,'scripts/leetcode-card.svg'),template);
    const original='Header\n<!-- LEETCODE:START -->\nold\n<!-- LEETCODE:END -->\nFooter';
    await writeFile(join(root,'README.md'),original);
    await writeFile(join(root,'assets/leetcode-live.svg'),'previous SVG');
    await writeFile(join(root,'data/leetcode-latest.json'),'previous JSON');
    await assert.rejects(refresh({root,load:async()=>{throw Error('offline');}}));
    assert.equal(await readFile(join(root,'README.md'),'utf8'),original);
    assert.equal(await readFile(join(root,'assets/leetcode-live.svg'),'utf8'),'previous SVG');
    assert.equal(await readFile(join(root,'data/leetcode-latest.json'),'utf8'),'previous JSON');
    const options={root,load:async()=>({stats:stats(),contest:contest()}),now:new Date('2026-11-06T06:00:00Z')};
    await refresh(options);const first=await readFile(join(root,'data/leetcode-latest.json'),'utf8');
    await refresh(options);assert.equal(await readFile(join(root,'data/leetcode-latest.json'),'utf8'),first);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));
    assert.ok(basename(root).startsWith('leetcode-profile-'));
    await rm(root,{recursive:true,force:true});
  }
});
