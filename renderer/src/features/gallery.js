import { $, esc } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { createSelectableGrid } from "../components/selectable-grid.js";
import { openDetail } from "../components/modal.js";

let galleryPath = "";
let gallerySelectMode = false;
/** @type {Map<string,{path:string,sha:string,name:string}>} 当前已加载的图片项（path → {sha,name}） */
const galleryImgMap = new Map();

function galleryParent(p) {
  const parts = String(p || "").split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

// 可选择网格组件 — 图库实例
const gallerySelect = createSelectableGrid({
  gridId: "galleryGrid",
  deleteBtnId: "galleryDelete",
  itemSelector: ".file-card",
  keyAttr: "path",
  canSelect: (el) => gallerySelectMode && !el.dataset.dir && Boolean(el.dataset.path),
  confirmMsg: "将从 GitHub 仓库中永久删除选中的 {n} 张图片（不可恢复），确认删除？",
  async onDelete(keys) {
    const items = keys
      .map((p) => {
        const meta = galleryImgMap.get(p);
        return meta ? { path: meta.path, sha: meta.sha, name: meta.name } : null;
      })
      .filter(Boolean);
    const { data } = await api("/api/gallery/delete", { items });
    const d = (data.data && data.data.deleted) || 0;
    const f = (data.data && data.data.failed) || [];
    galleryExitSelectMode();
    loadGallery();
    if (f.length) { toast("已删除 " + d + " 张，失败 " + f.length + " 张"); return false; }
    return d;
  },
  onSuccess(n) { toast("已删除 " + n + " 张"); },
});

function galleryExitSelectMode() {
  gallerySelectMode = false;
  gallerySelect.clear();
  const btn = $("gallerySelect");
  if (btn) { btn.textContent = "选择"; btn.classList.remove("btn-primary"); btn.classList.add("btn-ghost"); }
  const g = $("galleryGrid");
  if (g) g.classList.remove("select-mode");
  gallerySelect.sync();
}

function galleryEnterSelectMode() {
  gallerySelectMode = true;
  const btn = $("gallerySelect");
  if (btn) { btn.textContent = "取消选择"; btn.classList.remove("btn-ghost"); btn.classList.add("btn-primary"); }
  const g = $("galleryGrid");
  if (g) g.classList.add("select-mode");
  gallerySelect.sync();
}

export async function loadGallery() {
  const grid = $("galleryGrid");
  const empty = $("galleryEmpty");
  $("galleryPath").textContent = "/" + galleryPath;
  if ($("galleryUp")) $("galleryUp").hidden = !galleryPath;
  grid.innerHTML = '<div class="muted">加载中…</div>';
  empty.hidden = true;
  galleryImgMap.clear();
  gallerySelect.clear();
  const { status, data } = await api("/api/gallery?path=" + encodeURIComponent(galleryPath));
  if (!data.ok) {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.textContent = (data.error && data.error.message) || ("加载失败 " + status);
    return;
  }
  const items = (data.data && data.data.items) || [];
  if (!items.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    empty.textContent = "此目录为空";
    return;
  }
  grid.innerHTML = items
    .map((it) => {
      const isDir = it.type === "dir";
      const isImg = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(it.name || "");
      if (!isDir && !isImg) return "";
      if (!isDir && it.sha) {
        galleryImgMap.set(it.path, { path: it.path, sha: it.sha, name: it.name || it.path });
      }
      return (
        '<div class="file-card" data-dir="' + (isDir ? esc(it.path) : "") + '" data-path="' + esc(it.path || "") + '" data-url="' + esc(it.url || "") + '" data-name="' + esc(it.name) + '">' +
        '<span class="fc-check">✓</span>' +
        '<div class="file-thumb th' + ((isDir ? 1 : 2)) + '">' +
        (isDir ? "📁" : isImg && it.url ? '<img src="' + esc(it.url) + '" alt="" onerror="this.remove()"/>' : "🖼") +
        '</div><div class="file-meta"><div class="name">' + esc(it.name) +
        '</div><div class="row"><span>' + (isDir ? "文件夹" : (it.size ? Math.round(it.size / 1024) + " KB" : "")) +
        '</span></div></div></div>'
      );
    })
    .join("");
  // 绑定选择 toggle（组件内部根据 canSelect 判断是否可选）
  gallerySelect.bind();
  // 非选择模式下的导航行为（打开详情 / 进入文件夹）
  /** @type {NodeListOf<HTMLElement>} */ (grid.querySelectorAll(".file-card")).forEach((card) => {
    card.addEventListener("click", () => {
      if (gallerySelectMode) return; // 选择模式下由组件处理 toggle，不走导航
      const dir = card.dataset.dir;
      if (dir) {
        galleryPath = dir;
        loadGallery();
        return;
      }
      openDetail(card.dataset.name, card.dataset.url);
    });
  });
}

export function initGallery() {
  $("galleryUp") && ($("galleryUp").onclick = () => {
    galleryPath = galleryParent(galleryPath);
    loadGallery();
  });
  $("galleryRefresh") && ($("galleryRefresh").onclick = () => loadGallery());
  $("gallerySelect") && ($("gallerySelect").onclick = () => {
    if (gallerySelectMode) galleryExitSelectMode();
    else galleryEnterSelectMode();
  });
  // galleryDelete 的删除逻辑由 gallerySelect 组件内部绑定处理
}
