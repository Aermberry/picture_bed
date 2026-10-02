import { $, esc } from "../lib/dom.js";
import { toast } from "./toast.js";

/** @param {any} msg @param {any=} extraHtml */
export function confirmAsync(msg, extraHtml) {
  return new Promise((resolve) => {
    $("modalTitle").textContent = "确认";
    $("modalBody").textContent = msg;
    $("modalExtra").innerHTML = extraHtml || "";
    $("modalOk").textContent = "确认";
    $("modal").classList.add("show");
    const ok = () => { cleanup(); resolve(true); };
    const cancel = () => { cleanup(); resolve(false); };
    function cleanup() {
      $("modal").classList.remove("show");
      $("modalOk").removeEventListener("click", ok);
      $("modalCancel").removeEventListener("click", cancel);
    }
    $("modalOk").addEventListener("click", ok);
    $("modalCancel").addEventListener("click", cancel);
  });
}

/** 文件卡详情：复制外链（URL / Markdown / HTML）。 @param {any} name @param {any} url */
export function openDetail(name, url) {
  const has = url && /^https?:/.test(url);
  $("modalTitle").textContent = name;
  $("modalBody").textContent = has ? "外链详情 · 可复制 URL / Markdown / HTML" : "暂无外链（可先 sync 生成）";
  $("modalExtra").innerHTML =
    '<div class="detail-url">' + esc(url || "（无外链）") + "</div>" +
    (has
      ? '<div class="token-row" style="margin-top:12px">' +
        '<button type="button" class="chip chip-btn active" data-copy="url">URL</button>' +
        '<button type="button" class="chip chip-btn" data-copy="md">Markdown</button>' +
        '<button type="button" class="chip chip-btn" data-copy="html">HTML</button>' +
        "</div>"
      : "");
  $("modalOk").textContent = "复制";
  $("modal").classList.add("show");
  /** @param {any} kind */
  const fmt = (kind) => {
    if (!has) return "";
    if (kind === "md") return "![" + name + "](" + url + ")";
    if (kind === "html") return '<img src="' + url + '" alt="' + name + '" />';
    return url;
  };
  /** @type {any} */
  let kind = "url";
  /** @type {NodeListOf<HTMLElement>} */ ($("modalExtra").querySelectorAll("[data-copy]")).forEach((b) => {
    b.addEventListener("click", () => {
      kind = b.dataset.copy;
      /** @type {NodeListOf<HTMLElement>} */ ($("modalExtra").querySelectorAll("[data-copy]")).forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    });
  });
  const ok = async () => {
    const text = fmt(kind);
    if (text) {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast(kind === "url" ? "已复制外链" : kind === "md" ? "已复制 Markdown" : "已复制 HTML");
    } else toast("无外链可复制");
    cleanup();
  };
  const cancel = () => cleanup();
  function cleanup() {
    $("modal").classList.remove("show");
    $("modalOk").removeEventListener("click", ok);
    $("modalCancel").removeEventListener("click", cancel);
  }
  $("modalOk").addEventListener("click", ok);
  $("modalCancel").addEventListener("click", cancel);
}
