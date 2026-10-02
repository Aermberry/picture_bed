import { $, esc } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { loadConfigForm } from "./settings.js";

/* ── 分支下拉（设置页 github.branch）──────────────────────────────
 * 点击/聚焦 Branch 输入框 → GET /api/branches 列仓库分支，当前分支高亮；
 * 点选即写入并保存 github.branch（无需再点「保存设置」）。点外部 / Esc 收起。
 * 与目录选择（dir-picker）同构，但无写操作、无需浮层大面板。
 */
const picker = $("branchPicker");
const input = $("cfgBranch");
let busy = false;

/** @param {string} html */
function listHtml(html) {
  const list = $("branchPickerList");
  if (list) list.innerHTML = html;
}

/** @param {string} text */
function renderEmpty(text) {
  listHtml(`<div class="branch-picker-empty">${esc(text)}</div>`);
}

async function loadBranches() {
  renderEmpty("加载中…");
  const { status, data } = await api("/api/branches");
  if (!data || !data.ok) {
    const err = (data && data.error) || {};
    let hint = "";
    if (err.code === "E_TOKEN") hint = "；请先粘贴 PAT 保存，或本机 gh auth login";
    else if (err.code === "E_CONFIG") hint = "；请先填写并保存 Owner / Repo";
    renderEmpty(`${(err.message || `加载失败（HTTP ${status}）`)}${hint}`);
    return;
  }
  const branches = (data.data && data.data.branches) || [];
  if (!branches.length) {
    renderEmpty("仓库没有可见分支");
    return;
  }
  const current = String(input ? input.value.trim() : "");
  listHtml(
    branches
      .map((/** @type {string} */ b) => {
        const isCurrent = b === current;
        return (
          `<div class="branch-picker-item${isCurrent ? " current" : ""}" data-branch="${esc(b)}" title="设为当前分支：${esc(b)}">` +
          `<span class="ico">🌿</span><span class="name">${esc(b)}</span>` +
          (isCurrent ? `<span class="tag">当前</span>` : "") +
          `</div>`
        );
      })
      .join(""),
  );
}

function openPicker() {
  if (!picker) return;
  picker.hidden = false;
  loadBranches();
}

function closePicker() {
  if (!picker || picker.hidden) return;
  picker.hidden = true;
}

/** 点选分支 → 写入 github.branch 并立即保存。 @param {string} name */
async function applyBranch(name) {
  if (!name || busy) return;
  busy = true;
  const { status, data } = await api("/api/config", { key: "github.branch", value: name, confirm: true });
  busy = false;
  if (!data || !data.ok) {
    const err = (data && data.error) || {};
    renderEmpty(err.message || `保存失败（HTTP ${status}）`);
    return;
  }
  if (input) input.value = name;
  closePicker();
  toast(`分支已切换为 ${name}`);
  loadConfigForm();
}

export function initBranchPicker() {
  if (!picker || !input) return;
  input.addEventListener("focus", openPicker);
  input.addEventListener("click", openPicker);

  picker.addEventListener("click", (ev) => {
    const item = /** @type {HTMLElement} */ (ev.target).closest(".branch-picker-item");
    if (!item) return;
    applyBranch(item.dataset.branch || "");
  });

  document.addEventListener("click", (ev) => {
    if (picker.hidden) return;
    const t = /** @type {Node} */ (ev.target);
    if (picker.contains(t) || t === input) return;
    closePicker();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closePicker();
  });
}
