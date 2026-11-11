import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildStatsView, emptyStatsView } from '../src/app/stats.js';
import { renderHours } from '../renderer/src/features/stats-charts.js';

/**
 * 最小 SVG DOM shim：只实现 stats-charts.js 用到的方法。
 * 让测试直接检查真实 renderHours 产出的节点，而不是在测试里复刻一份循环。
 */
class FakeSvgNode {
  tagName: string;
  attributes: Record<string, string> = {};
  childNodes: FakeSvgNode[] = [];
  parentNode: FakeSvgNode | null = null;
  style: Record<string, string> = {};
  rectWidth = 0;
  private text = '';
  constructor(tagName: string) {
    this.tagName = tagName;
  }
  setAttribute(k: string, v: unknown): void {
    this.attributes[k] = String(v);
  }
  appendChild(c: FakeSvgNode): FakeSvgNode {
    c.parentNode = this;
    this.childNodes.push(c);
    return c;
  }
  cloneNode(deep: boolean): FakeSvgNode {
    const n = new FakeSvgNode(this.tagName);
    n.attributes = { ...this.attributes };
    n.style = { ...this.style };
    n.text = this.text;
    if (deep) for (const c of this.childNodes) n.appendChild(c.cloneNode(true));
    return n;
  }
  get textContent(): string {
    return this.text;
  }
  set textContent(v: string) {
    this.text = String(v);
    if (this.text === '') this.childNodes = [];
  }
  get previousSibling(): FakeSvgNode | null {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return i > 0 ? this.parentNode.childNodes[i - 1] : null;
  }
  getBoundingClientRect(): { width: number } {
    return { width: this.rectWidth };
  }
  closest(): FakeSvgNode | null {
    return null;
  }
}

const hasClass = (n: FakeSvgNode, c: string): boolean =>
  (n.attributes.class ?? '').split(' ').includes(c);

/** 24 槽 hours 数据；overrides 按 hour → count 覆盖。 */
function hoursWithCounts(overrides: Record<number, number>): { hour: number; count: number }[] {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, count: overrides[hour] ?? 0 }));
}

/** 在最小 document 垫片下调用真实 renderHours，返回根 svg（宽度用容器矩形模拟）。 */
function renderHoursSvg(
  hours: { hour: number; count: number }[],
  width = 720,
): { wrap: FakeSvgNode; svg: FakeSvgNode } {
  const g = globalThis as any;
  const prevDoc = g.document;
  g.document = { createElementNS: (_ns: string, tag: string) => new FakeSvgNode(tag) };
  try {
    const wrap = new FakeSvgNode('div');
    wrap.rectWidth = width;
    renderHours(hours, wrap);
    const svg = wrap.childNodes.find((n) => n.tagName === 'svg');
    if (!svg) throw new Error('renderHours 未产出 svg');
    return { wrap, svg };
  } finally {
    if (prevDoc === undefined) delete g.document;
    else g.document = prevDoc;
  }
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-stats-'));
}

const dirs: string[] = [];

function makeCwd(): string {
  const cwd = tmp();
  dirs.push(cwd);
  fs.writeFileSync(
    path.join(cwd, 'picbed.toml'),
    [
      '[host]',
      'type = "local"',
      '[local]',
      `root = "${(cwd + '/bed').replace(/\\/g, '/')}"`,
      'public_base = "https://cdn.example.test"',
      'dir = "img"',
      '[github]',
      'owner = ""',
      'repo = ""',
      'branch = "main"',
      'dir = "img"',
      '[url]',
      'style = "raw"',
    ].join('\n'),
  );
  return cwd;
}

/** 本地时区的 YYYY-MM-DD 与当日 ISO 时间戳。 */
function stamp(dayOffset: number, hour: number): { key: string; iso: string } {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 30, 0, 0);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`,
    iso: d.toISOString(),
  };
}

describe('buildStatsView (F25 使用统计聚合)', () => {
  it('counts only image entries from manifest, buckets by local day/hour', async () => {
    const cwd = makeCwd();
    const today = stamp(0, 9);
    const todayNoon = stamp(0, 12);
    const yesterday = stamp(-1, 22);
    const doc = stamp(-2, 8);
    fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.picbed', 'manifest.json'),
      JSON.stringify({
        version: 1,
        entries: [
          { doc: 'a.md', raw: 'img/x.png', localPath: 'img/x.png', sha256: 'a', publicUrl: 'https://r/img/x.png', updatedAt: today.iso },
          { doc: 'a.md', raw: 'img/y.jpg', localPath: 'img/y.jpg', sha256: 'b', publicUrl: 'https://r/img/y.jpg', updatedAt: todayNoon.iso },
          { doc: 'a.md', raw: 'img/z.webp', localPath: 'img/z.webp', sha256: 'c', publicUrl: 'https://r/img/z.webp', updatedAt: yesterday.iso },
          { doc: 'a.md', raw: 'notes.md', localPath: 'notes.md', sha256: 'd', publicUrl: 'https://r/notes.md', updatedAt: doc.iso },
        ],
      }),
    );
    const cfg = loadConfig({ cwd });
    const view = await buildStatsView({ cwd, cfg, getToken: () => undefined });

    // 只统计图像：notes.md 不计入
    expect(view.totals.count).toBe(3);
    expect(view.sources.manifest).toBe(3);
    expect(view.sources.runs).toBe(0);
    // 本地时区日桶
    const byDate = new Map(view.days.map((d) => [d.date, d.count]));
    expect(byDate.get(today.key)).toBe(2);
    expect(byDate.get(yesterday.key)).toBe(1);
    // 时段桶
    const h9 = view.hours.find((h) => h.hour === 9)?.count ?? 0;
    const h12 = view.hours.find((h) => h.hour === 12)?.count ?? 0;
    expect(h9).toBe(1);
    expect(h12).toBe(1);
    // 固定长度
    expect(view.days).toHaveLength(365);
    expect(view.hours).toHaveLength(24);
    expect(view.days.at(-1)!.date).toBe(today.key);
    // today / busiest
    expect(view.today.date).toBe(today.key);
    expect(view.today.count).toBe(2);
    expect(view.busiestDay.date).toBe(today.key);
    expect(view.busiestDay.count).toBe(2);
    // 远端不可用（无 owner/repo/token）但无 500
    expect(view.sources.remoteAvailable).toBe(false);
    expect(view.warnings.some((w) => /GitHub/.test(w))).toBe(false);
  });

  it('computes last7 delta and streak from day buckets', async () => {
    const cwd = makeCwd();
    const writeDay = (dayOffset: number, n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      d.setHours(10, 0, 0, 0);
      const iso = d.toISOString();
      const entries = Array.from({ length: n }, (_, i) => ({
        doc: 'a.md',
        raw: `img/f${dayOffset}_${i}.png`,
        localPath: `img/f${dayOffset}_${i}.png`,
        sha256: `s${dayOffset}_${i}`,
        publicUrl: `https://r/img/f${dayOffset}_${i}.png`,
        updatedAt: iso,
      }));
      return entries;
    };
    fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
    // 8 天前 5 张（prev 窗口 [-13..-7]），今天 2 张 → last7.count=2 prev=5 delta=-3 deltaPct=-60
    fs.writeFileSync(
      path.join(cwd, '.picbed', 'manifest.json'),
      JSON.stringify({ version: 1, entries: [...writeDay(0, 2), ...writeDay(-8, 5)] }),
    );
    const cfg = loadConfig({ cwd });
    const view = await buildStatsView({ cwd, cfg, getToken: () => undefined });

    expect(view.last7.count).toBe(2);
    expect(view.last7.prev).toBe(5);
    expect(view.last7.delta).toBe(-3);
    expect(view.last7.deltaPct).toBe(-60);
    // 今天有数据 → current=1；最长 = 1（-8/-10 不与今天连续）
    expect(view.streak.current).toBe(1);
    expect(view.streak.longest).toBe(1);
  });

  it('streak counts back from yesterday when today is empty', async () => {
    const cwd = makeCwd();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(10, 0, 0, 0);
    fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.picbed', 'manifest.json'),
      JSON.stringify({
        version: 1,
        entries: [
          { doc: 'a.md', raw: 'img/x.png', localPath: 'img/x.png', sha256: 'a', publicUrl: 'u', updatedAt: d.toISOString() },
        ],
      }),
    );
    const cfg = loadConfig({ cwd });
    const view = await buildStatsView({ cwd, cfg, getToken: () => undefined });
    expect(view.streak.current).toBe(1);
  });

  it('falls back to runs when manifest has no image entries', async () => {
    const cwd = makeCwd();
    const t = new Date();
    t.setHours(15, 0, 0, 0);
    fs.mkdirSync(path.join(cwd, '.picbed', 'runs'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.picbed', 'runs', 'run_1.json'),
      JSON.stringify({
        id: 'run_1',
        command: 'api.sync',
        startedAt: t.toISOString(),
        finishedAt: t.toISOString(),
        ok: true,
        counts: { uploaded: 4 },
      }),
    );
    const cfg = loadConfig({ cwd });
    const view = await buildStatsView({ cwd, cfg, getToken: () => undefined });
    expect(view.sources.manifest).toBe(0);
    expect(view.sources.runs).toBe(4);
    expect(view.totals.count).toBe(4);
    const key = stamp(0, 15);
    expect(view.hours.find((h) => h.hour === 15)?.count).toBe(4);
    expect(view.days.at(-1)!.date).toBe(key.key);
  });

  it('corrupt manifest degrades to empty view with warning (no throw)', async () => {
    const cwd = makeCwd();
    fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.picbed', 'manifest.json'), '{not json');
    const cfg = loadConfig({ cwd });
    const view = await buildStatsView({ cwd, cfg, getToken: () => undefined });
    expect(view.totals.count).toBe(0);
    expect(view.warnings.some((w) => /manifest/.test(w))).toBe(true);
    expect(view.days).toHaveLength(365);
  });

  it('builds day buckets across DST transitions (calendar days, not 24h ms steps)', async () => {
    // 旧实现用 base - i*24h 毫秒减法生成日桶。DST 期间日长是 23/25 小时：
    // 从「今天」回溯、先穿过 23 小时天（春令切换）时，每步 24ms-h 会比本地
    // 日历日多走一小时，直到穿过下一个 25 小时天时跳过一整个日历日（缺桶）。
    // 今天必须落在 DST 期间才能暴露该缺陷——北/南半球互补，NY 与 Sydney
    // 至少一个正在夏令时，运行时挑选即可（测试进程内切换 TZ 对 Node ≥ 20 生效；
    // Windows 上启动前设置 TZ 不生效，故只能进程内切）。
    const prevTz = process.env.TZ;
    try {
      const tz = ['America/New_York', 'Australia/Sydney'].find((name) => {
        process.env.TZ = name;
        const year = new Date().getFullYear();
        const jan = -new Date(year, 0, 15).getTimezoneOffset();
        const jul = -new Date(year, 6, 15).getTimezoneOffset();
        return new Date().getTimezoneOffset() === -Math.max(jan, jul);
      });
      expect(tz, 'NY/Sydney 至少一个应处于 DST 期间').toBeTruthy();
      process.env.TZ = tz!;

      const cwd = makeCwd();
      fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, '.picbed', 'manifest.json'),
        JSON.stringify({ version: 1, entries: [] }),
      );
      const cfg = loadConfig({ cwd });
      const view = await buildStatsView({ cwd, cfg, getToken: () => undefined });

      // 不变式：365 个 key 唯一（旧实现在 DST 相位下为 364——重复一个、跳过一个）
      const dates = view.days.map((d) => d.date);
      expect(dates).toHaveLength(365);
      expect(new Set(dates).size).toBe(365);
      // 不变式：相邻 key 恰差一个日历日（纯日历序号比较，不受 DST 影响）
      const dayNum = (k: string) => {
        const [y, m, d] = k.split('-').map(Number);
        return Date.UTC(y, m - 1, d) / 86400000;
      };
      for (let i = 1; i < dates.length; i++) {
        expect(dayNum(dates[i]) - dayNum(dates[i - 1])).toBe(1);
      }
      // 不变式：末位 = 今天（本地时区）
      const now = new Date();
      expect(dates.at(-1)).toBe(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      );
    } finally {
      if (prevTz === undefined) delete process.env.TZ;
      else process.env.TZ = prevTz;
    }
  });

  // 任务书 #4a：F1/F2 回归。断言真实 renderHours 产出的 SVG 节点，不在测试里复刻 mock 循环
  // （审查方要求「test rendered SVG nodes rather than a copied mock loop」）。
  // 用例数保持 175（不新增 it），以便 docs/architecture.md 的计数守卫在「本轮不碰 docs」下仍绿。
  it('renderHours y-axis dedupe + bar/hit adjacency (rendered SVG nodes)', () => {
    // F2：max=1、steps=2 时 `v = round((1 * s) / 2)` 在 s=0/1/2 → 0/1/1。
    // 旧实现只把 label 放进 seen，line 无条件 append：s=1/2 两条线同 y（150,28,28）。
    const { svg } = renderHoursSvg(hoursWithCounts({ 3: 1, 5: 1 }));
    const grids = svg.childNodes.filter((n) => hasClass(n, 'hour-grid'));
    const ys = grids.map((n) => n.attributes.y1);
    expect(grids.length).toBeLessThanOrEqual(3);
    expect(new Set(ys).size).toBe(ys.length);
    expect(ys).toHaveLength(2);
    // s=0 的 v=0 基线必须保留（去重不能误删第一条）
    expect(ys).toContain('150');
    // y 轴标签同样只出现一次（v=0 不生成标签）
    const yTicks = svg.childNodes.filter(
      (n) => hasClass(n, 'hour-tick') && n.attributes['text-anchor'] === 'end',
    );
    expect(yTicks.map((n) => n.textContent)).toEqual(['1']);

    // F1 DOM 前提：宽度 720 → slot=28.5、barW=22.5 <24 → 24 槽全部创建 hit；
    // bar 先、hit 后紧邻 append（CSS :has(+ .hour-hit:hover) 的前提）。
    const narrow = renderHoursSvg(hoursWithCounts({}));
    const bars = narrow.svg.childNodes.filter((n) => hasClass(n, 'hour-bar'));
    const hits = narrow.svg.childNodes.filter((n) => hasClass(n, 'hour-hit'));
    expect(bars).toHaveLength(24);
    expect(hits).toHaveLength(24);
    for (const hit of hits) {
      expect(hit.previousSibling).toBeTruthy();
      expect(hasClass(hit.previousSibling!, 'hour-bar')).toBe(true);
    }

    // 宽柱（宽度 900 → slot≥36 → barW 封顶 24）不创建 hit：bar:hover 自身分支仍必需。
    const wide = renderHoursSvg(hoursWithCounts({}), 900);
    expect(wide.svg.childNodes.filter((n) => hasClass(n, 'hour-bar'))).toHaveLength(24);
    expect(wide.svg.childNodes.filter((n) => hasClass(n, 'hour-hit'))).toHaveLength(0);
  });

  it('emptyStatsView returns the complete zero shape', () => {
    const v = emptyStatsView(['x']);
    expect(v.totals.count).toBe(0);
    expect(v.days).toHaveLength(365);
    expect(v.hours).toHaveLength(24);
    expect(v.warnings).toEqual(['x']);
    expect(v.last7.deltaPct).toBeNull();
    expect(v.busiestDay.date).toBeNull();
  });
});

afterAll(() => {
  for (const d of dirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
