import { createHash } from 'node:crypto';
import { chinaDate } from './leetcode.mjs';

export const USERNAME='8aus1R';
const DAY=86400000;
const LEVELS={NONE:0,FIRST_QUARTILE:1,SECOND_QUARTILE:2,THIRD_QUARTILE:3,FOURTH_QUARTILE:4};
const QUERY=`query ProfileContributions($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    login
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel weekday } }
      }
    }
  }
}`;

export function contributionRange(now=new Date()) {
  const to=now.toISOString().slice(0,10);
  const from=new Date(Date.parse(`${to}T00:00:00Z`)-364*DAY).toISOString().slice(0,10);
  return {from,to};
}

export async function fetchGithubContributions({now=new Date(),token=process.env.GITHUB_TOKEN,fetchImpl=fetch,attempts=3}={}) {
  if (typeof token!=='string'||!token.trim()) throw new Error('GITHUB_TOKEN is required in the GitHub Actions job');
  const range=contributionRange(now);
  const body=JSON.stringify({query:QUERY,variables:{login:USERNAME,from:`${range.from}T00:00:00Z`,to:now.toISOString()}});
  for (let attempt=0;attempt<attempts;attempt++) {
    try {
      const response=await fetchImpl('https://api.github.com/graphql',{
        method:'POST',credentials:'omit',redirect:'error',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json','User-Agent':'8aus1R-profile-card'},
        body,signal:AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
      const payload=await response.json();
      if (payload.errors?.length||!payload.data?.user) throw new Error('GitHub returned GraphQL errors or no user data');
      return payload.data;
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
function count(value) {return Number.isSafeInteger(value)&&value>=0;}

export function normalizeGithub(data,now=new Date()) {
  check(data?.user?.login?.toLowerCase()===USERNAME.toLowerCase(),'account mismatch');
  const calendar=data.user.contributionsCollection?.contributionCalendar;
  check(count(calendar?.totalContributions),'total contributions');
  check(Array.isArray(calendar.weeks)&&calendar.weeks.length>0,'calendar weeks');
  const range=contributionRange(now);
  const days=[];
  for(const week of calendar.weeks) {
    check(Array.isArray(week.contributionDays),'week days');
    for(const d of week.contributionDays) {
      check(validDate(d.date),'date');
      // API calendars can have partial weeks. Never invent contributions for padding.
      if(d.date<range.from||d.date>range.to) continue;
      check(count(d.contributionCount),`count on ${d.date}`);
      check(Object.hasOwn(LEVELS,d.contributionLevel),`level on ${d.date}`);
      const weekday=new Date(`${d.date}T00:00:00Z`).getUTCDay();
      check(d.weekday===weekday,`weekday on ${d.date}`);
      check((d.contributionCount===0)===(d.contributionLevel==='NONE'),`count/level on ${d.date}`);
      days.push({date:d.date,count:d.contributionCount,level:LEVELS[d.contributionLevel],weekday});
    }
  }
  days.sort((a,b)=>a.date.localeCompare(b.date));
  check(days.length===365,`expected 365 dates, received ${days.length}`);
  const first=Date.parse(`${range.from}T00:00:00Z`);
  for(let i=0;i<days.length;i++) check(days[i].date===new Date(first+i*DAY).toISOString().slice(0,10),`missing or duplicate date at ${i}`);
  const total=days.reduce((sum,d)=>sum+d.count,0);
  check(total===calendar.totalContributions,'daily sum does not match API total');
  let streak=0,longest=0;
  for(const d of days) {streak=d.count>0?streak+1:0;longest=Math.max(longest,streak);}
  return {
    username:USERNAME,source:'https://api.github.com/graphql',profile:`https://github.com/${USERNAME}`,
    visibility:'publicly_visible',date:chinaDate(now),range,
    total_contributions:total,active_days:days.filter(d=>d.count>0).length,longest_streak:longest,
    recent_30_days:days.slice(-30).reduce((sum,d)=>sum+d.count,0),days,
  };
}

export function renderGithubReadme(readme,snapshot,svg) {
  const start='<!-- GITHUB:START -->',end='<!-- GITHUB:END -->';
  if(readme.split(start).length!==2||readme.split(end).length!==2||readme.indexOf(start)>readme.indexOf(end)) throw new Error('README GitHub markers must occur exactly once in order');
  const hash=createHash('sha256').update(svg).digest('hex').slice(0,12);
  const alt=`GitHub 近365天公开可见贡献：${snapshot.total_contributions}次，活跃${snapshot.active_days}天，最长连续${snapshot.longest_streak}天，近30天${snapshot.recent_30_days}次；${snapshot.date}同步。`;
  const block=`${start}\n<a href="https://github.com/${USERNAME}?tab=overview">\n  <img src="./assets/github-contributions.svg?v=${hash}" width="700" alt="${alt}" />\n</a>\n${end}`;
  return readme.slice(0,readme.indexOf(start))+block+readme.slice(readme.indexOf(end)+end.length);
}
