import { createHash } from 'node:crypto';

export const USER_SLUG = '8aus1rchas1n0cl0ut';
export const PROFILE_URL = `https://leetcode.cn/u/${USER_SLUG}/`;
const STATS_QUERY = `query PublicProfileStats($userSlug: String!, $userSlugs: [String!]!, $size: Int!) {
  userProfileUserQuestionProgress(userSlug: $userSlug) { numAcceptedQuestions { count difficulty } }
  userProfileUserQuestionSubmitStats(userSlug: $userSlug) {
    acSubmissionNum { difficulty count }
    totalSubmissionNum { difficulty count }
  }
  profileCommunityAchievement(size: $size, userSlug: $userSlug) { date voteCount viewCount favoriteCount }
  reputationUserReputations(userSlugs: $userSlugs) { level }
}`;
const CONTEST_QUERY = `query PublicContest($userSlug: String!) {
  userContestRanking(userSlug: $userSlug) { rating topPercentage }
  userProfileUserLevelMedal(userSlug: $userSlug) { current { name } }
}`;

export async function fetchPublicData(fetchImpl = fetch, { attempts = 3 } = {}) {
  async function query(endpoint, queryText, variables) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST', credentials: 'omit', redirect: 'error',
          headers: {'Content-Type':'application/json', Accept:'application/json', Referer:PROFILE_URL},
          body: JSON.stringify({query:queryText, variables}),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error(`LeetCode HTTP ${response.status}`);
        const payload = await response.json();
        if (payload.errors?.length || !payload.data) throw new Error('LeetCode returned GraphQL errors or no data');
        return payload.data;
      } catch (error) {
        if (attempt === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  const [stats, contest] = await Promise.all([
    query('https://leetcode.cn/graphql/',STATS_QUERY,{userSlug:USER_SLUG,userSlugs:[USER_SLUG],size:2}),
    query('https://leetcode.cn/graphql/noj-go/',CONTEST_QUERY,{userSlug:USER_SLUG}),
  ]);
  return {stats,contest};
}

function requireValue(condition, message) {
  if (!condition) throw new Error(`Invalid LeetCode data: ${message}`);
}
function count(value, name) {
  requireValue(Number.isSafeInteger(value) && value >= 0,name);
  return value;
}
function difficulties(rows, name) {
  requireValue(Array.isArray(rows),name);
  return Object.fromEntries(['EASY','MEDIUM','HARD'].map(difficulty=>{
    const found=rows.filter(row=>row.difficulty===difficulty);
    requireValue(found.length===1,`${name}.${difficulty}`);
    return [difficulty.toLowerCase(),count(found[0].count,`${name}.${difficulty}.count`)];
  }));
}
function total(values) {return Object.values(values).reduce((sum,n)=>sum+n,0);}
function compact(n) {return n>=1e6 ? `${(n/1e6).toFixed(1)}M` : n>=1000 ? `${(n/1000).toFixed(1)}K` : String(n);}
function validDate(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function chinaDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function normalize(stats, contestData, date) {
  requireValue(validDate(date),'refresh date');
  const solved=difficulties(stats?.userProfileUserQuestionProgress?.numAcceptedQuestions,'solved');
  const accepted=difficulties(stats?.userProfileUserQuestionSubmitStats?.acSubmissionNum,'accepted submissions');
  const submissions=difficulties(stats?.userProfileUserQuestionSubmitStats?.totalSubmissionNum,'total submissions');
  for (const difficulty of ['easy','medium','hard']) {
    requireValue(solved[difficulty]<=accepted[difficulty] && accepted[difficulty]<=submissions[difficulty],`submission consistency (${difficulty})`);
  }
  const attempted=total(submissions);
  requireValue(attempted>0,'no submissions returned for this established account');
  requireValue(total(solved)>0,'no solved questions returned for this established account');
  const rows=stats?.profileCommunityAchievement;
  requireValue(Array.isArray(rows)&&rows.length>0,'community history');
  requireValue(rows.every(row=>validDate(row.date)&&row.date<=date),'community dates');
  const latest=[...rows].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const views=count(latest.viewCount,'community views');
  const likes=count(latest.voteCount,'community likes');
  const favorites=count(latest.favoriteCount,'community favorites');
  requireValue(stats?.reputationUserReputations?.length===1,'reputation');
  const level=count(stats.reputationUserReputations[0].level,'reputation level');
  const contest=contestData?.userContestRanking;
  requireValue(Number.isFinite(contest?.rating)&&contest.rating>=0,'contest rating');
  requireValue(Number.isFinite(contest.topPercentage)&&contest.topPercentage>=0&&contest.topPercentage<=100,'contest percentage');
  const medal=contestData?.userProfileUserLevelMedal;
  requireValue(medal && Object.hasOwn(medal,'current'),'contest medal');
  const tier=medal.current===null ? null : medal.current?.name;
  requireValue(tier===null||(typeof tier==='string'&&tier.trim().length>0&&tier.length<60),'contest tier');
  return {
    source:PROFILE_URL,date,
    solved:{total:total(solved),...solved},
    acceptance_rate_percent:Number((total(accepted)/attempted*100).toFixed(2)),
    submissions:{accepted:total(accepted),total:attempted},
    community:{source_date:latest.date,views,likes,favorites,views_display:compact(views),likes_display:compact(likes),reputation_level:`L${level}`},
    contest:{rating:Math.round(contest.rating),rating_raw:contest.rating,tier,top_percent_display:`${contest.topPercentage.toFixed(2)}%`},
  };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
}
function describe(s) {
  return `力扣数据面板，${s.date}同步：${s.solved.total}题，简单${s.solved.easy}、中等${s.solved.medium}、困难${s.solved.hard}；通过率${s.acceptance_rate_percent.toFixed(2)}%；阅读${s.community.views_display}、获赞${s.community.likes_display}、收藏${s.community.favorites}、声望${s.community.reputation_level}。`;
}
export function renderCard(template, s) {
  const replacements={description:describe(s),solved_total:s.solved.total,solved_easy:s.solved.easy,solved_medium:s.solved.medium,solved_hard:s.solved.hard,acceptance_rate:`${s.acceptance_rate_percent.toFixed(2)}%`,views:s.community.views_display,likes:s.community.likes_display,favorites:s.community.favorites,level:s.community.reputation_level,date:s.date};
  const rendered=template.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{
    if (!Object.hasOwn(replacements,key)) throw new Error(`Unknown SVG template field: ${key}`);
    return escapeXml(replacements[key]);
  });
  requireValue(!rendered.includes('{{'),'unresolved SVG template');
  return rendered;
}

export function renderReadme(readme,s,svg) {
  const start='<!-- LEETCODE:START -->',end='<!-- LEETCODE:END -->';
  if (readme.split(start).length!==2||readme.split(end).length!==2||readme.indexOf(start)>readme.indexOf(end)) throw new Error('README LeetCode markers must occur exactly once in order');
  const version=createHash('sha256').update(svg).digest('hex').slice(0,12);
  const contest=[s.contest.tier,String(s.contest.rating),`Top ${s.contest.top_percent_display}`].filter(Boolean).map(escapeXml).join(' &nbsp; · &nbsp; ');
  const block=`${start}\n<a href="${PROFILE_URL}">\n  <img src="./assets/leetcode-live.svg?v=${version}" width="700" alt="${escapeXml(describe(s))}" />\n</a>\n\n<p><a href="${PROFILE_URL}"><strong>${contest}</strong></a></p>\n${end}`;
  return readme.slice(0,readme.indexOf(start))+block+readme.slice(readme.indexOf(end)+end.length);
}
