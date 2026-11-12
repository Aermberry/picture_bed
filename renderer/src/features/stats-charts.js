import { $ } from "../lib/dom.js";

/** F25 图表渲染（零依赖 SVG）：年历热力图 + 24 小时柱状图。 */

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

/** 热力图 5 档：0 / 1 / 2–3 / 4–7 / 8+（lv0 空、lv1–4 递深）。 */
function heatLevel(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 7) return 3;
  return 4;
}

/** 读取容器当前内容宽度（自适应 SVG 用；隐藏时回退父卡宽度）。 */
function measureWidth(el) {
  const w = Math.round(el.getBoundingClientRect().width);
  if (w > 0) return w;
  const card = el.closest(".card");
  const cw = card ? Math.round(card.getBoundingClientRect().width) : 0;
  return cw > 48 ? cw - 48 : 720;
}

/**
 * GitHub 风格年历热力图：53 周列 × 7 行（周日–周六）。
 * 宽度自适应：CELL 按容器伸缩（min 9 / max 15），窄容器横向滚动；月标签防挤压（视距 < 22px 丢弃）。
 */
export function renderHeatmap(days, el) {
  const wrap = el || $("statsHeatmap");
  wrap.textContent = "";
  const list = Array.isArray(days) ? days : [];
  if (list.length === 0) return;

  const rows = 7;
  const availW = measureWidth(wrap);
  const LEFT = 26; // 行标签（一/三/五）
  const TOP = 18; // 月标签带
  const GAP = 3;
  // 首日星期补位（firstDow 个空槽）+ 完整周数
  const firstDowPre = new Date(list[0].date + "T00:00:00").getDay();
  const numWeeks = Math.ceil((firstDowPre + list.length) / rows);
  // 反解 CELL：availW ≈ LEFT + numWeeks*(CELL+GAP)，伸缩区间 [9,15]
  const CELL = Math.max(9, Math.min(15, Math.floor((availW - LEFT - 2) / numWeeks - GAP)));

  const weeks = [];
  let cur = [];
  list.forEach((d, i) => {
    if (i === 0) {
      for (let e = 0; e < firstDowPre; e++) cur.push(null);
    }
    cur.push(d);
    if (cur.length === rows) {
      weeks.push(cur);
      cur = [];
    }
  });
  if (cur.length > 0) {
    while (cur.length < rows) cur.push(null);
    weeks.push(cur);
  }

  const width = LEFT + weeks.length * (CELL + GAP) - GAP + 2;
  const height = TOP + rows * (CELL + GAP) - GAP + 2;
  const svg = svgEl("svg");
  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.setAttribute("width", "100%");
  svg.setAttribute("role", "img");
  svg.style.maxWidth = width + "px";
  svg.style.minWidth = (LEFT + 26 * (CELL + GAP)) + "px"; // 窄容器滚动而非压碎格子

  // 月标签：跨月标记 + 防挤压（与上一标签视距 < 22px 则丢弃）
  let lastMonth = -1;
  let lastLabelX = -Infinity;
  weeks.forEach((week, w) => {
    const firstDay = week.find(Boolean);
    if (!firstDay) return;
    const m = Number(String(firstDay.date).split("-")[1]) - 1;
    if (m !== lastMonth) {
      lastMonth = m;
      const x = LEFT + w * (CELL + GAP);
      if (x - lastLabelX >= 22) {
        lastLabelX = x;
        const t = svgEl("text");
        t.setAttribute("x", String(x));
        t.setAttribute("y", "12");
        t.setAttribute("class", "heat-month");
        t.textContent = m + 1 + "月";
        svg.appendChild(t);
      }
    }
  });
  // 行标签：一 / 三 / 五
  [["一", 1], ["三", 3], ["五", 5]].forEach(([label, r]) => {
    const t = svgEl("text");
    t.setAttribute("x", "0");
    t.setAttribute("y", String(TOP + r * (CELL + GAP) + CELL - 2));
    t.setAttribute("class", "heat-month");
    t.textContent = label;
    svg.appendChild(t);
  });

  weeks.forEach((week, w) => {
    week.forEach((d, r) => {
      if (!d) return;
      const rect = svgEl("rect");
      rect.setAttribute("x", String(LEFT + w * (CELL + GAP)));
      rect.setAttribute("y", String(TOP + r * (CELL + GAP)));
      rect.setAttribute("width", String(CELL));
      rect.setAttribute("height", String(CELL));
      rect.setAttribute("rx", "3");
      rect.setAttribute("class", "heat-cell heat-lv" + heatLevel(d.count));
      const parts = String(d.date).split("-");
      const title = svgEl("title");
      title.textContent =
        Number(parts[1]) + "月" + Number(parts[2]) + "日: 成功上传 " + d.count + " 次图像（按运行时间）";
      rect.appendChild(title);
      svg.appendChild(rect);
    });
  });
  wrap.appendChild(svg);
}

/**
 * 24 小时柱状图：宽度自适应容器；y 轴刻度在左；柱顶 4px 圆角、基线直角；
 * 柱窄于 24px 时叠加整槽透明热区（命中区 ≥24px）；hover 提亮（CSS）。
 */
export function renderHours(hours, el) {
  const wrap = el || $("statsHours");
  wrap.textContent = "";
  const list = Array.isArray(hours) ? hours : [];
  if (list.length === 0) return;

  const availW = measureWidth(wrap);
  const W = Math.max(420, availW);
  const H = 170;
  const TOP_PAD = 28; // 峰值标注带
  const axisW = 30; // 左侧 y 刻度带
  const bottomBand = 20; // 底部 x 刻度带
  const plotH = H - TOP_PAD - bottomBand;
  const max = Math.max(1, ...list.map((h) => h.count || 0));
  const plotW = W - axisW - 6;
  const slot = plotW / list.length;
  const barW = Math.min(24, Math.max(8, slot - 6));
  const peak = list.reduce((a, b) => ((b.count || 0) > (a.count || 0) ? b : a), list[0]);

  const svg = svgEl("svg");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("width", "100%");
  svg.setAttribute("role", "img");
  svg.style.maxWidth = W + "px";

  // y 轴取整刻度（实线 hairline 网格；刻度文字在绘图区左侧，0 省略）
  // 同一 v 只画一条线 + 一个标签（max=1 时 s=1/2 的 v 同为 1，否则两条线重叠）；
  // s=0 的 v=0 基线不受去重影响，必须保留。
  const steps = 2;
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const v = Math.round((max * s) / steps);
    if (seen.has(v) && s > 0) continue;
    const y = TOP_PAD + plotH - (v / max) * plotH;
    const line = svgEl("line");
    line.setAttribute("x1", String(axisW));
    line.setAttribute("x2", String(W - 2));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("class", "hour-grid");
    svg.appendChild(line);
    if (s > 0) {
      seen.add(v);
      const lab = svgEl("text");
      lab.setAttribute("x", String(axisW - 6));
      lab.setAttribute("y", String(y + 3));
      lab.setAttribute("class", "hour-tick");
      lab.setAttribute("text-anchor", "end");
      lab.textContent = String(v);
      svg.appendChild(lab);
    }
  }

  list.forEach((h) => {
    const v = h.count || 0;
    const bh = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
    const x = axisW + h.hour * slot + (slot - barW) / 2;
    const y = TOP_PAD + plotH - bh;
    let bar;
    if (v > 0) {
      // 顶 4px 圆角、底直角：必须用 path（rect 没有 d 属性）
      bar = svgEl("path");
      const r = Math.min(4, bh);
      bar.setAttribute(
        "d",
        `M${x},${TOP_PAD + plotH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${TOP_PAD + plotH} Z`,
      );
      bar.setAttribute("class", "hour-bar");
    } else {
      bar = svgEl("rect");
      bar.setAttribute("x", String(x));
      bar.setAttribute("y", String(TOP_PAD + plotH - 1));
      bar.setAttribute("width", String(barW));
      bar.setAttribute("height", "1");
      bar.setAttribute("class", "hour-bar hour-bar-empty");
    }
    const title = svgEl("title");
    const hh = String(h.hour).padStart(2, "0");
    title.textContent = hh + ":00–" + String((h.hour + 1) % 24).padStart(2, "0") + ":00 · 成功上传 " + v + " 次图像（按运行时间）";
    bar.appendChild(title);
    svg.appendChild(bar);
    // 命中区 ≥24px：柱窄时叠加整槽透明热区
    if (barW < 24) {
      const hit = svgEl("rect");
      hit.setAttribute("x", String(axisW + h.hour * slot));
      hit.setAttribute("y", String(TOP_PAD));
      hit.setAttribute("width", String(slot));
      hit.setAttribute("height", String(plotH));
      hit.setAttribute("fill", "transparent");
      hit.appendChild(title.cloneNode(true));
      hit.setAttribute("class", "hour-hit");
      svg.appendChild(hit);
    }
  });

  // 峰值标注（极端直接标注，其余交给轴 + tooltip）
  if (peak.count > 0) {
    const px = axisW + peak.hour * slot + slot / 2;
    const t = svgEl("text");
    t.setAttribute("x", String(Math.min(Math.max(px, axisW + 60), W - 60)));
    t.setAttribute("y", "14");
    t.setAttribute("class", "hour-peak");
    t.setAttribute("text-anchor", "middle");
    t.textContent =
      String(peak.hour).padStart(2, "0") + ":00–" + String((peak.hour + 1) % 24).padStart(2, "0") + ":00 最忙";
    svg.appendChild(t);
  }

  // x 刻度 0/6/12/18（对齐绘图区）
  [0, 6, 12, 18].forEach((hour) => {
    const t = svgEl("text");
    t.setAttribute("x", String(axisW + hour * slot + slot / 2));
    t.setAttribute("y", String(H - 4));
    t.setAttribute("class", "hour-tick");
    t.setAttribute("text-anchor", "middle");
    t.textContent = String(hour);
    svg.appendChild(t);
  });

  wrap.appendChild(svg);
}
