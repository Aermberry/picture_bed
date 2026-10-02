import { $, esc } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { confirmAsync } from "../components/modal.js";
import { createSelectableGrid } from "../components/selectable-grid.js";
import { isImageName, isDocName } from "../lib/files.js";

/** @type {any[]} */
let wallItems = [];

/** @param {any} p */
export function wallKey(p) {
  if (p && typeof p === "object") return String(p.abs || p.src || p.name || "");
  return String(p || "");
}

// 可选择网格组件 — 照片墙实例
const wallSelect = createSelectableGrid({
  gridId: "previewGrid",
  deleteBtnId: "btnDelete",
  itemSelector: ".tile",
  keyAttr: "key",
  canSelect: (el) => Boolean(el.dataset.key),
  confirmMsg: "将从预览与会话中移除选中的 {n} 张图片（不上传、不改文档），确认删除？",
  successMsg: "已删除 {n} 张",
  async onDelete(keys) {
    wallItems = wallItems.filter((p) => !keys.includes(wallKey(p)));
    setPreviewImages(wallItems);
    await api("/api/session/remove", { keys });
  },
});

/** @param {any[]} items */
export function mergeWallItems(items) {
  /** @type {Record<string, number>} */
  const seen = {};
  for (const w of wallItems) seen[wallKey(w)] = 1;
  for (const p of items || []) {
    const key = wallKey(p);
    if (!key || seen[key]) continue;
    seen[key] = 1;
    wallItems.push(p);
  }
  setPreviewImages(wallItems);
}

/** @param {string=} title */
export function setPreviewIdle(title) {
  wallItems = [];
  wallSelect.clear();
  const g = $("previewGrid");
  const bar = $("wallSubbar");
  const idleHead = $("dzIdleHead");
  const dz = $("dropzone");
  if (g) {
    g.hidden = true;
    g.innerHTML = "";
  }
  if (bar) bar.hidden = true;
  if (idleHead) idleHead.hidden = false;
  if (dz) dz.classList.remove("has-photos");
  if (title) $("dropTitle").textContent = title;
}

/**
 * 最短列优先瀑布流：把 tile 分进 N 个 flex 列，每张进当前最矮的列。
 * 必须先清掉旧 pw-col，否则 load 事件会不断堆空列把内容挤没。
 */
let layoutWallTimer = null;
export function schedulePhotoWallLayout() {
  if (layoutWallTimer != null) clearTimeout(layoutWallTimer);
  layoutWallTimer = window.setTimeout(() => {
    layoutWallTimer = null;
    layoutPhotoWall();
  }, 40);
}

export function layoutPhotoWall() {
  const g = $("previewGrid");
  if (!g || g.hidden) return;
  const tiles = Array.from(g.querySelectorAll(".tile"));
  // drop previous column wrappers so they cannot accumulate as empty flex tracks
  g.querySelectorAll(".pw-col").forEach((c) => {
    const parent = c.parentNode;
    while (c.firstChild) parent.insertBefore(c.firstChild, c);
    if (parent) parent.removeChild(c);
  });
  if (!tiles.length) return;
  const w = g.clientWidth || 800;
  const n = w < 640 ? 2 : w < 1000 ? 3 : 4;
  /** @type {HTMLElement[]} */
  const cols = [];
  for (let i = 0; i < n; i++) {
    const col = document.createElement("div");
    col.className = "pw-col";
    col.style.paddingTop = i * 6 + "px";
    cols.push(col);
    g.appendChild(col);
  }
  const heights = new Array(n).fill(0);
  tiles.forEach((t) => {
    let best = 0;
    for (let i = 1; i < n; i++) if (heights[i] < heights[best] - 0.5) best = i;
    cols[best].appendChild(t);
    heights[best] += (t.offsetHeight || t.getBoundingClientRect().height || 120) + 6;
  });
}

/** @param {any[]} items */
export function setPreviewImages(items) {
  const g = $("previewGrid");
  const a = $("previewActions");
  const dz = $("dropzone");
  if (!g || !a) return;
  if (!items || !items.length) {
    setPreviewIdle();
    return;
  }
  // flat tiles first; layoutPhotoWall re-buckets them into columns
  g.innerHTML = items
    .map((p) => {
      let src = "";
      let name = "";
      if (p && typeof p === "object") {
        src = p.src || "";
        name = p.name || (p.abs ? String(p.abs).split(/[\\/]/).pop() || "" : "");
      } else if (typeof p === "string") {
        if (p.indexOf("blob:") === 0 || p.indexOf("data:") === 0) src = p;
        else {
          src = "/api/preview?path=" + encodeURIComponent(p);
          name = String(p).split(/[\\/]/).pop() || "";
        }
      }
      if (!src) return "";
      return (
        '<figure class="tile" data-key="' + esc(wallKey(p)) + '">' +
        '<img alt="" loading="lazy" src="' + src + '" />' +
        '<span class="check">✓</span>' +
        '<span class="sel-tag">已选</span>' +
        (name ? '<figcaption class="name">' + esc(name) + "</figcaption>" : "") +
        "</figure>"
      );
    })
    .join("");
  g.hidden = false;
  if (dz) dz.classList.add("has-photos");
  layoutPhotoWall();
  // Keep the headline in sync with tiles actually in the wall (failed loads drop out).
  /** @type {NodeListOf<HTMLImageElement>} */ (g.querySelectorAll("img")).forEach((img) => {
    img.addEventListener("error", () => {
      const tile = img.parentNode;
      if (tile && tile.parentNode) tile.parentNode.removeChild(tile);
      syncWallChrome();
      schedulePhotoWallLayout();
    });
    img.addEventListener("load", () => schedulePhotoWallLayout());
  });
  // 点选图块 → 多选删除（委托给组件）
  wallSelect.bind();
  // restore selection for tiles kept across re-render
  wallSelect.restore();
  syncWallChrome();
  wallSelect.sync();
}

/** Show actions/headline only when the wall actually has tiles. */
export function syncWallChrome() {
  const g = $("previewGrid");
  const a = $("previewActions");
  const dz = $("dropzone");
  const bar = $("wallSubbar");
  const idleHead = $("dzIdleHead");
  const n = g ? g.querySelectorAll(".tile").length : 0;
  if (a) a.hidden = n === 0;
  if (bar) bar.hidden = n === 0;
  if (idleHead) idleHead.hidden = n > 0;
  if (n === 0) {
    if (dz) dz.classList.remove("has-photos");
    $("dropTitle").textContent = "扫描到 0 张图片";
    return;
  }
  if (dz) dz.classList.add("has-photos");
  $("dropTitle").textContent = photoWallTitle();
}

/** @returns {string} */
export function photoWallTitle() {
  const g = $("previewGrid");
  const n = g ? g.querySelectorAll(".tile").length : 0;
  return "扫描到 " + n + " 张图片";
}

/** @returns {number} */
export function wallCount() {
  return wallItems.length;
}

/** @param {any=} dropInfo */
export async function scanIntoPreview(dropInfo) {
  /** @type {any[]} */
  const paths = [];
  /** @type {Record<string, number>} */
  const seen = {};
  /** @param {any} p */
  function addPath(p) {
    const key = wallKey(p);
    if (!key || seen[key]) return;
    seen[key] = 1;
    paths.push(p);
  }

  // 0) this drop's File blobs — works without absolute FS path
  if (dropInfo && dropInfo.blobPreviews) {
    for (const b of dropInfo.blobPreviews) addPath(b);
  }
  if (dropInfo && dropInfo.previewPaths) {
    for (const p of dropInfo.previewPaths) {
      // blob 预览已覆盖同一文件，跳过服务器副本避免重复
      if (dropInfo.blobPreviews && dropInfo.blobPreviews.some((/** @type {any} */ b) => b.abs && b.abs === p)) continue;
      addPath(p);
    }
  }

  // 1) image refs inside THIS drop's docs only (never expand to the whole scan root)
  const dropDocs = (dropInfo && dropInfo.dropDocs) || [];
  if (dropDocs.length) {
    try {
      const { data } = await api("/api/plan", {});
      if (data.ok) {
        const plan = (data.data && data.data.plan) || [];
        /** @type {Record<string, number>} */
        const docSet = {};
        for (const d of dropDocs) docSet[String(d).replace(/\\/g, "/")] = 1;
        for (const p of plan) {
          if (!p.localPath) continue;
          if (p.action === "blocked" || p.action === "skip-remote") continue;
          const doc = String(p.doc || "").replace(/\\/g, "/");
          if (!doc || !docSet[doc]) continue;
          addPath(p.localPath);
        }
      } else if (!paths.length && !wallItems.length) {
        toast((data.error && data.error.message) || "扫描失败");
      }
    } catch (_) {
      if (!paths.length && !wallItems.length) toast("扫描失败");
    }
  }

  // Accumulate: keep tiles from earlier drops; only append this drop's hits.
  mergeWallItems(paths);
  if (!paths.length && !wallItems.length) toast("未扫描到本地图片");
}

/** 吸顶条背景随滚动渐隐（最低 0.82，禁止全透明） */
export function updateWallBarFade() {
  const head = document.querySelector(".dz-head");
  if (!head) return;
  // find the deepest scrolling offset above the bar
  let y = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollers = document.querySelectorAll(".content, .main, .dropzone");
  scrollers.forEach((s) => {
    if (s.scrollTop > y) y = s.scrollTop;
  });
  const minA = 0.82;
  const a = Math.max(minA, 1 - Math.min(1 - minA, y / 240 * (1 - minA)));
  head.style.setProperty("--dz-head-alpha", String(a));
}

/** 照片墙操作（重置 / 上传）与随宽度重排的监听。 */
export function initWall() {
  $("btnReset").onclick = async () => {
    await api("/api/session/reset", {});
    setPreviewIdle();
    wallSelect.clear();
    toast("已重置");
  };

  // btnDelete 的删除逻辑由 wallSelect 组件内部绑定处理（无需再设 onclick）

  $("btnUpload").onclick = async () => {
    if (!(await confirmAsync("将上传图片并改写文档，确认上传？"))) return;
    const { status, data } = await api("/api/sync", { confirm: true, dryRun: false });
    if (data.ok) {
      const c = (data.data && data.data.counts) || {};
      toast(c.uploaded != null ? "上传完成 · " + c.uploaded : "上传完成");
      setPreviewIdle();
      wallSelect.clear();
    } else {
      toast((data.error && data.error.message) || "上传失败 " + status);
    }
  };

  // 列数/最短列分布需随宽度变化重算
  let staggerTimer = null;
  window.addEventListener("resize", () => {
    if (staggerTimer != null) clearTimeout(staggerTimer);
    staggerTimer = window.setTimeout(() => {
      staggerTimer = null;
      schedulePhotoWallLayout();
    }, 120);
  });

  // capture:true so any scrolling ancestor notifies us
  window.addEventListener("scroll", updateWallBarFade, { passive: true, capture: true });
  updateWallBarFade();
}
