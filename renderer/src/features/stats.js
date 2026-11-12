import { $ } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { titles } from "../lib/titles.js";
import { renderHeatmap, renderHours } from "./stats-charts.js";

/**
 * F25 使用统计视图 v2（契约见 docs/design/module-webui.md §F25 contractVersion:2）。
 * hero 总计 / KPI / 年历热力图 / 时段（图表渲染见 stats-charts.js）。
 * 计数单位 = 成功上传动作；runs 唯一计数源；manifest/远端提交为 not-counted context。
 */

let statsData = null;

const MEASUREMENT_STATES = ["available", "partial", "unavailable"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isCount = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * v2 必填字段完整性校验（契约见 docs/design/module-webui.md §F25）。
 * 返回首个问题字段名（用于 hint 指明缺口）；null = 完整可渲染。
 * 缺字段一律走不匹配态——绝不 `?? 0` / 默认对象静默渲染为 0。
 */
function v2Problem(d) {
  if (!isObj(d)) return "data";
  if (d.contractVersion !== 2) return "contractVersion";
  const p = d.period;
  if (!isObj(p) || p.kind !== "rolling-days" || p.days !== 365) return "period";
  const m = d.measurement;
  if (
    !isObj(m) ||
    m.unit !== "successful-image-upload" ||
    m.source !== "runs" ||
    !MEASUREMENT_STATES.includes(m.state)
  ) {
    return "measurement";
  }
  const s = d.sources;
  if (!isObj(s) || !isObj(s.remoteInventory)) return "sources.remoteInventory";
  if (!isObj(d.totals) || !isCount(d.totals.count)) return "totals.count";
  if (!isObj(d.today) || !isCount(d.today.count)) return "today.count";
  const l7 = d.last7;
  if (
    !isObj(l7) ||
    !isCount(l7.count) ||
    !isCount(l7.prev) ||
    typeof l7.delta !== "number" ||
    !(l7.deltaPct === null || typeof l7.deltaPct === "number")
  ) {
    return "last7";
  }
  const st = d.streak;
  if (!isObj(st) || !isCount(st.current) || !isCount(st.longest)) return "streak";
  const b = d.busiestDay;
  if (!isObj(b) || !isCount(b.count) || !(b.date === null || typeof b.date === "string")) {
    return "busiestDay";
  }
  if (!Array.isArray(d.days) || d.days.length !== 365) return "days";
  if (!d.days.every((x) => isObj(x) && typeof x.date === "string" && isCount(x.count))) return "days[]";
  if (!Array.isArray(d.hours) || d.hours.length !== 24) return "hours";
  if (!d.hours.every((x) => isObj(x) && isCount(x.hour) && isCount(x.count))) return "hours[]";
  return null;
}

/** 契约门：data 缺失、contractVersion 非 2 或必填字段不全 → 显式不匹配态。 */
function renderContractMismatch(problem) {
  const versionOnly = !problem || problem === "contractVersion";
  const detail = versionOnly
    ? "数据版本过旧或过新，请刷新或升级应用"
    : "字段缺失或不完整（" + problem + "），请刷新或升级应用";
  $("statsTotal").textContent = "—";
  const sub = $("statsTotalSub");
  if (sub) sub.textContent = "统计契约不匹配（" + detail + "）";
  $("statsHint").textContent = versionOnly
    ? "统计契约不匹配：数据版本过旧或过新"
    : "统计契约不匹配：字段缺失或不完整（" + problem + "）";
  $("kpiToday").textContent = "—";
  $("kpi7").textContent = "—";
  $("kpi7Delta").textContent = "";
  $("kpi7Delta").classList.remove("kpi-up", "kpi-down");
  $("kpiStreak").textContent = "—";
  $("kpiStreakLongest").textContent = "";
  $("kpiBusiest").textContent = "—";
  $("kpiBusiestCount").textContent = "";
  $("statsHeatmapCard").querySelector("h3").textContent = "每日 · 过去 365 天";
  const inv = $("statsInventoryValue");
  if (inv) inv.textContent = "—";
}

/** 环比文案：null 态显示原因（无基线 / 记录不完整），不得把 null 当 0 渲染。 */
function renderDelta(last7, partial) {
  const deltaEl = $("kpi7Delta");
  deltaEl.classList.remove("kpi-up", "kpi-down");
  if (last7.deltaPct === null || last7.deltaPct === undefined) {
    // partial 记录不完整 → 比较无意义；否则是 prev=0 无对比基线
    deltaEl.textContent = partial ? "记录不完整，暂不比较" : "无对比基线";
    return;
  }
  if (last7.delta > 0) {
    deltaEl.classList.add("kpi-up");
    deltaEl.textContent = "▲ 较上周 +" + last7.deltaPct + "%";
  } else if (last7.delta < 0) {
    deltaEl.classList.add("kpi-down");
    deltaEl.textContent = "▼ 较上周 " + last7.deltaPct + "%";
  } else {
    deltaEl.textContent = "与上周持平";
  }
}

/** warnings 全量消费：hint 显第一条，其余进 title tooltip（textContent 防注入）。 */
function renderWarnings(warnings) {
  const hint = $("statsHint");
  const list = Array.isArray(warnings) ? warnings : [];
  if (list.length > 0) {
    hint.textContent = "⚠ " + list[0];
    hint.title = list.join("\n");
  } else {
    hint.title = "";
  }
}

function renderSummary(d) {
  // hero figure：一视图一个大数字（契约门已保证 totals/measurement 完整）
  const m = d.measurement;
  const total = d.totals.count;
  $("statsTotal").textContent = String(total);
  const sub = $("statsTotalSub");
  if (!sub) return;
  // 状态判定表：unavailable → 「— / 暂无可用上传记录」（占位 0 ≠ 从未上传）
  if (m.state === "unavailable") {
    $("statsTotal").textContent = "—";
    sub.textContent = "暂无可用上传记录";
    return;
  }
  sub.textContent =
    "已保存记录中成功上传 " + total + " 次图像 · 上传时间按运行开始估算" +
    (m.state === "partial" ? " · 记录不完整" : "");
}

function renderKpis(d) {
  const m = d.measurement;
  const partial = m.state === "partial";
  $("kpiToday").textContent = String(d.today.count);
  const last7 = d.last7;
  $("kpi7").textContent = String(last7.count);
  renderDelta(last7, partial);
  const streak = d.streak;
  $("kpiStreak").textContent = String(streak.current);
  $("kpiStreakLongest").textContent = "窗口内最长 " + streak.longest + " 天";
  const busiest = d.busiestDay;
  if (busiest.date && busiest.count > 0) {
    const parts = String(busiest.date).split("-");
    $("kpiBusiest").textContent = Number(parts[1]) + "月" + Number(parts[2]) + "日";
    $("kpiBusiestCount").textContent = busiest.count + " 次 · 按现存记录";
  } else {
    $("kpiBusiest").textContent = "—";
    $("kpiBusiestCount").textContent = "";
  }
}

/** 库存区独立标「当前远端库存」：remoteInventory.count 是 context，不参与 count。 */
function renderInventory(d) {
  const inv = d.sources?.remoteInventory;
  const value = $("statsInventoryValue");
  const stateEl = $("statsInventoryState");
  if (!value || !stateEl) return;
  if (!inv || inv.state === "unavailable" || typeof inv.count !== "number") {
    value.textContent = "—";
    stateEl.textContent = "未连接远端";
    return;
  }
  value.textContent = String(inv.count);
  stateEl.textContent = inv.state === "partial" ? "列表不完整，数值可能偏小" : "";
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
  // 无可用数据（unavailable）时不把空热力图说成「暂无上传记录」——那隐含「从未上传」
  const unavailable = d.measurement?.state === "unavailable";
  $("statsHeatmapCard").querySelector("h3").textContent = unavailable
    ? "每日 · 过去 365 天（无可用上传记录）"
    : "每日 · 过去 365 天";
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
  // 契约门：先于一切数字渲染；版本或必填字段不匹配时其余块不渲染
  const problem = v2Problem(d);
  if (problem) {
    renderContractMismatch(problem);
    titles.stats[1] = "统计契约不匹配 · picbed 本地控制台";
    if ($("view-stats").style.display !== "none") {
      $("pageCrumb").textContent = titles.stats[1];
    }
    return;
  }
  // 契约门已放行：totals.count 是已验证的非负 number，不再需要 ?? 0
  titles.stats[1] = "过去 365 天上传 " + d.totals.count + " 次 · picbed 本地控制台";
  if ($("view-stats").style.display !== "none") {
    $("pageCrumb").textContent = titles.stats[1];
  }
  renderWarnings(d.warnings || []);
  renderSummary(d);
  renderKpis(d);
  renderInventory(d);
  renderHeatLegend();
  renderHeatmap(d.days || []);
  renderHours(d.hours || []);
  renderStates(d);
}

export function initStats() {
  $("statsRefresh").addEventListener("click", () => renderStats());
  renderHeatLegend();
}
