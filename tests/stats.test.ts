import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildStatsView, emptyStatsView } from '../src/app/stats.js';
import { renderHours } from '../renderer/src/features/stats-charts.js';
import { renderStats } from '../renderer/src/features/stats.js';

class FakeClassList {
  private set = new Set<string>();
  add(...cs: string[]): void {
    for (const c of cs) this.set.add(c);
  }
  remove(...cs: string[]): void {
    for (const c of cs) this.set.delete(c);
  }
  contains(c: string): boolean {
    return this.set.has(c);
  }
  get value(): string {
    return [...this.set].join(' ');
  }
}

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

/**
 * 统计视图的真实 DOM 垫片（审查要求：行为级断言读 DOM 文本，不得只断言源码字符串）。
 * 只实现 stats.js / stats-charts.js 触及的 API：getElementById、createElement、
 * createElementNS、createTextNode，以及元素的 textContent / classList / dataset /
 * querySelector / appendChild / getBoundingClientRect。
 */
class FakeDomNode {
  tagName: string;
  id: string;
  textContent = '';
  title = '';
  className = '';
  classList = new FakeClassList();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  childNodes: any[] = [];
  parentNode: FakeDomNode | null = null;
  private slots: Record<string, FakeDomNode> = {};
  constructor(tagName: string, id = '') {
    this.tagName = tagName;
    this.id = id;
  }
  appendChild(c: any): any {
    c.parentNode = this;
    this.childNodes.push(c);
    return c;
  }
  /** 仅供测试预置子节点（如热力图卡内的 h3）。 */
  setSlot(sel: string, n: FakeDomNode): FakeDomNode {
    this.slots[sel] = n;
    return n;
  }
  querySelector(sel: string): FakeDomNode | null {
    return this.slots[sel] ?? null;
  }
  addEventListener(): void {}
  getBoundingClientRect(): { width: number } {
    return { width: 720 };
  }
  closest(): FakeDomNode | null {
    return null;
  }
}

/**
 * 统计视图 DOM 垫片：getElementById 首次访问时按需创建（等同于 index.html 里
 * #view-stats 已有的元素集合）；statsHeatmapCard 预置 querySelector('h3') 槽。
 */
interface StatsDom {
  el(id: string): FakeDomNode;
  text(id: string): string;
  document: any;
}

function createStatsDom(): StatsDom {
  const map = new Map<string, FakeDomNode>();
  const el = (id: string): FakeDomNode => {
    let n = map.get(id);
    if (!n) {
      n = new FakeDomNode('div', id);
      if (id === 'statsHeatmapCard') n.setSlot('h3', new FakeDomNode('h3'));
      if (id === 'view-stats') n.style.display = 'block';
      map.set(id, n);
    }
    return n;
  };
  const document = {
    getElementById: (id: string) => el(id),
    createElement: (tag: string) => new FakeDomNode(tag),
    createElementNS: (_ns: string, tag: string) => new FakeSvgNode(tag),
    createTextNode: (t: string) => ({ textContent: String(t) }) as any,
  };
  return { el, text: (id) => el(id).textContent, document };
}

/** 装好 DOM 垫片 + fetch stub，调用真实 renderStats，返回可读的假 DOM。 */
async function renderStatsWith(payload: unknown): Promise<StatsDom> {
  const g = globalThis as any;
  const dom = createStatsDom();
  const prevDoc = g.document;
  const prevFetch = g.fetch;
  let requested = '';
  g.document = dom.document;
  g.fetch = (async (path: string) => {
    requested = String(path);
    return { status: 200, json: async () => ({ ok: true, data: payload }) };
  }) as any;
  try {
    await renderStats();
    expect(requested).toBe('/api/stats');
  } finally {
    if (prevDoc === undefined) delete g.document;
    else g.document = prevDoc;
    if (prevFetch === undefined) delete g.fetch;
    else g.fetch = prevFetch;
  }
  return dom;
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

/** 写入一条 RunRecord fixture（字段故意放宽：可表达测试所需的非法值）。 */
function writeRun(
  cwd: string,
  id: string,
  fields: {
    uploaded?: number;
    counts?: Record<string, unknown>;
    startedAt?: string;
    ok?: boolean;
  } = {},
): void {
  const dir = path.join(cwd, '.picbed', 'runs');
  fs.mkdirSync(dir, { recursive: true });
  const t = fields.startedAt ?? stamp(0, 12).iso;
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify({
      id,
      command: 'api.sync',
      startedAt: t,
      finishedAt: t,
      ok: fields.ok ?? true,
      counts: fields.counts ?? { uploaded: fields.uploaded ?? 0 },
    }),
  );
}

describe('buildStatsView (F25 v2 · runs 唯一计数源)', () => {
  it('runs are the only count source: manifest presence or multi-reference never changes the count', async () => {
    // manifest 含同一图像的两条引用条目（旧口径按 updatedAt 计事件会双计）
    const withManifest = makeCwd();
    fs.mkdirSync(path.join(withManifest, '.picbed'), { recursive: true });
    fs.writeFileSync(
      path.join(withManifest, '.picbed', 'manifest.json'),
      JSON.stringify({
        version: 1,
        entries: [
          { doc: 'a.md', raw: 'img/x.png', localPath: 'img/x.png', sha256: 'a', publicUrl: 'u', updatedAt: stamp(0, 9).iso },
          { doc: 'b.md', raw: 'img/x.png', localPath: 'img/x.png', sha256: 'a', publicUrl: 'u', updatedAt: stamp(0, 9).iso },
        ],
      }),
    );
    writeRun(withManifest, 'r1', { uploaded: 5 });

    const withoutManifest = makeCwd(); // 连 manifest 文件都不存在
    writeRun(withoutManifest, 'r1', { uploaded: 5 });

    const viewA = await buildStatsView({ cwd: withManifest, cfg: loadConfig({ cwd: withManifest }), getToken: () => undefined });
    const viewB = await buildStatsView({ cwd: withoutManifest, cfg: loadConfig({ cwd: withoutManifest }), getToken: () => undefined });

    expect(viewA.totals.count).toBe(5);
    expect(viewB.totals.count).toBe(5);
    expect(viewA.totals.count).toBe(viewB.totals.count);
    expect(viewA.measurement.state).toBe('available');
    expect(viewB.measurement.state).toBe('available');
  });

  it('partial run: uploads counted even when ok=false (successful part counts)', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 3, ok: false });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.totals.count).toBe(3);
    // 无坏记录 → available（partial run ≠ 坏记录）
    expect(view.measurement.state).toBe('available');
    expect(view.measurement.countAccuracy).toBe('recorded');
    expect(view.warnings).toEqual([]);
  });

  it('corrupt run file → partial with warning; good records still counted; deltaPct nulled', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'good', { uploaded: 2 });
    // prev 窗口有数据：若非 partial 强制置 null，deltaPct 会算出 -60
    writeRun(cwd, 'prev', { uploaded: 5, startedAt: stamp(-8, 10).iso });
    fs.writeFileSync(path.join(cwd, '.picbed', 'runs', 'broken.json'), '{not json');
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    // 状态判定表：有可解析记录、部分坏记录 → partial，坏记录外的已读计数
    expect(view.measurement.state).toBe('partial');
    expect(view.sources.runs.state).toBe('partial');
    // 窗口内可读记录照计：今天 2 + prev(-8) 5 = 7（坏文件的那份丢了）
    expect(view.totals.count).toBe(7);
    // warning 说明丢了多少
    expect(view.warnings.some((w) => /1 条运行记录文件无法解析/.test(w))).toBe(true);
    // partial 时 countAccuracy 仍可为 recorded（已读部分是记录值），但 deltaPct 必须为 null
    expect(view.measurement.countAccuracy).toBe('recorded');
    expect(view.last7).toMatchObject({ count: 2, prev: 5, delta: -3, deltaPct: null });
  });

  it('field-invalid records (uploaded not a non-negative safe integer) → partial', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'good', { uploaded: 1 });
    writeRun(cwd, 'neg', { counts: { uploaded: -5 } });
    writeRun(cwd, 'frac', { counts: { uploaded: 1.5 } });
    writeRun(cwd, 'str', { counts: { uploaded: '3' } }); // 字符串数字不算数
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.measurement.state).toBe('partial');
    expect(view.totals.count).toBe(1);
    expect(view.warnings.some((w) => /3 条运行记录字段无效/.test(w))).toBe(true);
  });

  it('record without valid startedAt → partial', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'good', { uploaded: 1 });
    writeRun(cwd, 'bad', { startedAt: 'not-a-date' });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.measurement.state).toBe('partial');
    expect(view.totals.count).toBe(1);
    expect(view.warnings.some((w) => /1 条运行记录字段无效/.test(w))).toBe(true);
  });

  it('missing runs dir → unavailable (count 0 is not a true zero)', async () => {
    const cwd = makeCwd(); // 无 .picbed/runs
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.totals.count).toBe(0);
    expect(view.measurement.state).toBe('unavailable');
    expect(view.measurement.countAccuracy).toBe('unknown');
    expect(view.measurement.timeAccuracy).toBe('unknown');
    expect(view.sources.runs.state).toBe('unavailable');
    // 正常空态不是错误：无 warning；「无可用上传历史」≠ 从未上传
    expect(view.warnings).toEqual([]);
  });

  it('runs read error → unavailable with warning (not a silent zero)', async () => {
    const cwd = makeCwd();
    fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
    // 用同名文件占住 runs 目录位：existsSync 通过但 readdirSync 抛 ENOTDIR
    fs.writeFileSync(path.join(cwd, '.picbed', 'runs'), 'not a dir');
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.measurement.state).toBe('unavailable');
    expect(view.totals.count).toBe(0);
    expect(view.warnings.some((w) => /runs 目录读取失败/.test(w))).toBe(true);
  });

  it('readable records with all uploads 0 → available with true zero', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 0 });
    writeRun(cwd, 'r2', { counts: {} }); // 无 uploaded 字段（如 revert 记录）按 0 计
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.measurement.state).toBe('available');
    expect(view.measurement.countAccuracy).toBe('recorded');
    expect(view.totals.count).toBe(0);
    expect(view.warnings).toEqual([]);
  });

  it('365-day window: first/last day, period fields and timezone name', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 1, startedAt: stamp(0, 8).iso });
    writeRun(cwd, 'r2', { uploaded: 1, startedAt: stamp(-364, 8).iso });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    const today = stamp(0, 8).key;
    const start = stamp(-364, 8).key;
    expect(view.days).toHaveLength(365);
    expect(view.days[0].date).toBe(start);
    expect(view.days.at(-1)!.date).toBe(today);
    expect(view.period.endDate).toBe(today);
    expect(view.period.startDate).toBe(start);
    expect(view.period).toMatchObject({ kind: 'rolling-days', days: 365, scope: 'local-run-store' });
    // 本测试环境时区有效 → 报 IANA 名；无效环境才显式 'unknown'
    const intl = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let tzValid = false;
    try {
      new Intl.DateTimeFormat('en', { timeZone: intl });
      tzValid = true;
    } catch {
      tzValid = false;
    }
    expect(view.period.timeZone).toBe(tzValid ? intl : 'unknown');
    // 窗口首末日都在窗口内
    expect(view.totals.count).toBe(2);
    expect(view.days[0].count).toBe(1);
    expect(view.days.at(-1)!.count).toBe(1);
  });

  it('sum equality: totals = sum(days) = sum(hours); uploads weighted at startedAt', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 3, startedAt: stamp(0, 9).iso });
    writeRun(cwd, 'r2', { uploaded: 2, startedAt: stamp(-1, 22).iso });
    writeRun(cwd, 'r3', { uploaded: 4, startedAt: stamp(-10, 15).iso });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.totals.count).toBe(9);
    expect(view.days.reduce((n, d) => n + d.count, 0)).toBe(9);
    expect(view.hours.reduce((n, h) => n + h.count, 0)).toBe(9);
    // 权重归 startedAt 的日/时桶
    const byDate = new Map(view.days.map((d) => [d.date, d.count]));
    expect(byDate.get(stamp(0, 9).key)).toBe(3);
    expect(byDate.get(stamp(-1, 22).key)).toBe(2);
    expect(byDate.get(stamp(-10, 15).key)).toBe(4);
    expect(view.hours.find((h) => h.hour === 9)?.count).toBe(3);
    expect(view.hours.find((h) => h.hour === 22)?.count).toBe(2);
    expect(view.hours.find((h) => h.hour === 15)?.count).toBe(4);
  });

  it('run older than window: excluded from count/hours but state stays available', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'old', { uploaded: 7, startedAt: stamp(-400, 10).iso });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.totals.count).toBe(0);
    // 有可解析记录（哪怕全在窗口外）→ available，绝不是 unavailable
    expect(view.measurement.state).toBe('available');
    expect(view.measurement.countAccuracy).toBe('recorded');
    expect(view.sources.runs.state).toBe('available');
    expect(view.days.every((d) => d.count === 0)).toBe(true);
    expect(view.hours.every((h) => h.count === 0)).toBe(true);
  });

  it('computes last7 delta and streak from runs', async () => {
    const cwd = makeCwd();
    // 8 天前 5 次（prev 窗口 [-13..-7]），今天 2 次 → last7.count=2 prev=5 delta=-3 deltaPct=-60
    writeRun(cwd, 'today', { uploaded: 2, startedAt: stamp(0, 10).iso });
    writeRun(cwd, 'earlier', { uploaded: 5, startedAt: stamp(-8, 10).iso });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.last7).toEqual({ count: 2, prev: 5, delta: -3, deltaPct: -60 });
    // 今天有数据 → current=1；-8 的 run 不与今天连续 → longest=1
    expect(view.streak.current).toBe(1);
    expect(view.streak.longest).toBe(1);
  });

  it('streak counts back from yesterday when today is empty', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'y', { uploaded: 1, startedAt: stamp(-1, 10).iso });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.streak.current).toBe(1);
    expect(view.today.count).toBe(0);
  });

  it('Trees truncated=true → remoteInventory partial with count (context only, not counted)', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 2 });
    const cfg = loadConfig({
      cwd,
      overrides: { github: { owner: 'o', repo: 'r', branch: 'main', dir: 'img' } },
    });
    const g = globalThis as any;
    const prevFetch = g.fetch;
    g.fetch = (async () => ({
      ok: true,
      json: async () => ({
        truncated: true,
        tree: [
          { type: 'blob', path: 'img/a.png' },
          { type: 'blob', path: 'img/b.txt' }, // 非图像不计
          { type: 'tree', path: 'img/sub' }, // 目录不计
        ],
      }),
    })) as any;
    try {
      const view = await buildStatsView({ cwd, cfg, getToken: () => 't' });
      expect(view.sources.remoteInventory).toEqual({ count: 1, state: 'partial' });
      expect(view.warnings.some((w) => /截断|不完整/.test(w))).toBe(true);
      // 库存是上下文：不参与 count
      expect(view.totals.count).toBe(2);
    } finally {
      g.fetch = prevFetch;
    }
  });

  it('inventory fetch failure degrades without touching local counts', async () => {
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 2 });
    const cfg = loadConfig({
      cwd,
      overrides: { github: { owner: 'o', repo: 'r', branch: 'main', dir: 'img' } },
    });
    const g = globalThis as any;
    const prevFetch = g.fetch;
    g.fetch = (async () => {
      throw new Error('network down');
    }) as any;
    try {
      const view = await buildStatsView({ cwd, cfg, getToken: () => 't' });
      // 独立库存失败不抹本地：count 不动、runs.state 不动、远端 unavailable + warning
      expect(view.sources.remoteInventory).toEqual({ count: null, state: 'unavailable' });
      expect(view.measurement.state).toBe('available');
      expect(view.totals.count).toBe(2);
      expect(view.warnings.some((w) => /远端库存读取失败/.test(w))).toBe(true);
    } finally {
      g.fetch = prevFetch;
    }
  });

  it('manifest/commits are declared not-counted; remoteAvailable removed; unconfigured remote is unavailable', async () => {
    const cwd = makeCwd();
    fs.mkdirSync(path.join(cwd, '.picbed'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.picbed', 'manifest.json'),
      JSON.stringify({ version: 1, entries: [] }),
    );
    writeRun(cwd, 'r1', { uploaded: 3 });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    expect(view.sources.manifest).toEqual({ use: 'not-counted', reason: 'mapping-snapshot' });
    expect(view.sources.remoteCommits).toEqual({ use: 'not-counted', reason: 'not-upload-events' });
    expect('remoteAvailable' in view.sources).toBe(false);
    // 未配置远端（无 owner/repo/token）→ 未尝试 → unavailable（≠ 0 库存）
    expect(view.sources.remoteInventory).toEqual({ count: null, state: 'unavailable' });
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
      const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });

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

  it('emptyStatsView is the unavailable fallback shape (contractVersion 2, not a true zero)', () => {
    const v = emptyStatsView(['x']);
    expect(v.contractVersion).toBe(2);
    expect(v.totals.count).toBe(0);
    expect(v.days).toHaveLength(365);
    expect(v.hours).toHaveLength(24);
    expect(v.warnings).toEqual(['x']);
    expect(v.last7.deltaPct).toBeNull();
    expect(v.busiestDay.date).toBeNull();
    // 兜底形状是「无可用数据」（unavailable），不是真 0
    expect(v.measurement.state).toBe('unavailable');
    expect(v.measurement.countAccuracy).toBe('unknown');
    expect(v.measurement.timeAccuracy).toBe('unknown');
    expect(v.measurement.unit).toBe('successful-image-upload');
    expect(v.measurement.coverage).toBe('retained-local-runs');
    expect(v.sources.runs.state).toBe('unavailable');
    expect(v.sources.manifest).toEqual({ use: 'not-counted', reason: 'mapping-snapshot' });
    expect(v.sources.remoteCommits).toEqual({ use: 'not-counted', reason: 'not-upload-events' });
    expect(v.sources.remoteInventory).toEqual({ count: null, state: 'unavailable' });
    expect(v.period.kind).toBe('rolling-days');
    expect(v.period.days).toBe(365);
    expect(v.period.scope).toBe('local-run-store');
    expect(v.period.startDate).toBe(v.days[0].date);
    expect(v.period.endDate).toBe(v.today.date);
  });
});

/**
 * 审查要求：v2 必填字段缺失时不得以 `?? 0` / 默认对象静默渲染为 0。
 * 这些用例都走真实 renderStats（真实 features/stats.js + stats-charts.js），
 * 断言读渲染后的 DOM 文本，而不是源码字符串。
 */
describe('renderStats v2 required-field integrity (real DOM, fake fetch)', () => {
  /** 一份完整合法的 v2 payload（buildStatsView 真值形状 + 固定值便于断言）。 */
  function completeV2(overrides: Record<string, any> = {}): any {
    const v = emptyStatsView([]);
    const today = v.today.date;
    return {
      ...v,
      generatedAt: new Date().toISOString(),
      totals: { count: 42 },
      today: { date: today, count: 3 },
      last7: { count: 7, prev: 0, delta: 7, deltaPct: null },
      streak: { current: 2, longest: 5 },
      busiestDay: { date: v.days.at(-3)!.date, count: 11 },
      days: v.days.map((d, i) => ({ ...d, count: i === v.days.length - 1 ? 3 : 0 })),
      hours: v.hours.map((h) => ({ ...h, count: h.hour === 9 ? 3 : 0 })),
      sources: {
        runs: { state: 'available' },
        manifest: { use: 'not-counted', reason: 'mapping-snapshot' },
        remoteCommits: { use: 'not-counted', reason: 'not-upload-events' },
        remoteInventory: { count: 12, state: 'complete' },
      },
      measurement: { ...v.measurement, state: 'available', countAccuracy: 'recorded', timeAccuracy: 'run-start-estimate' },
      ...overrides,
    };
  }

  it('full v2 payload renders the real numbers (control case for the negative ones)', async () => {
    const dom = await renderStatsWith(completeV2());
    expect(dom.text('statsTotal')).toBe('42');
    expect(dom.text('kpiToday')).toBe('3');
    expect(dom.text('kpi7')).toBe('7');
    expect(dom.text('kpiStreak')).toBe('2');
    expect(dom.text('statsTotalSub')).toContain('已保存记录中成功上传 42 次图像');
  });

  it('real buildStatsView output passes the integrity gate (gate is not over-strict)', async () => {
    // 反向守卫：完整校验不能把聚合层的真实产物误判为契约不匹配。
    const cwd = makeCwd();
    writeRun(cwd, 'r1', { uploaded: 4, startedAt: stamp(0, 10).iso });
    writeRun(cwd, 'r2', { uploaded: 1, startedAt: stamp(-2, 8).iso });
    const view = await buildStatsView({ cwd, cfg: loadConfig({ cwd }), getToken: () => undefined });
    const dom = await renderStatsWith(JSON.parse(JSON.stringify(view)));
    expect(dom.text('statsTotal')).toBe('5');
    expect(dom.text('kpiToday')).toBe('4');
    expect(dom.text('statsTotalSub')).toContain('已保存记录中成功上传 5 次图像');
    // 未配置远端 → 库存卡 unavailable（≠ 0），不影响上传计数
    expect(dom.text('statsInventoryValue')).toBe('—');
    expect(dom.text('statsInventoryState')).toBe('未连接远端');
  });

  it('v2 with totals missing → contract-mismatch state, never 0', async () => {
    const bad = completeV2();
    delete bad.totals;
    const dom = await renderStatsWith(bad);
    expect(dom.text('statsTotal')).toBe('—');
    expect(dom.text('kpiToday')).not.toBe('0');
    expect(dom.text('statsHint')).toContain('缺失');
    expect(dom.text('statsHint')).toContain('totals');
  });

  it('v2 with today missing → contract-mismatch state, never 0', async () => {
    const bad = completeV2();
    delete bad.today;
    const dom = await renderStatsWith(bad);
    expect(dom.text('kpiToday')).toBe('—');
    expect(dom.text('statsTotal')).toBe('—');
    expect(dom.text('statsHint')).toContain('today');
  });

  it('v2 with malformed measurement/sources/days/hour payload → mismatch, not zeros', async () => {
    const cases: [string, (v: any) => void][] = [
      ['measurement', (v) => delete v.measurement],
      ['sources.remoteInventory', (v) => delete v.sources.remoteInventory],
      ['last7', (v) => delete v.last7],
      ['streak', (v) => delete v.streak],
      ['busiestDay', (v) => delete v.busiestDay],
      ['days', (v) => delete v.days],
      ['hours', (v) => (v.hours = v.hours.slice(0, 23))],
      ['period', (v) => (v.period = { ...v.period, days: 30 })],
    ];
    for (const [, mutate] of cases) {
      const bad = completeV2();
      mutate(bad);
      const dom = await renderStatsWith(bad);
      expect(dom.text('statsTotal'), 'totals 必须为 —（不得渲染 0）').toBe('—');
      expect(dom.text('kpi7')).toBe('—');
    }
  });

  it('v2 state=unavailable → statsTotal is — with 暂无可用上传记录 sub-line', async () => {
    const v = completeV2();
    v.measurement = { ...v.measurement, state: 'unavailable', countAccuracy: 'unknown', timeAccuracy: 'unknown' };
    v.totals = { count: 0 };
    const dom = await renderStatsWith(v);
    expect(dom.text('statsTotal')).toBe('—');
    expect(dom.text('statsTotalSub')).toBe('暂无可用上传记录');
    // 库存仍按上下文渲染（远端可用 distinct from 上传计数）
    expect(dom.text('statsInventoryValue')).toBe('12');
  });
});

afterAll(() => {
  for (const d of dirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
