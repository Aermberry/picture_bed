import { $, esc } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { openDetail } from "../components/modal.js";
import { titles } from "../lib/titles.js";

/** @type {any[]} */
let manifestEntries = [];
let sortDesc = true;

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
          '<div class="file-card" data-url="' + esc(e.publicUrl || "") + '" data-name="' + esc(name) + '">' +
          '<div class="file-thumb ' + th + '">' +
          (hasUrl ? '<img src="' + esc(e.publicUrl) + '" alt="" onerror="this.remove()"/>' : "🖼") +
          '</div><div class="file-meta"><div class="name">' + esc(name) +
          '</div><div class="row"><span>' + esc(String(e.sha256 || "").slice(0, 8) || "—") +
          '</span><span class="tag">' + (hasUrl ? "外链中" : "无外链") + "</span></div></div></div>"
        );
      })
      .join("") || '<div class="muted">暂无映射文件</div>';
  /** @type {NodeListOf<HTMLElement>} */ ($("fileGrid").querySelectorAll(".file-card")).forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.name, card.dataset.url));
  });
  $("statTotal").textContent = String(items.length);
  $("statMapped").textContent = String((list || []).filter((e) => e.publicUrl).length);
  titles.manage[1] = "共 " + items.length + " 个文件";
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
  $("batchCopy").onclick = async () => {
    const urls = manifestEntries.map((e) => e.publicUrl).filter(Boolean);
    if (!urls.length) return toast("无外链可复制");
    await navigator.clipboard.writeText(urls.join("\n")).catch(() => {});
    toast("已复制 " + urls.length + " 条外链");
  };
  $("loadManifest") && ($("loadManifest").onclick = null);
}
