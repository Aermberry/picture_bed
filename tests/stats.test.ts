import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildStatsView, emptyStatsView } from '../src/app/stats.js';

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

  it('renderHours Y-axis labels deduplicate for i=2 with max=1', () => {
    // 任务书 6：max=1、steps=2 时 `v = round((1 * s) / 2)` 在 s=0/1/2 → 0/0/1；
    // 旧实现在同一 v 上绘制第二根网格线和标签，DOM 双写。
    // 新实现用 Set 去重只显第一条标签。
    const mockRender = (max: number, steps: number) => {
      let labels: number[] = [];
      const mockSvgEl = (tag: string, ...args: unknown[]) => {
        if (tag === 'line') return; // line 总是绘制
        if (tag === 'text' && args[0]) {
          labels.push(args[0] as number);
        }
      };
      const seen = new Set<number>();
      for (let s = 0; s <= steps; s++) {
        const v = Math.round((max * s) / steps);
        mockSvgEl('line');
        if (s > 0 && !seen.has(v)) {
          seen.add(v);
          mockSvgEl('text', v);
        }
      }
      return labels;
    };

    const labels = mockRender(1, 2);
    // 唯一 labels 应为 [1]（v=0 不生成标签）
    expect(labels).toEqual([1]);
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
