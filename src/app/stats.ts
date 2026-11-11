import { loadManifest } from '../manifest.js';
import { IMAGE_EXT, normalizeExt } from '../lib/img.js';
import type { ResolvedConfig } from '../types.js';
import { listRuns } from './run-store.js';

/** F25 使用统计聚合视图（固定形状：days 恒 365 条、hours 恒 24 条）。 */
export interface StatsView {
  generatedAt: string;
  totals: { count: number };
  today: { date: string; count: number };
  last7: { count: number; prev: number; delta: number; deltaPct: number | null };
  streak: { current: number; longest: number };
  busiestDay: { date: string | null; count: number };
  days: { date: string; count: number }[];
  hours: { hour: number; count: number }[];
  sources: { manifest: number; runs: number; remote: number | null; remoteAvailable: boolean };
  warnings: string[];
}

const WINDOW_DAYS = 365;
const COMMITS_PER_PAGE = 100;

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
    generatedAt: today.toISOString(),
    totals: { count: 0 },
    today: { date: localDateKey(today), count: 0 },
    last7: { count: 0, prev: 0, delta: 0, deltaPct: null },
    streak: { current: 0, longest: 0 },
    busiestDay: { date: null, count: 0 },
    days,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    sources: { manifest: 0, runs: 0, remote: null, remoteAvailable: false },
    warnings,
  };
}

/** 远端图床目录下的图片路径是否计入（图片扩展名白名单，与上传语义同一真源）。 */
function isImagePath(p: string): boolean {
  return IMAGE_EXT.has(normalizeExt(p));
}

function sumRange(countByDate: Map<string, number>, dates: string[]): number {
  let sum = 0;
  for (const d of dates) sum += countByDate.get(d) ?? 0;
  return sum;
}

interface RemoteInfo {
  count: number | null;
  commits: string[]; // ISO 时间戳（本地无事件时用于填充时间线）
  warning?: string;
}

/**
 * 远端补充：Trees API 数 github.dir 下图片总数；Commits API 取最近提交时间戳。
 * 任何失败降级为 warning，绝不抛出（本地统计照常返回，无 500 路径）。
 */
async function fetchRemote(cfg: ResolvedConfig, getToken: () => string | undefined): Promise<RemoteInfo> {
  const empty: RemoteInfo = { count: null, commits: [] };
  const owner = cfg.github.owner;
  const repo = cfg.github.repo;
  const token = getToken();
  if (!owner || !repo || !token) return empty;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'picbed',
  };
  const out: RemoteInfo = { count: null, commits: [] };
  try {
    const dirPrefix = cfg.github.dir ? `${cfg.github.dir.replace(/\/+$/, '')}/` : '';
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(cfg.github.branch || 'HEAD')}?recursive=1`,
      { headers },
    );
    if (treeRes.ok) {
      const tree = (await treeRes.json()) as { tree?: Array<{ path?: string; type?: string }> };
      out.count = (tree.tree ?? []).filter(
        (t) => t.type === 'blob' && (!dirPrefix || String(t.path ?? '').startsWith(dirPrefix)) && isImagePath(String(t.path ?? '')),
      ).length;
    } else {
      out.warning = `GitHub API ${treeRes.status}`;
    }
  } catch (e) {
    out.warning = e instanceof Error ? e.message : String(e);
  }
  try {
    const dir = cfg.github.dir || '';
    const commitsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${COMMITS_PER_PAGE}` + (dir ? `&path=${encodeURIComponent(dir)}` : ''),
      { headers },
    );
    if (commitsRes.ok) {
      const commits = (await commitsRes.json()) as Array<{ commit?: { author?: { date?: string } } }>;
      out.commits = (Array.isArray(commits) ? commits : [])
        .map((c) => String(c?.commit?.author?.date ?? ''))
        .filter(Boolean);
      if (out.commits.length === COMMITS_PER_PAGE) {
        out.warning = out.warning
          ? `${out.warning}；远端提交记录仅取最近 ${COMMITS_PER_PAGE} 条`
          : `远端提交记录仅取最近 ${COMMITS_PER_PAGE} 条`;
      }
    } else {
      out.warning = out.warning ? `${out.warning}；GitHub API ${commitsRes.status}` : `GitHub API ${commitsRes.status}`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.warning = out.warning ? `${out.warning}；${msg}` : msg;
  }
  return out;
}

/** F25 使用统计：manifest 主源 + runs 回退 + 远端补充。远端失败降级，不抛错。 */
export async function buildStatsView(opts: {
  cwd: string;
  cfg: ResolvedConfig;
  getToken: () => string | undefined;
}): Promise<StatsView> {
  const { cwd, cfg, getToken } = opts;
  const warnings: string[] = [];
  const view = emptyStatsView();

  // 事件源 1：manifest（每条目 = 一次上传，updatedAt 为时间戳；只统计图像）
  const events: { at: Date }[] = [];
  try {
    const manifest = loadManifest(cwd);
    for (const entry of manifest.entries) {
      const p = entry.localPath || entry.publicUrl || '';
      if (!isImagePath(p)) continue;
      const t = new Date(entry.updatedAt);
      if (Number.isNaN(t.getTime())) continue;
      events.push({ at: t });
    }
  } catch (err) {
    warnings.push(`manifest 读取失败，已按空清单统计：${err instanceof Error ? err.message : String(err)}`);
  }

  // 事件源 2：runs 回退（仅 manifest 无图像事件时；run 无每图时间，精度较低）
  if (events.length === 0) {
    const runs = listRuns(cwd, 200);
    for (const run of runs) {
      const uploaded = Number(run.counts?.uploaded ?? 0);
      if (!(uploaded > 0)) continue;
      const t = new Date(run.startedAt);
      if (Number.isNaN(t.getTime())) continue;
      for (let i = 0; i < uploaded; i++) events.push({ at: t });
    }
    if (events.length > 0) view.sources.runs = events.length;
  }
  view.sources.manifest = view.sources.runs > 0 ? 0 : events.length;

  // 事件源 3：远端补充（trees 数总数；commits 在本地无事件时按提交时间填充时间线）
  const remote = await fetchRemote(cfg, getToken);
  if (remote.warning) warnings.push(remote.warning);
  if (events.length === 0 && remote.commits.length > 0) {
    for (const iso of remote.commits) {
      const t = new Date(iso);
      if (!Number.isNaN(t.getTime())) events.push({ at: t });
    }
    warnings.push(`本地无上传记录，时间线按远端提交时间估算（commit 数不等于图片数）`);
  }

  // 聚合到固定长度日/时桶
  const countByDate = new Map<string, number>();
  for (const d of view.days) countByDate.set(d.date, 0);
  for (const e of events) {
    const key = localDateKey(e.at);
    if (countByDate.has(key)) countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    view.hours[e.at.getHours()].count += 1;
  }
  for (const d of view.days) d.count = countByDate.get(d.date) ?? 0;

  view.totals.count = events.length;
  view.today.count = view.days.at(-1)?.count ?? 0;
  const last7Dates = view.days.slice(-7).map((d) => d.date);
  const prev7Dates = view.days.slice(-14, -7).map((d) => d.date);
  const count = sumRange(countByDate, last7Dates);
  const prev = sumRange(countByDate, prev7Dates);
  view.last7 = {
    count,
    prev,
    delta: count - prev,
    deltaPct: prev === 0 ? null : Math.round(((count - prev) / prev) * 100),
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
  let run = 0;
  for (const c of counts) {
    run = c > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  view.streak = { current, longest };

  // 最忙的一天（并列取最早）
  let busiest: StatsView['busiestDay'] = { date: null, count: 0 };
  for (const d of view.days) {
    if (d.count > busiest.count) busiest = { date: d.date, count: d.count };
  }
  view.busiestDay = busiest;

  if (remote.count !== null) {
    view.sources.remote = remote.count;
    view.sources.remoteAvailable = true;
  }

  view.warnings = warnings;
  return view;
}
