import { createHash } from 'node:crypto';
import { chinaDate } from './leetcode.mjs';

export const USERNAME='8aus1R';
export const NATIVE_CALENDAR_URL=`https://github.com/users/${USERNAME}/contributions`;
const DAY=86400000;
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function fetchGithubContributions({fetchImpl=fetch,attempts=3}={}) {
  check(Number.isSafeInteger(attempts)&&attempts>0&&attempts<=5,'fetch attempts');
  for(let attempt=0;attempt<attempts;attempt++) {
    try {
      const response=await fetchImpl(NATIVE_CALENDAR_URL,{
        method:'GET',credentials:'omit',redirect:'error',
        headers:{Accept:'text/html','Accept-Language':'en-US,en;q=0.9','User-Agent':'8aus1R-profile-card'},
        signal:AbortSignal.timeout(20000),
      });
      if(!response.ok) throw new Error(`GitHub calendar HTTP ${response.status}`);
      if(!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??'')) throw new Error('GitHub calendar did not return HTML');
      const html=await response.text();
      check(html.length>0&&html.length<=2000000,'calendar response size');
      return html;
    } catch(error) {
      if(attempt===attempts-1) throw error;
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
  }
}

function check(condition,message) {if(!condition) throw new Error(`Invalid GitHub contribution data: ${message}`);}
function validDate(value) {
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
function textContent(value) {
  return value.replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160|#xA0);/gi,' ').replace(/\s+/g,' ').trim();
}
function attributes(text) {
  const result=Object.create(null);
  for(const match of text.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const name=match[1].toLowerCase();
    check(!Object.hasOwn(result,name),`duplicate HTML attribute ${name}`);
    result[name]=match[2]??match[3];
  }
  return result;
}
function integer(value,name) {
  check(typeof value==='string'&&/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)$/.test(value),name);
  const result=Number(value.replaceAll(',',''));
  check(Number.isSafeInteger(result)&&result>=0,name);
  return result;
}
function bound(value,time,name) {
  const match=typeof value==='string'?value.match(new RegExp(`^(\\d{4}-\\d{2}-\\d{2}) ${time} UTC$`)):null;
  check(match&&validDate(match[1]),name);
  return match[1];
}

/** Parse only the native public calendar's dates and anonymized numeric counts. */
export function parseNativeCalendar(html,now=new Date()) {
  check(typeof html==='string'&&html.length>0&&html.length<=2000000,'calendar HTML');
  const graphs=[...html.matchAll(/<div\b([^>]*)>/gi)].map(m=>attributes(m[1])).filter(a=>Object.hasOwn(a,'data-graph-url'));
  check(graphs.length===1,'one native calendar');
  const graph=graphs[0];
  check(graph['data-graph-url'].toLowerCase()===`/users/${USERNAME.toLowerCase()}/contributions`&&graph['data-url']?.toLowerCase()===`/${USERNAME.toLowerCase()}`,'account mismatch');
  const range={from:bound(graph['data-from'],'00:00:00','calendar start'),to:bound(graph['data-to'],'23:59:59','calendar end'),timezone:'UTC'};
  check(range.to===now.toISOString().slice(0,10),'calendar is not current UTC day');
  let first=Date.parse(`${range.from}T00:00:00Z`);
  const last=Date.parse(`${range.to}T00:00:00Z`);
  let expectedDays=(last-first)/DAY+1;
  check(Number.isInteger(expectedDays)&&expectedDays>=365&&expectedDays<=372,'native calendar window');
  check(new Date(first).getUTCDay()===0,'native calendar starts on Sunday');

  const headings=[...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)].filter(m=>attributes(m[1]).id==='js-contribution-activity-description');
  check(headings.length===1,'one contribution total heading');
  const heading=textContent(headings[0][2]).match(/^(No|[\d,]+) contributions? in the last year$/i);
  check(heading,'native contribution total heading');
  const declaredTotal=heading[1].toLowerCase()==='no'?0:integer(heading[1],'total contributions');

  const cells=[...html.matchAll(/<td\b([^>]*)>/gi)].map(m=>attributes(m[1])).filter(a=>(a.class??'').split(/\s+/).includes('ContributionCalendar-day')&&Object.hasOwn(a,'data-date'));
  const dates=cells.map(cell=>cell['data-date']).sort();
  // At Sunday's rollover GitHub can retain the previous leading week in
  // data-from while rendering a complete 365-day calendar starting a week later.
  // Accept only that exact boundary; every date and total is still checked below.
  if(expectedDays===372&&cells.length===365&&new Date(last).getUTCDay()===0&&
    dates[0]===new Date(first+7*DAY).toISOString().slice(0,10)&&dates.at(-1)===range.to) {
    first+=7*DAY;
    range.from=dates[0];
    expectedDays=365;
  }
  check(cells.length===expectedDays,`native day cell count: expected ${expectedDays} (${range.from}..${range.to}), received ${cells.length}; dates ${dates[0]}..${dates.at(-1)}`);
  const ids=new Set();
  for(const cell of cells) {
    check(typeof cell.id==='string'&&cell.id.length>0&&!ids.has(cell.id),'unique day cell IDs');
    ids.add(cell.id);
  }
  const tooltips=new Map();
  for(const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi)) {
    const id=attributes(match[1]).for;
    if(!ids.has(id)) continue;
    check(!tooltips.has(id),'duplicate day tooltip');
    tooltips.set(id,textContent(match[2]));
  }
  const days=cells.map(cell=>{
    const date=cell['data-date'];
    check(validDate(date)&&date>=range.from&&date<=range.to,'day date within native bounds');
    check(/^[0-4]$/.test(cell['data-level']??''),`level on ${date}`);
    const tooltip=tooltips.get(cell.id);
    const match=tooltip?.match(/^(No|[\d,]+) contributions? on ([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)(?:,? (\d{4}))?\.$/i);
    check(match,`count tooltip on ${date}`);
    const d=new Date(`${date}T00:00:00Z`);
    check(match[2].toLowerCase()===MONTHS[d.getUTCMonth()].toLowerCase()&&Number(match[3])===d.getUTCDate()&&(!match[4]||Number(match[4])===d.getUTCFullYear()),`tooltip date on ${date}`);
    const count=match[1].toLowerCase()==='no'?0:integer(match[1],`count on ${date}`),level=Number(cell['data-level']);
    check((count===0)===(level===0),`count/level on ${date}`);
    return {date,count,level,weekday:d.getUTCDay()};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  for(let i=0;i<days.length;i++) check(days[i].date===new Date(first+i*DAY).toISOString().slice(0,10),`missing or duplicate date at ${i}`);
  const total=days.reduce((sum,d)=>sum+d.count,0);
  check(Number.isSafeInteger(total)&&total===declaredTotal,'daily sum does not match native total');
  return {range,days,total};
}

export function normalizeGithub(html,now=new Date()) {
  const {range,days,total}=parseNativeCalendar(html,now);
  let streak=0,longest=0;
  for(const d of days) {streak=d.count>0?streak+1:0;longest=Math.max(longest,streak);}
  return {
    username:USERNAME,source:NATIVE_CALENDAR_URL,profile:`https://github.com/${USERNAME}`,
    visibility:'publicly_visible',date:chinaDate(now),range,
    total_contributions:total,active_days:days.filter(d=>d.count>0).length,longest_streak:longest,
    recent_30_days:days.slice(-30).reduce((sum,d)=>sum+d.count,0),days,
  };
}

export function renderGithubReadme(readme,snapshot,svg) {
  const start='<!-- GITHUB:START -->',end='<!-- GITHUB:END -->';
  if(readme.split(start).length!==2||readme.split(end).length!==2||readme.indexOf(start)>readme.indexOf(end)) throw new Error('README GitHub markers must occur exactly once in order');
  const hash=createHash('sha256').update(svg).digest('hex').slice(0,12);
  const alt=`GitHub 原生日历公开可见贡献（${snapshot.range.from}至${snapshot.range.to}）：${snapshot.total_contributions}次，活跃${snapshot.active_days}天，最长连续${snapshot.longest_streak}天，近30天${snapshot.recent_30_days}次；${snapshot.date}同步。`;
  const block=`${start}\n<a href="https://github.com/${USERNAME}?tab=overview">\n  <img src="./assets/github-contributions.svg?v=${hash}" width="700" alt="${alt}" />\n</a>\n${end}`;
  return readme.slice(0,readme.indexOf(start))+block+readme.slice(readme.indexOf(end)+end.length);
}
