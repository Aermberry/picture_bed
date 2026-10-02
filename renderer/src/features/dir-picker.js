import { $, esc } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { loadConfigForm } from "./settings.js";

/* ── 目录选择浮层（设置页 github.dir）──────────────────────────────
 * 浏览仓库远程目录（复用 GET /api/gallery?path=），可进入子目录、返回上级、
 * 新建文件夹（服务端提交 .gitkeep 占位），选中/新建成功即写入 github.dir。
 * 与 toast 的区别：可停留、可交互，不自动消失。
 */
const dirPicker = $("dirPicker");
/** @type {any} */
let dirPickerHideTimer = null;
let dirPickerPath = "";
let dirPickerBusy = false;

/** @param {string=} text @param {string=} kind "info" → 引导文案（非红色错误） */
function dirPickerMsg(text, kind) {
  const el = $("dirPickerMsg");
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = "";
    el.className = "dir-picker-msg";
    return;
  }
  el.textContent = text;
  el.className = kind === "info" ? "dir-picker-msg info" : "dir-picker-msg";
  el.hidden = false;
}

/** @param {boolean} busy */
function dirPickerSetBusy(busy) {
  dirPickerBusy = busy;
  const use = $("dirPickerUse");
  const create = $("dirPickerCreate");
  if (use) {
    use.disabled = busy;
    use.textContent = busy ? "处理中…" : "选用当前目录";
  }
  if (create) {
    create.disabled = busy;
    create.textContent = busy ? "处理中…" : "新建并选用";
  }
}

function renderDirPickerPath() {
  const el = $("dirPickerPath");
  if (!el) return;
  const parts = dirPickerPath ? dirPickerPath.split("/") : [];
  el.innerHTML = parts.length
    ? "/" +
      parts
        .map((p, i) => (i === parts.length - 1 ? `<span class="seg-last">${esc(p)}</span>` : esc(p)))
        .join(" / ")
    : "/";
  const up = $("dirPickerUp");
  if (up) up.hidden = !dirPickerPath;
}

/** @param {any[]} dirs */
function renderDirPickerList(dirs) {
  const list = $("dirPickerList");
  if (!list) return;
  if (!dirs.length) {
    list.innerHTML = `<div class="dir-picker-empty">此目录没有子文件夹</div>`;
    return;
  }
  const current = String($("cfgDir") ? $("cfgDir").value.trim() : "");
  list.innerHTML = dirs
    .map((d) => {
      const isCurrent = d.path === current;
      return (
        `<div class="dir-picker-item${isCurrent ? " current" : ""}" data-dir="${esc(d.path)}" title="进入 ${esc(d.path)}">` +
        `<span class="ico">📁</span><span class="name">${esc(d.name)}</span>` +
        (isCurrent ? `<span class="tag">当前</span>` : "") +
        `<span class="enter">›</span></div>`
      );
    })
    .join("");
}

async function dirPickerLoad() {
  const list = $("dirPickerList");
  if (list) list.innerHTML = `<div class="dir-picker-empty">加载中…</div>`;
  const { status, data } = await api(`/api/gallery?path=${encodeURIComponent(dirPickerPath)}`);
  if (!data || !data.ok) {
    const err = (data && data.error) || {};
    if (err.code === "E_NOT_FOUND" && dirPickerPath) {
      // 种子/当前目录在远端不存在：回退到最近存在的祖先，并预填新建名引导创建
      const missing = dirPickerPath;
      const idx = dirPickerPath.lastIndexOf("/");
      dirPickerPath = idx === -1 ? "" : dirPickerPath.slice(0, idx);
      renderDirPickerPath();
      const nameInput = $("dirPickerNewName");
      const seg = missing.slice(idx + 1);
      if (nameInput && !nameInput.value.trim()) nameInput.value = seg;
      dirPickerMsg(
        `目录 ${missing} 不存在——已定位到其上级 ${dirPickerPath || "/"}；点「新建并选用」可创建它`,
        "info",
      );
      return dirPickerLoad();
    }
    let hint = "";
    if (err.code === "E_TOKEN") hint = "请在设置中粘贴 PAT 保存，或本机 gh auth login";
    else if (err.code === "E_CONFIG") hint = "请先填写并保存 github.owner / github.repo";
    dirPickerMsg(`${err.message || `加载失败（HTTP ${status}）`}${hint ? ` · ${hint}` : ""}`);
    if (list) list.innerHTML = "";
    return;
  }
  const dirs = (((data.data || {}).items) || []).filter((/** @type {any} */ it) => it.type === "dir");
  renderDirPickerList(dirs);
}

/** @param {string=} initial */
export async function openDirPicker(initial) {
  if (!dirPicker) return;
  if (dirPickerHideTimer) {
    clearTimeout(dirPickerHideTimer);
    dirPickerHideTimer = null;
  }
  const seed = initial !== undefined ? initial : String($("cfgDir") ? $("cfgDir").value.trim() : "");
  dirPickerPath = String(seed || "").replace(/^\/+|\/+$/g, "");
  dirPickerMsg("");
  dirPicker.hidden = false;
  requestAnimationFrame(() => dirPicker.classList.add("show"));
  renderDirPickerPath();
  await dirPickerLoad();
}

function closeDirPicker() {
  if (!dirPicker || dirPicker.hidden) return;
  dirPicker.classList.remove("show");
  dirPickerHideTimer = setTimeout(() => {
    dirPicker.hidden = true;
    dirPickerHideTimer = null;
  }, 180);
}

/** 写入 github.dir 并立即保存（不再要求点「保存设置」）。 @param {string} value */
async function applyDir(value) {
  if (dirPickerBusy) return;
  dirPickerSetBusy(true);
  const { status, data } = await api("/api/config", { key: "github.dir", value, confirm: true });
  dirPickerSetBusy(false);
  if (!data || !data.ok) {
    const err = (data && data.error) || {};
    dirPickerMsg(err.message || `保存失败（HTTP ${status}）`);
    return;
  }
  if ($("cfgDir")) $("cfgDir").value = value;
  closeDirPicker();
  toast(value ? `目录已更新为 ${value}` : "目录已更新为仓库根目录");
  loadConfigForm();
}

export function initDirPicker() {
  if (!dirPicker) return;
  const cfgDirInput = $("cfgDir");
  const pickBtn = $("cfgDirPick");
  if (pickBtn) pickBtn.onclick = () => openDirPicker();
  if (cfgDirInput) cfgDirInput.addEventListener("focus", () => openDirPicker());

  $("dirPickerClose").onclick = closeDirPicker;
  $("dirPickerRefresh").onclick = () => dirPickerLoad();
  $("dirPickerUp").onclick = async () => {
    const idx = dirPickerPath.lastIndexOf("/");
    dirPickerPath = idx === -1 ? "" : dirPickerPath.slice(0, idx);
    renderDirPickerPath();
    await dirPickerLoad();
  };
  $("dirPickerList").addEventListener("click", async (ev) => {
    const item = /** @type {HTMLElement} */ (ev.target).closest(".dir-picker-item");
    if (!item) return;
    const next = item.dataset.dir || "";
    dirPickerPath = next;
    renderDirPickerPath();
    await dirPickerLoad();
  });
  $("dirPickerUse").onclick = () => applyDir(dirPickerPath);
  $("dirPickerCreate").onclick = async () => {
    if (dirPickerBusy) return;
    const nameInput = $("dirPickerNewName");
    const name = String((nameInput && nameInput.value) || "").trim().replace(/^\/+|\/+$/g, "");
    if (!name) {
      dirPickerMsg("请输入新文件夹名");
      return;
    }
    if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
      dirPickerMsg("文件夹名不能包含 / 或 \\，也不能是 . 或 ..");
      return;
    }
    const target = dirPickerPath ? `${dirPickerPath}/${name}` : name;
    dirPickerSetBusy(true);
    const { status, data } = await api("/api/repo/mkdir", { path: target, confirm: true });
    if (!data || !data.ok) {
      dirPickerSetBusy(false);
      const err = (data && data.error) || {};
      let hint = "";
      if (err.code === "E_TOKEN") hint = "请在设置中粘贴 PAT 保存，或本机 gh auth login";
      else if (err.code === "E_CONFIG") hint = "请先填写并保存 github.owner / github.repo";
      dirPickerMsg(`${err.message || `创建失败（HTTP ${status}）`}${hint ? ` · ${hint}` : ""}`);
      return;
    }
    if (nameInput) nameInput.value = "";
    dirPickerSetBusy(false);
    await applyDir(target);
  };

  document.addEventListener("click", (ev) => {
    if (dirPicker.hidden) return;
    const t = /** @type {Node} */ (ev.target);
    if (dirPicker.contains(t) || t === cfgDirInput || t === pickBtn) return;
    closeDirPicker();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeDirPicker();
  });
}
