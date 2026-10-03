import { $, esc } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { openDetail } from "../components/modal.js";
import { createSelectableGrid } from "../components/selectable-grid.js";
import { titles } from "../lib/titles.js";

/** @type {any[]} */
let manifestEntries = [];
let sortDesc = true;

// 可选择网格：进入「选择」模式后点选卡片多选 → 工具栏「删除 N」→ 确认 → /api/delete（与照片墙同一组件）
// 默认（非选择模式）点卡片 = 看外链详情，避免与多选冲突。
const manageSelect = createSelectableGrid({
  gridId: "fileGrid",
  deleteBtnId: "btnManageDelete",
  itemSelector: ".file-card",
  keyAttr: "sha",
  canSelect: (el) => Boolean(el.dataset.sha) && $("fileGrid").classList.contains("select-mode"),
  confirmMsg: "将删除选中的 {n} 张图（删远端资产 + 清 manifest + 回写文档引用），确认？",
  async onDelete(keys) {
    let ok = 0;
    let fail = 0;
    for (const sha of keys) {
      const r = await api("/api/delete", { sha256: sha, confirm: true });
      if (r.data?.ok) ok += 1;
      else fail += 1;
    }
    setSelectMode(false);
    await refreshManage();
    if (fail) toast(`已删除 ${ok} 张，${fail} 张失败`);
    else toast(`已删除 ${ok} 张`);
    return false; // 自行提示
  },
});

/** 进入/退出选择模式；退出时清空已选。 */
function setSelectMode(on) {
  const grid = $("fileGrid");
  const btn = $("btnSelectMode");
  if (!grid || !btn) return;
  grid.classList.toggle("select-mode", on);
  btn.textContent = on ? "完成" : "选择";
  if (!on) manageSelect.clear();
  // 非选择模式时彻底隐藏删除按钮（即便 sync 已隐藏，二次保险）
  const del = $("btnManageDelete");
  if (del && !on) del.hidden = true;
}

/** @param {any[]} list */
function renderFiles(list) {
  const q = ($("fileSearch").value || "").toLowerCase();
  let items = (list || []).filter((e) => !q || String(e.publicUrl || e.localPath || "").toLowerCase().includes(q));
  items = items.slice().sort((a, b) => {
    const ka = String(a.updatedAt || a.localPath || "");
    const kb = String(b.updatedAt || b.localPath || "");
    return sortDesc ? kb.localeCompare(ka) : ka.localeCompare(kb);
  });
  $("fileGrid").innerHTML =
    items
      .map((e, i) => {
        const name = String(e.localPath || e.publicUrl || "asset").split(/[\\/]/).pop();
        const hasUrl = e.publicUrl && /^https?:/.test(e.publicUrl);
        const th = "th" + ((i % 4) + 1);
        return (
          '<div class="file-card" data-url="' + esc(e.publicUrl || "") + '" data-name="' + esc(name) +
          '" data-sha="' + esc(e.sha256 || "") + '">' +
          '<span class="fc-check">✓</span>' +
          '<div class="file-thumb ' + th + '">' +
          (hasUrl ? '<img src="' + esc(e.publicUrl) + '" alt="" onerror="this.remove()"/>' : "🖼") +
          '</div><div class="file-meta"><div class="name">' + esc(name) +
          '</div><div class="row"><span>' + esc(String(e.sha256 || "").slice(0, 8) || "—") +
          '</span><span class="tag">' + (hasUrl ? "外链中" : "无外链") + "</span></div></div></div>"
        );
      })
      .join("") || '<div class="muted">暂无映射文件</div>';
  // 非选择模式：点卡片看外链详情（URL/Markdown/HTML）；选择模式由 selectable-grid 接管多选
  /** @type {NodeListOf<HTMLElement>} */ ($("fileGrid").querySelectorAll(".file-card")).forEach((card) => {
    card.addEventListener("click", () => {
      if ($("fileGrid").classList.contains("select-mode")) return;
      openDetail(card.dataset.name, card.dataset.url);
    });
  });
  manageSelect.bind();
  manageSelect.restore();
  manageSelect.sync();
  $("statTotal").textContent = String(items.length);
  $("statMapped").textContent = String((list || []).filter((e) => e.publicUrl).length);
  titles.manage[1] = "共 " + items.length + " 个文件（按 sha256 去重）";
  if ($("view-manage").style.display !== "none") {
    $("pageCrumb").textContent = titles.manage[1];
  }
}

export async function refreshManage() {
  const man = await api("/api/manifest");
  manifestEntries = man.data?.data?.entries || man.data?.data?.items || [];
  if (!Array.isArray(manifestEntries)) manifestEntries = [];
  renderFiles(manifestEntries);
  const withUrl = manifestEntries.filter((e) => e.publicUrl).length;
  const links = $("statLinks");
  if (links) links.textContent = String(withUrl);
  const runsEl = $("statRuns");
  if (runsEl) runsEl.remove();
  const now = new Date();
  const ym = now.getUTCFullYear() + "-" + String(now.getUTCMonth() + 1).padStart(2, "0");
  $("statMonth").textContent = String(
    manifestEntries.filter((e) => String(e.updatedAt || "").startsWith(ym)).length,
  );
}

export function initManage() {
  $("fileSearch").addEventListener("input", () => renderFiles(manifestEntries));
  $("fileSort").onclick = () => {
    sortDesc = !sortDesc;
    $("fileSort").textContent = sortDesc ? "按时间 ↓" : "按时间 ↑";
    renderFiles(manifestEntries);
  };
  $("btnSelectMode").onclick = () => {
    setSelectMode(!$("fileGrid").classList.contains("select-mode"));
  };
  $("batchCopy").onclick = async () => {
    const urls = manifestEntries.map((e) => e.publicUrl).filter(Boolean);
    if (!urls.length) return toast("无外链可复制");
    await navigator.clipboard.writeText(urls.join("\n")).catch(() => {});
    toast("已复制 " + urls.length + " 条外链");
  };
  $("loadManifest") && ($("loadManifest").onclick = null);
}
