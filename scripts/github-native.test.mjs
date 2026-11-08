import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir,mkdtemp,rm,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,basename,resolve } from 'node:path';
import { normalizeGithub,fetchGithubContributions,renderGithubReadme } from './github-contributions.mjs';
import { refreshGithub } from './update-github.mjs';

const now=new Date('2026-11-06T08:00:00Z');
const endpoint='https://github.com/users/8aus1R/contributions';
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
function fixture({zero=false,from='2025-11-02',to='2026-11-06',graphFrom=from}={}) {
  const start=Date.parse(`${from}T00:00:00Z`);
  const length=(Date.parse(`${to}T00:00:00Z`)-start)/86400000+1;
  const days=Array.from({length},(_,i)=>{
    const d=new Date(start+i*86400000),count=!zero&&[0,1,2,length-3,length-2,length-1].includes(i)?1:0;
    const n=d.getUTCDate(),suffix=n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]??'th');
    return `<td class="ContributionCalendar-day" data-date="${d.toISOString().slice(0,10)}" id="day-${i}" data-level="${count?1:0}"></td><tool-tip for="day-${i}">${count?'1 contribution':'No contributions'} on ${monthNames[d.getUTCMonth()]} ${n}${suffix}.</tool-tip>`;
  });
  return `<h2 id="js-contribution-activity-description">\n ${zero?0:6}\n contributions in the last year\n</h2><div data-url="/8aus1R" data-graph-url="/users/8aus1R/contributions" data-from="${graphFrom} 00:00:00 UTC" data-to="${to} 23:59:59 UTC">${days.reverse().join('\n')}</div>`;
}

test('Sunday rollover uses the complete 365-day calendar when graph metadata retains the previous week',async()=>{
  const sunday=new Date('2026-11-08T09:00:00Z');
  const html=fixture({from:'2025-11-09',to:'2026-11-08',graphFrom:'2025-11-02'});
  const s=normalizeGithub(html,sunday);
  assert.deepEqual(s.range,{from:'2025-11-09',to:'2026-11-08',timezone:'UTC'});
  assert.equal(s.days.length,365);assert.equal(s.total_contributions,6);
  assert.equal(s.active_days,6);assert.equal(s.longest_streak,3);assert.equal(s.recent_30_days,3);
  const root=await mkdtemp(join(tmpdir(),'github-native-'));
  try {
    await writeFile(join(root,'README.md'),'<!-- GITHUB:START -->old<!-- GITHUB:END -->');
    await refreshGithub({root,now:sunday,load:async()=>html});
    const svg=await readFile(join(root,'assets/github-contributions.svg'),'utf8');
    assert.equal((svg.match(/data-date=/g)??[]).length,365);
    assert.ok(!svg.includes('2025-11-02'));assert.ok(svg.includes('2025-11-09'));
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('github-native-'));
    await rm(root,{recursive:true,force:true});
  }
});

test('Sunday rollover still rejects missing dates, missing tooltips and inconsistent totals',()=>{
  const html=fixture({from:'2025-11-09',to:'2026-11-08',graphFrom:'2025-11-02'});
  for(const invalid of [
    html.replace(/<td[^>]*id="day-1"[^>]*><\/td>/,''),
    html.replace('data-date="2025-11-10"','data-date="2025-11-09"'),
    html.replace(/<tool-tip for="day-0">.*?<\/tool-tip>/,''),
    html.replace('6\n contributions','7\n contributions'),
    html.replace('data-from="2025-11-02','data-from="2025-10-26'),
  ]) assert.throws(()=>normalizeGithub(invalid,new Date('2026-11-08T09:00:00Z')));
  // A missing leading week on other weekdays is not the observed Sunday boundary.
  assert.throws(()=>normalizeGithub(fixture({from:'2025-11-09',graphFrom:'2025-11-02'}),now));
});

test('native calendar keeps its full window and derives all metrics from actual date cells',()=>{
  const s=normalizeGithub(fixture(),now);
  assert.deepEqual(s.range,{from:'2025-11-02',to:'2026-11-06',timezone:'UTC'});
  assert.equal(s.source,endpoint);assert.equal(s.days.length,370);
  assert.equal(s.total_contributions,6);assert.equal(s.active_days,6);
  assert.equal(s.longest_streak,3);assert.equal(s.recent_30_days,3);
  assert.equal(s.days[0].date,'2025-11-02');assert.equal(s.days[0].count,1);
  assert.equal(s.days.at(-1).weekday,5);
});

test('native zero year and Shanghai next-day refresh are valid',()=>{
  const s=normalizeGithub(fixture({zero:true}),new Date('2026-11-06T16:00:00Z'));
  assert.equal(s.total_contributions,0);assert.equal(s.longest_streak,0);
  assert.equal(s.date,'2026-11-07');assert.equal(s.range.to,'2026-11-06');
});

test('native DOM account, total, date bounds, cells and tooltips fail closed',()=>{
  const html=fixture();
  const invalid=[
    html.replace('data-url="/8aus1R"','data-url="/another-user"'),
    html.replace('6\n contributions','7\n contributions'),
    html.replace('data-to="2026-11-06 23:59:59 UTC"','data-to="2026-11-05 23:59:59 UTC"'),
    html.replace('data-from="2025-11-02 00:00:00 UTC"','data-from="2025-11-03 00:00:00 UTC"'),
    html.replace(/<td[^>]*id="day-1"[^>]*><\/td>/,''),
    html.replace('data-date="2025-11-03"','data-date="2025-11-02"'),
    html.replace('id="day-1"','id="day-0"'),
    html.replace(/<tool-tip for="day-0">.*?<\/tool-tip>/,''),
    html.replace('1 contribution on November 2nd.','1 contribution on December 2nd.'),
    html.replace('1 contribution on November 2nd.','-1 contributions on November 2nd.'),
    html.replace('for="day-0"','for="wrong-id"'),
    html+'<tool-tip for="day-0">1 contribution on November 2nd.</tool-tip>',
    html.replace('id="day-0" data-level="1"','id="day-0" data-level="0"'),
    html.replace('1 contribution on November 2nd.','9007199254740992 contributions on November 2nd.'),
    html+'<h2 id="js-contribution-activity-description">6 contributions in the last year</h2>',
  ];
  for(const [i,value] of invalid.entries()) assert.throws(()=>normalizeGithub(value,now),`invalid fixture ${i}`);
});

test('public native fetch sends no credentials or token and rejects redirected/non-HTML/error responses',async()=>{
  let calls=0;
  const html=await fetchGithubContributions({attempts:1,fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,endpoint);assert.equal(options.method,'GET');
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    assert.ok(!('Authorization' in options.headers)&&!('Cookie' in options.headers));
    assert.match(options.headers['Accept-Language'],/^en/);
    return {ok:true,status:200,headers:new Headers({'content-type':'text/html; charset=utf-8'}),text:async()=>fixture()};
  }});
  assert.equal(calls,1);assert.equal(normalizeGithub(html,now).total_contributions,6);
  for(const response of [
    {ok:false,status:503},
    {ok:true,status:200,headers:new Headers({'content-type':'application/json'}),text:async()=>'{"error":"not HTML"}'},
  ]) await assert.rejects(fetchGithubContributions({attempts:1,fetchImpl:async()=>response}));
});

test('a server error retries the equivalent lowercase account URL and validates the returned calendar',async()=>{
  const urls=[];
  const html=await fetchGithubContributions({attempts:2,sleep:async()=>{},fetchImpl:async(url,options)=>{
    urls.push(url);
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    if(url===endpoint) return {ok:false,status:504};
    assert.equal(url,'https://github.com/users/8aus1r/contributions');
    return {ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>fixture()};
  }});
  assert.deepEqual(urls,[endpoint,'https://github.com/users/8aus1r/contributions']);
  assert.equal(normalizeGithub(html,now).total_contributions,6);
});

test('repeated server errors try the overview calendar without changing account or data scope',async()=>{
  const urls=[];
  const html=await fetchGithubContributions({attempts:3,sleep:async()=>{},fetchImpl:async(url,options)=>{
    urls.push(url);
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    assert.ok(!('Authorization' in options.headers)&&!('Cookie' in options.headers));
    if(url!==`${endpoint}?tab=overview`) return {ok:false,status:504};
    return {ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>fixture()};
  }});
  assert.deepEqual(urls,[endpoint,'https://github.com/users/8aus1r/contributions',`${endpoint}?tab=overview`]);
  const result=normalizeGithub(html,now);
  assert.equal(result.total_contributions,6);assert.equal(result.days.length,370);
  assert.equal(result.source,endpoint);
});

test('default retries allow upstream recovery with bounded backoff and no more than five requests',async()=>{
  let calls=0;
  const delays=[];
  const html=await fetchGithubContributions({sleep:async ms=>delays.push(ms),fetchImpl:async()=>{
    calls++;
    if(calls<5) return {ok:false,status:504};
    return {ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>fixture()};
  }});
  assert.equal(calls,5);assert.deepEqual(delays,[5000,15000,30000,60000]);
  assert.equal(normalizeGithub(html,now).total_contributions,6);
  calls=0;delays.length=0;
  await assert.rejects(fetchGithubContributions({sleep:async ms=>delays.push(ms),fetchImpl:async()=>{
    calls++;return {ok:false,status:504};
  }}),/HTTP 504/);
  assert.equal(calls,5);assert.deepEqual(delays,[5000,15000,30000,60000]);
});

test('README uses the actual native range and only replaces its bounded section',()=>{
  const s=normalizeGithub(fixture(),now);
  const readme='Header\n<!-- GITHUB:START -->old<!-- GITHUB:END -->\n<!-- LEETCODE:START -->same<!-- LEETCODE:END -->';
  const next=renderGithubReadme(readme,s,'<svg/>');
  assert.ok(next.includes('2025-11-02')&&next.includes('2026-11-06'));
  assert.ok(!next.includes('近365天'));
  assert.equal(next.split('<!-- GITHUB:START -->')[0],'Header\n');
  assert.equal(next.split('<!-- GITHUB:END -->')[1],readme.split('<!-- GITHUB:END -->')[1]);
});

test('native failures preserve files; successful refresh publishes only normalized data and its card',async()=>{
  const root=await mkdtemp(join(tmpdir(),'github-native-'));
  try {
    await mkdir(join(root,'assets'));await mkdir(join(root,'data'));
    const readme='<!-- GITHUB:START -->old<!-- GITHUB:END -->';
    await writeFile(join(root,'README.md'),readme);await writeFile(join(root,'assets/github-contributions.svg'),'old SVG');await writeFile(join(root,'data/github-contributions.json'),'old JSON');
    for(const load of [async()=>{throw Error('offline');},async()=>fixture().replace('6\n contributions','99\n contributions')]) {
      await assert.rejects(refreshGithub({root,now,load}));
      assert.equal(await readFile(join(root,'README.md'),'utf8'),readme);
      assert.equal(await readFile(join(root,'assets/github-contributions.svg'),'utf8'),'old SVG');
      assert.equal(await readFile(join(root,'data/github-contributions.json'),'utf8'),'old JSON');
    }
    const result=await refreshGithub({root,now,load:async()=>fixture()});
    assert.equal(result.total_contributions,6);assert.equal(result.days.length,370);
    const published=await readFile(join(root,'data/github-contributions.json'),'utf8');
    assert.equal(JSON.parse(published).source,endpoint);assert.ok(!published.includes('<td'));
    assert.deepEqual((await readdir(root)).sort(),['README.md','assets','data']);
    assert.deepEqual(await readdir(join(root,'assets')),['github-contributions.svg']);
    assert.deepEqual(await readdir(join(root,'data')),['github-contributions.json']);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('github-native-'));
    await rm(root,{recursive:true,force:true});
  }
});
