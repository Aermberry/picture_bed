import { IMAGE_EXT, normalizeExt } from '../lib/img.js';
import type { ResolvedConfig } from '../types.js';
import { scanAllRuns } from './run-store.js';

/**
 * F25 使用统计聚合视图 v2（contractVersion: 2）。
 *
 * v2 契约要点（批准提案 §1–§4，字段名/枚举为附录 A 精确契约）：
 * - **runs 是唯一计数源**：manifest 是映射快照（1 图多引用会多计）、远端提交不是上传事件，
 *   两者都声明为 `use: 'not-counted'`，不再参与任何计数或时间线填充。
 * - **计数单位 = 一次成功上传动作**：每条 run 的 `counts.uploaded` 按其 `startedAt` 权重进桶。
 * - **恒 365 日窗口**：totals = sum(days) = sum(hours)；窗口外的 run 不计入（记录仍在，不判 unavailable）。
 * - **结构化完整性**：measurement / sources 把「估算 vs 精确」「可用 vs 缺失」从 warnings 文案升级为字段。
 * - 外层信封 schemaVersion 保持 1（演进只发生在 data 内）。
 *
 * 状态判定表（measurement.state 的唯一来源）：
 * | runs 目录不存在/空      | unavailable | 0 | 「无可用上传历史」≠ 从未上传 |
 * | 有可解析记录且 uploaded 全 0 | available | 0 | 真 0 |
 * | 有可解析记录、部分坏记录 | partial | 坏记录外的已读计数 | warning 说明丢了多少 |
 * | 全部可读无坏记录        | available | 实际 | countAccuracy='recorded' |
 * | 读取抛错               | unavailable | 0 | warning 带原因 |
 */
export interface StatsView {
  contractVersion: 2;
  generatedAt: string;
  period: {
    kind: 'rolling-days';
    days: 365;
    startDate: string;
    endDate: string;
    timeZone: string;
    scope: 'local-run-store';
  };
  measurement: {
    unit: 'successful-image-upload';
    source: 'runs';
    state: 'available' | 'partial' | 'unavailable';
    countAccuracy: 'recorded' | 'unknown';
    timeAccuracy: 'run-start-estimate' | 'unknown';
    coverage: 'retained-local-runs';
  };
  totals: { count: number };
  today: { date: string; count: number };
  last7: { count: number; prev: number; delta: number; deltaPct: number | null };
  streak: { current: number; longest: number };
  busiestDay: { date: string | null; count: number };
  days: { date: string; count: number }[];
  hours: { hour: number; count: number }[];
  sources: {
    runs: { state: 'available' | 'partial' | 'unavailable' };
    manifest: { use: 'not-counted'; reason: 'mapping-snapshot' };
    remoteCommits: { use: 'not-counted'; reason: 'not-upload-events' };
    remoteInventory: { count: number | null; state: 'complete' | 'partial' | 'unavailable' };
  };
  warnings: string[];
}

const WINDOW_DAYS = 365;
const CONTRACT_VERSION = 2 as const;

/** 本地时区 YYYY-MM-DD（用户感知统计；有意区别于旧 manage 视图的 UTC 月计数）。 */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** 本次聚合的时区 IANA 名；解析不出有效名（如 TZ 为空/垃圾值）则显式 'unknown'。 */
function localTimeZoneName(): string {
  try {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (name) new Intl.DateTimeFormat('en', { timeZone: name }); // 校验可解析（Etc/Unknown 会抛）
    return name || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** 空视图（零值完整形状）：路由兜底与零配置场景共用，保证响应 schema 恒完整。 */
export function emptyStatsView(warnings: string[] = []): StatsView {
  const today = new Date();
  const days: StatsView['days'] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    // 日历日递减（非毫秒减法）：DST 切换日只有 23/25 小时，ms 减法会跳日或重日
    const d = startOfLocalDay(today);
    d.setDate(d.getDate() - i);
    days.push({ date: localDateKey(d), count: 0 });
  }
  return {
    contractVersion: CONTRACT_VERSION,
    generatedAt: today.toISOString(),
    period: {
      kind: 'rolling-days',
      days: WINDOW_DAYS,
      startDate: days[0].date,
      endDate: localDateKey(today),
      timeZone: localTimeZoneName(),
      scope: 'local-run-store',
    },
    // 兜底形状是「无可用数据」（unavailable），不是真 0：不能把占位 0 说成从未上传
    measurement: {
      unit: 'successful-image-upload',
      source: 'runs',
      state: 'unavailable',
      countAccuracy: 'unknown',
      timeAccuracy: 'unknown',
      coverage: 'retained-local-runs',
    },
    totals: { count: 0 },
    today: { date: localDateKey(today), count: 0 },
    last7: { count: 0, prev: 0, delta: 0, deltaPct: null },
    streak: { current: 0, longest: 0 },
    busiestDay: { date: null, count: 0 },
    days,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    sources: {
      runs: { state: 'unavailable' },
      manifest: { use: 'not-counted', reason: 'mapping-snapshot' },
      remoteCommits: { use: 'not-counted', reason: 'not-upload-events' },
      remoteInventory: { count: null, state: 'unavailable' },
    },
    warnings,
  };
}

function sumRange(countByDate: Map<string, number>, dates: string[]): number {
  let sum = 0;
  for (const d of dates) sum += countByDate.get(d) ?? 0;
  return sum;
}

/**
 * 远端库存：仅 Trees API 数 github.dir 下图片总数（context，不参与 count）。
 * 不再调 Commits API（提交时间不是上传事件）。任何失败降级为 warning，绝不抛出。
 */
async function fetchRemoteInventory(
  cfg: ResolvedConfig,
  getToken: () => string | undefined,
  warnings: string[],
): Promise<StatsView['sources']['remoteInventory']> {
  const unavailable: StatsView['sources']['remoteInventory'] = { count: null, state: 'unavailable' };
  const owner = cfg.github.owner;
  const repo = cfg.github.repo;
  const token = getToken();
  if (!owner || !repo || !token) return unavailable; // 未配置远端 = 未尝试，不是 0 库存
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'picbed',
  };
  try {
    const dirPrefix = cfg.github.dir ? `${cfg.github.dir.replace(/\/+$/, '')}/` : '';
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(cfg.github.branch || 'HEAD')}?recursive=1`,
      { headers },
    );
    if (!treeRes.ok) {
      warnings.push(`远端库存读取失败：GitHub API ${treeRes.status}`);
      return unavailable;
    }
    const tree = (await treeRes.json()) as {
      truncated?: boolean;
      tree?: Array<{ path?: string; type?: string }>;
    };
    const count = (tree.tree ?? []).filter(
      (t) =>
        t.type === 'blob' &&
        (!dirPrefix || String(t.path ?? '').startsWith(dirPrefix)) &&
        IMAGE_EXT.has(normalizeExt(String(t.path ?? ''))),
    ).length;
    // Trees truncated=true → 列表不完整 → partial（计数可能偏小）
    if (tree.truncated === true) {
      warnings.push('远端库存列表不完整（GitHub Trees API 截断），库存数可能偏小');
      return { count, state: 'partial' };
    }
    return { count, state: 'complete' };
  } catch (e) {
    warnings.push(`远端库存读取失败：${e instanceof Error ? e.message : String(e)}`);
    return unavailable;
  }
}

/** F25 v2 使用统计：runs 唯一计数源 + 365 日统一窗口。远端库存软降级，不抛错。 */
export async function buildStatsView(opts: {
  cwd: string;
  cfg: ResolvedConfig;
  getToken: () => string | undefined;
}): Promise<StatsView> {
  const { cwd, cfg, getToken } = opts;
  const warnings: string[] = [];
  const view = emptyStatsView();

  // ── runs 全量读取（唯一计数源；不按文件名截 200）──
  let runs: { id?: string; startedAt?: string; counts?: Record<string, unknown> }[] = [];
  let readableCount = 0;
  let state: StatsView['measurement']['state'] = 'unavailable';
  try {
    const scanned = scanAllRuns(cwd);
    if (scanned.corruptFiles > 0) {
      warnings.push(`${scanned.corruptFiles} 条运行记录文件无法解析，统计不含这些记录`);
    }
    runs = scanned.runs;
    readableCount = scanned.runs.length;
    // 状态判定表：无可解析记录（目录不存在/空/全部损坏）→ unavailable；
    // 有可解析记录 + 有坏记录 → partial；全部可读 → available
    if (scanned.runs.length === 0) state = 'unavailable';
    else if (scanned.corruptFiles > 0) state = 'partial';
    else state = 'available';
  } catch (err) {
    // 读取抛错（如 runs 路径不是目录）→ unavailable + warning 带原因
    warnings.push(`runs 目录读取失败：${err instanceof Error ? err.message : String(err)}`);
    state = 'unavailable';
  }

  // ── 字段校验 + 按窗口聚合：每条 run 的 uploaded 权重归 startedAt ──
  const countByDate = new Map<string, number>();
  for (const d of view.days) countByDate.set(d.date, 0);
  const windowStart = view.days[0].date;
  const windowEnd = view.today.date;

  if (state !== 'unavailable') {
    let invalidCount = 0;
    for (const run of runs) {
      const raw: unknown = run.counts?.uploaded;
      // uploaded 缺失（如 revert 记录的 counts）按 0 计——保存记录内就是 0 次上传；
      // 存在但不是非负安全整数（负数/小数/字符串/NaN/超大）→ 字段无效（null）
      const uploaded: number | null =
        raw === undefined
          ? 0
          : typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0
            ? raw
            : null;
      const t = new Date(run.startedAt ?? '');
      if (uploaded === null || Number.isNaN(t.getTime())) {
        invalidCount += 1;
        continue;
      }
      if (uploaded === 0) continue;
      const key = localDateKey(t);
      if (key < windowStart || key > windowEnd) continue; // 窗口外不计入（记录仍在）
      countByDate.set(key, (countByDate.get(key) ?? 0) + uploaded);
      view.hours[t.getHours()].count += uploaded;
    }
    if (invalidCount > 0) {
      warnings.push(`${invalidCount} 条运行记录字段无效（uploaded 或 startedAt），统计不含这些记录（记录不完整）`);
      state = 'partial';
    }
    // 已读部分是记录值：available 与 partial 都算 recorded（partial 由 deltaPct=null 表达不完整）
    if (readableCount > 0) {
      view.measurement.countAccuracy = 'recorded';
      view.measurement.timeAccuracy = 'run-start-estimate';
    }
  }

  view.measurement.state = state;
  view.sources.runs.state = state;

  // ── 日/时桶 → 汇总指标（恒 365 日窗口）──
  for (const d of view.days) d.count = countByDate.get(d.date) ?? 0;

  view.totals.count = view.days.reduce((n, d) => n + d.count, 0);
  view.today.count = view.days.at(-1)?.count ?? 0;
  const last7Dates = view.days.slice(-7).map((d) => d.date);
  const prev7Dates = view.days.slice(-14, -7).map((d) => d.date);
  const count = sumRange(countByDate, last7Dates);
  const prev = sumRange(countByDate, prev7Dates);
  view.last7 = {
    count,
    prev,
    delta: count - prev,
    // partial → 无有效环比（记录可能缺失，比较无意义）；prev=0 → 无对比基线
    deltaPct: state === 'partial' ? null : prev === 0 ? null : Math.round(((count - prev) / prev) * 100),
  };

  // 连续天数：current 从今天回溯（今天为 0 则从昨天起算）；longest 为窗口内最长
  let current = 0;
  const counts = view.days.map((d) => d.count);
  let idx = counts.length - 1;
  if (counts[idx] === 0) idx -= 1;
  while (idx >= 0 && counts[idx] > 0) {
    current += 1;
    idx -= 1;
  }
  let longest = 0;
  let runLen = 0;
  for (const c of counts) {
    runLen = c > 0 ? runLen + 1 : 0;
    if (runLen > longest) longest = runLen;
  }
  view.streak = { current, longest };

  // 最忙的一天（并列取最早）
  let busiest: StatsView['busiestDay'] = { date: null, count: 0 };
  for (const d of view.days) {
    if (d.count > busiest.count) busiest = { date: d.date, count: d.count };
  }
  view.busiestDay = busiest;

  // ── 远端库存：独立 context，不参与 count（Trees truncated → partial）──
  // TODO(F25-v3): 每图事件日志——按图粒度的上传事件源，替代 run 级权重估算
  // TODO(F25-v3): period 参数化/导出——可变范围查询与可重现边界
  // TODO(F25-v3): 远端读端口化——把 Trees 读取从 app 层内联 fetch 移入 host 端口
  view.sources.remoteInventory = await fetchRemoteInventory(cfg, getToken, warnings);

  view.warnings = warnings;
  return view;
}
