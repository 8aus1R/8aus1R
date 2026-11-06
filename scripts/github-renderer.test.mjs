import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGithubCard } from './github-card.mjs';

const DAY_MS = 86_400_000;
const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10);

function snapshot({ from = '2025-11-02', length = 370, to, date } = {}) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const size = to ? (Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS + 1 : length;
  const days = Array.from({ length: size }, (_, index) => {
    const timestamp = start + index * DAY_MS;
    return { date: iso(timestamp), count: index % 11 === 0 ? 3 : 0, level: index % 11 === 0 ? 2 : 0, weekday: new Date(timestamp).getUTCDay() };
  });
  const end = days.at(-1).date;
  return {
    username: '8aus1R', date: date ?? end,
    range: { from, to: end, timezone: 'UTC' },
    total_contributions: days.reduce((total, day) => total + day.count, 0),
    active_days: days.filter(day => day.count > 0).length,
    longest_streak: 1,
    recent_30_days: days.slice(-30).reduce((total, day) => total + day.count, 0),
    days,
  };
}

function cells(svg) {
  return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*data-date="([\d-]+)" data-count="(\d+)"/g)]
    .map(([, x, y, date, count]) => ({ x: Number(x), y: Number(y), date, count: Number(count) }));
}

test('renders the complete native calendar at 365, 366, 370 and 372 days without future boxes', () => {
  for (const length of [365, 366, 370, 372]) {
    const input = snapshot({ length });
    const original = structuredClone(input);
    const svg = renderGithubCard(input);
    const drawn = cells(svg);
    assert.equal(drawn.length, length);
    assert.deepEqual(drawn.map(day => day.date), input.days.map(day => day.date));
    assert.equal(new Set(drawn.map(day => day.x)).size, Math.ceil(length / 7));
    assert.ok(drawn.every(day => day.x >= 68 && day.x + 8 <= 648));
    assert.equal(drawn[0].y, 274);
    assert.match(svg, /width="700" height="390"/);
    assert.match(svg, /公开与匿名私有贡献/);
    assert.match(svg, /过去一年/);
    assert.doesNotMatch(svg, /过去 365 天|近一年贡献/);
    assert.deepEqual(input, original);
  }
});

test('a leap-day window end uses UTC Thursday with no March padding', () => {
  const svg = renderGithubCard(snapshot({ from: '2023-02-26', to: '2024-02-29' }));
  const drawn = cells(svg);
  assert.equal(drawn.at(-1).date, '2024-02-29');
  assert.equal(drawn.at(-1).y, 274 + 4 * 11);
  assert.ok(!drawn.some(day => day.date >= '2024-03-01'));
});

test('a window spanning leap day keeps every calendar date exactly once', () => {
  const drawn = cells(renderGithubCard(snapshot({ from: '2023-03-05', length: 365 })));
  const leapIndex = drawn.findIndex(day => day.date === '2024-02-29');
  assert.equal(drawn[leapIndex - 1].date, '2024-02-28');
  assert.equal(drawn[leapIndex + 1].date, '2024-03-01');
  assert.equal(drawn.filter(day => day.date === '2024-02-29').length, 1);
});

test('accepts the Shanghai sync day after the UTC calendar end', () => {
  const svg = renderGithubCard(snapshot({ date: '2026-11-07' }));
  assert.match(svg, /自动同步于 2026-11-07/);
  assert.equal(cells(svg).at(-1).date, '2026-11-06');
});

test('month labels stay separated when the first Sunday is the last day of a month', () => {
  const svg = renderGithubCard(snapshot({ from: '2025-11-30' }));
  const labels = [...svg.matchAll(/<text x="([\d.]+)" y="263"[^>]*>(\d+)月<\/text>/g)];
  assert.equal(labels[0][2], '12');
  for (let index = 1; index < labels.length; index++) {
    assert.ok(Number(labels[index][1]) - Number(labels[index - 1][1]) >= 32);
  }
});

test('rejects lengths outside the native window and non-Sunday starts', () => {
  for (const length of [364, 373]) assert.throws(() => renderGithubCard(snapshot({ length })), /365.*372/);
  assert.throws(() => renderGithubCard(snapshot({ from: '2025-11-03' })), /Sunday/);
});

test('rejects inconsistent, duplicate, missing and unsorted calendar dates', () => {
  for (const mutate of [
    input => { input.range.to = '2026-11-05'; },
    input => { input.days.pop(); },
    input => { input.days[1] = { ...input.days[0] }; },
    input => { [input.days[1], input.days[2]] = [input.days[2], input.days[1]]; },
  ]) {
    const input = snapshot();
    mutate(input);
    assert.throws(() => renderGithubCard(input), /days|range/);
  }
});

test('rejects an invalid calendar date, timezone, weekday and stale/future sync date', () => {
  for (const mutate of [
    input => { input.range.from = '2025-02-29'; },
    input => { input.range.timezone = 'Asia/Shanghai'; },
    input => { delete input.range.timezone; },
    input => { input.days[0].weekday = 1; },
    input => { input.date = '2026-11-05'; },
    input => { input.date = '2026-11-08'; },
  ]) {
    const input = snapshot();
    mutate(input);
    assert.throws(() => renderGithubCard(input));
  }
});

test('rejects negative, fractional, nonnumeric and unsafe counts and invalid intensity levels', () => {
  for (const value of [-1, 0.5, '3', NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const input = snapshot();
    input.days[0].count = value;
    assert.throws(() => renderGithubCard(input), /safe integer/);
  }
  for (const level of [-1, 5, '2', 1.5]) {
    const input = snapshot();
    input.days[0].level = level;
    assert.throws(() => renderGithubCard(input), /integer|between/);
  }
  const input = snapshot();
  input.active_days = -1;
  assert.throws(() => renderGithubCard(input), /safe integer/);
});

test('escapes account text and includes each exact day count in its hover title', () => {
  const input = snapshot();
  input.username = 'A<&"\'>';
  const svg = renderGithubCard(input);
  assert.match(svg, /A&lt;&amp;&quot;&apos;&gt;/);
  assert.doesNotMatch(svg, /A<&/);
  assert.match(svg, /<title>2025-11-02 · 3 次贡献<\/title>/);
});
