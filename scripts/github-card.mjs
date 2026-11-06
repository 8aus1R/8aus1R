const DAY_MS = 86_400_000;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC','Microsoft YaHei',sans-serif";
const HEAT_COLORS = ['#1f2a3c', '#254d65', '#2b8291', '#34d6c4', '#a596ec'];

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function utcDay(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name} must be an ISO calendar date`);
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${name} is not a valid calendar date`);
  }
  return timestamp;
}

function nonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
  return value;
}

/** Render 365 UTC contribution days; snapshot.date is the Asia/Shanghai sync date. */
export function renderGithubCard(snapshot) {
  if (!snapshot || typeof snapshot.username !== 'string' || !snapshot.username.trim()) {
    throw new TypeError('snapshot.username is required');
  }
  const from = utcDay(snapshot.range?.from, 'range.from');
  const to = utcDay(snapshot.range?.to, 'range.to');
  const updated = utcDay(snapshot.date, 'date');
  if (to - from !== 364 * DAY_MS) {
    throw new RangeError('range must contain exactly 365 UTC days');
  }
  if (updated !== to && updated !== to + DAY_MS) {
    throw new RangeError('snapshot.date must equal the UTC range end or the following Asia/Shanghai date');
  }
  if (!Array.isArray(snapshot.days) || snapshot.days.length !== 365) {
    throw new RangeError('snapshot.days must contain exactly 365 days');
  }
  const startWeekday = new Date(from).getUTCDay();
  const months = [];
  let previousMonth = -1;
  const cells = snapshot.days.map((day, index) => {
    const timestamp = utcDay(day.date, `days[${index}].date`);
    if (timestamp !== from + index * DAY_MS) {
      throw new RangeError('snapshot.days must be sorted, consecutive, and match range');
    }
    const date = new Date(timestamp);
    const weekday = date.getUTCDay();
    if (day.weekday !== weekday) {
      throw new RangeError(`days[${index}].weekday must match the UTC date`);
    }
    const count = nonnegativeInteger(day.count, `days[${index}].count`);
    const level = nonnegativeInteger(day.level, `days[${index}].level`);
    if (level > 4) throw new RangeError('day.level must be between 0 and 4');
    const column = Math.floor((index + startWeekday) / 7);
    const x = 68 + column * 11;
    const y = 274 + weekday * 11;
    const month = date.getUTCMonth();
    if (month !== previousMonth) {
      months.push({ column, month: month + 1, partial: index === 0 && date.getUTCDate() !== 1 });
      previousMonth = month;
    }
    return `<rect x="${x}" y="${y}" width="8" height="8" rx="1.5" fill="${HEAT_COLORS[level]}" data-date="${escapeXml(day.date)}" data-count="${count}"><title>${escapeXml(`${day.date} · ${count} 次公开可见贡献`)}</title></rect>`;
  });

  // A range starting near month-end can put two labels in the same week.
  // Prefer the first complete month, and keep every label at least three columns apart.
  const spacedMonths = [];
  for (const month of months) {
    const previous = spacedMonths.at(-1);
    if (previous && month.column - previous.column < 3) {
      if (!previous.partial) continue;
      spacedMonths.pop();
    }
    spacedMonths.push(month);
  }
  const monthLabels = spacedMonths.map(({ column, month }) =>
    `<text x="${68 + column * 11}" y="263" font-size="10" fill="#8fa8c7">${escapeXml(`${month}月`)}</text>`);

  const metrics = [
    ['近一年贡献', snapshot.total_contributions],
    ['活跃天数', snapshot.active_days],
    ['最长连续天数', snapshot.longest_streak],
    ['近 30 天', snapshot.recent_30_days],
  ].map(([label, value], index) => {
    const count = nonnegativeInteger(value, label);
    const x = 45 + index * 164;
    const formatted = new Intl.NumberFormat('en-US').format(count);
    // Keep large totals inside their column without changing the usual layout.
    const fontSize = formatted.length > 7 ? 23 : formatted.length > 5 ? 29 : 38;
    return `<text x="${x}" y="125" font-size="14" fill="#bea7ea">${escapeXml(label)}</text>
    <text x="${x}" y="177" font-size="${fontSize}" font-weight="700" fill="#34d6c4">${escapeXml(formatted)}</text>`;
  });
  const description = `${snapshot.username} 的公开可见 GitHub 贡献，${snapshot.range.from} 至 ${snapshot.range.to}：近一年贡献 ${snapshot.total_contributions} 次，活跃 ${snapshot.active_days} 天，最长连续 ${snapshot.longest_streak} 天，近 30 天 ${snapshot.recent_30_days} 次。按 UTC 日期绘制 365 天热力图。`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="390" viewBox="0 0 700 390" role="img" aria-labelledby="title desc">
  <title id="title">GitHub · 代码足迹</title>
  <desc id="desc">${escapeXml(description)}</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#161a2b"/><stop offset="1" stop-color="#101a2b"/></linearGradient>
    <linearGradient id="upper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e2031"/><stop offset="1" stop-color="#1a2032"/></linearGradient>
    <linearGradient id="lower" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#152c45"/><stop offset="1" stop-color="#10243a"/></linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4dc9ed"/><stop offset="1" stop-color="#8385fa"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="698" height="388" rx="17" fill="url(#background)" stroke="#37445d"/>
  <g font-family="${FONT}">
    <rect x="29" y="27" width="5" height="29" rx="2.5" fill="url(#accent)"/>
    <text x="47" y="49" font-size="24" font-weight="700" fill="#ebf4ff">GitHub · 代码足迹</text>
    <text x="47" y="72" font-size="12" fill="#8fa8c7">${escapeXml(snapshot.username)} / 公开可见贡献</text>
    <rect x="24" y="94" width="652" height="106" rx="13" fill="url(#upper)" stroke="#30354b"/>
    <path d="M196 113V182 M360 113V182 M524 113V182" stroke="#3b4057" fill="none"/>
    ${metrics.join('\n    ')}
    <rect x="24" y="214" width="652" height="145" rx="13" fill="url(#lower)" stroke="#31506e"/>
    <text x="45" y="242" font-size="17" font-weight="700" fill="#84adff">过去 365 天</text>
    <text x="652" y="242" text-anchor="end" font-size="12" fill="#8fa8c7">${escapeXml(snapshot.range.from)} — ${escapeXml(snapshot.range.to)}</text>
    <text x="45" y="292" font-size="10" fill="#8fa8c7">一</text>
    <text x="45" y="314" font-size="10" fill="#8fa8c7">三</text>
    <text x="45" y="336" font-size="10" fill="#8fa8c7">五</text>
    ${monthLabels.join('\n    ')}
    ${cells.join('\n    ')}
    <text x="29" y="381" font-size="11" fill="#819bb9">自动同步于 ${escapeXml(snapshot.date)} · GitHub 按 UTC 统计</text>
  </g>
</svg>\n`;
}
