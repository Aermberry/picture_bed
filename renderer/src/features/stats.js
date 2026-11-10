import { $ } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { titles } from "../lib/titles.js";
import { renderHeatmap, renderHours } from "./stats-charts.js";

/** F25 使用统计视图：hero 总计 / KPI / 年历热力图 / 时段（图表渲染见 stats-charts.js）。 */

let statsData = null;

function renderSummary(d) {
  // hero figure：一视图一个大数字（占比条/图例已删——单系列无需图例，满宽条零信息量）
  $("statsTotal").textContent = String(d.totals?.count ?? 0);
  const sub = $("statsTotalSub");
  if (sub) {
    const total = d.totals?.count ?? 0;
    sub.textContent = total > 0
      ? "过去一年累计上传 " + total + " 张图像"
      : "暂无上传记录";
  }
}

function renderKpis(d) {
  $("kpiToday").textContent = String(d.today?.count ?? 0);
  const last7 = d.last7 || { count: 0, delta: 0, deltaPct: null };
  $("kpi7").textContent = String(last7.count);
  const deltaEl = $("kpi7Delta");
  deltaEl.classList.remove("kpi-up", "kpi-down");
  if (last7.deltaPct === null || last7.deltaPct === undefined) {
    deltaEl.textContent = "无对比基线";
  } else if (last7.delta > 0) {
    deltaEl.classList.add("kpi-up");
    deltaEl.textContent = "▲ 较上周 +" + last7.deltaPct + "%";
  } else if (last7.delta < 0) {
    deltaEl.classList.add("kpi-down");
    deltaEl.textContent = "▼ 较上周 " + last7.deltaPct + "%";
  } else {
    deltaEl.textContent = "与上周持平";
  }
  const streak = d.streak || { current: 0, longest: 0 };
  $("kpiStreak").textContent = String(streak.current ?? 0);
  $("kpiStreakLongest").textContent = "最长 " + (streak.longest ?? 0) + " 天";
  const busiest = d.busiestDay || { date: null, count: 0 };
  if (busiest.date && busiest.count > 0) {
    const parts = String(busiest.date).split("-");
    $("kpiBusiest").textContent = Number(parts[1]) + "月" + Number(parts[2]) + "日";
    $("kpiBusiestCount").textContent = busiest.count + " 张";
  } else {
    $("kpiBusiest").textContent = "—";
    $("kpiBusiestCount").textContent = "";
  }
}

/** 色阶图例：5 档样本 + 「少 → 多」（顺序色阶必须配比例尺）。 */
function renderHeatLegend() {
  const box = $("statsHeatLegend");
  if (!box || box.dataset.ready === "1") return;
  box.textContent = "";
  box.appendChild(document.createTextNode("少"));
  for (let lv = 0; lv <= 4; lv++) {
    const s = document.createElement("span");
    s.className = "heat-swatch heat-lv" + lv;
    box.appendChild(s);
  }
  box.appendChild(document.createTextNode("多"));
  box.dataset.ready = "1";
}

function renderStates(d) {
  const hint = $("statsHint");
  if (d.sources && d.sources.remote === null) {
    hint.textContent = "本地 manifest 聚合 · 未连接远端（需配置 GitHub 与 token）";
  } else if (d.sources && d.sources.remoteAvailable) {
    hint.textContent = "本地 manifest 与远端仓库聚合 · 仅统计图像";
  }
  const empty = (d.totals?.count ?? 0) === 0 && (d.sources?.runs ?? 0) === 0;
  $("statsHeatmapCard").querySelector("h3").textContent = empty
    ? "每日 · 过去一年（暂无上传记录）"
    : "每日 · 过去一年";
}

export async function renderStats() {
  try {
    const res = await api("/api/stats");
    if (!res.data?.ok) throw new Error(res.data?.error?.message || "统计获取失败");
    statsData = res.data.data;
  } catch (err) {
    $("statsHint").textContent = "统计获取失败：" + (err instanceof Error ? err.message : String(err));
    return;
  }
  const d = statsData || {};
  titles.stats[1] =
    "总计 " + (d.totals?.count ?? 0) + " 张 · picbed 本地控制台";
  if ($("view-stats").style.display !== "none") {
    $("pageCrumb").textContent = titles.stats[1];
  }
  renderSummary(d);
  renderKpis(d);
  renderHeatLegend();
  renderHeatmap(d.days || []);
  renderHours(d.hours || []);
  renderStates(d);
}

export function initStats() {
  $("statsRefresh").addEventListener("click", () => renderStats());
  renderHeatLegend();
}
