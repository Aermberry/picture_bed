import { esc } from "../lib/dom.js";
import { confirmAsync } from "../components/modal.js";

/** 单条引用最多展示的字符数（data: URI 可达数百 KB，禁止整串进 DOM）。 */
const RAW_PREVIEW_LIMIT = 80;

/** blocked code → 人话原因。未知 code 回落到 code 本身。 */
const CODE_TEXT = {
  E_SKIP_REF: "内嵌数据图（data: URI），不是本地文件",
  E_EXT: "扩展名不在图片白名单",
  E_ASSET_MISSING: "图片文件不存在",
  E_PATH_ESCAPE: "路径在扫描根之外",
  E_ABSOLUTE: "绝对路径不被允许",
  E_FILE_URL: "file:// 引用不被允许",
};

/**
 * 统计「本次拖入文档」里已是远程链接的引用数。
 * 用于区分「文档图片早已上传（无需再传）」与「文档里根本没有图」——
 * 这两种情况照片墙都不会出现图块，但用户看到同一句提示会误判成故障。
 * 注意 skip-remote 项**没有 localPath**，归属只能按 doc 判断。
 * @param {any[]} plan
 * @param {string[]} dropDocs
 * @returns {number}
 */
export function countRemoteOnlyForDocs(plan, dropDocs) {
  const docs = {};
  for (const d of dropDocs || []) docs[String(d).replace(/\\/g, "/")] = 1;
  let n = 0;
  for (const p of plan || []) {
    if (!p || p.action !== "skip-remote") continue;
    const doc = String(p.doc || "").replace(/\\/g, "/");
    if (doc && docs[doc]) n += 1;
  }
  return n;
}

/**
 * 把 data: URI / 长串截断成可读片段。
 * @param {any} raw
 * @returns {string}
 */
export function truncateRaw(raw) {
  const s = String(raw ?? "");
  if (s.length <= RAW_PREVIEW_LIMIT) return s;
  return s.slice(0, RAW_PREVIEW_LIMIT) + "…";
}

/**
 * 从 /api/plan 的结果里挑出「本次拖入文档」的 blocked 项。
 * 只覆盖本次拖入的文档，不扩大报全仓 blocked。
 * @param {any[]} plan
 * @param {string[]} dropDocs 本次拖入文档的绝对路径
 * @returns {any[]}
 */
export function collectBlockedForDocs(plan, dropDocs) {
  const docs = {};
  for (const d of dropDocs || []) docs[String(d).replace(/\\/g, "/")] = 1;
  const out = [];
  for (const p of plan || []) {
    if (!p || p.action !== "blocked") continue;
    const doc = String(p.doc || "").replace(/\\/g, "/");
    if (!doc || !docs[doc]) continue;
    out.push(p);
  }
  return out;
}

/** 单条 blocked 的说明行。 @param {any} item */
function describeBlocked(item) {
  const why = CODE_TEXT[item.code] || item.code || item.reason || "无法上传";
  const raw = truncateRaw(item.raw);
  return (
    '<li class="blocked-item">' +
    "<strong>" + esc(why) + "</strong>" +
    (raw ? '<code>' + esc(raw) + "</code>" : "") +
    "</li>"
  );
}

/**
 * 拖入文档「有图但传不了」时弹模态警告；无 blocked 项则静默返回。
 * @param {any[]} blocked collectBlockedForDocs 的结果
 * @param {string[]} dropDocs 本次拖入文档路径
 * @returns {Promise<boolean>} 是否弹了警告
 */
export async function warnBlockedRefs(blocked, dropDocs) {
  if (!blocked || !blocked.length) return false;
  const byDoc = {};
  for (const b of blocked) {
    const doc = String(b.doc || "").replace(/\\/g, "/");
    const name = doc.split("/").pop() || doc;
    (byDoc[name] = byDoc[name] || []).push(b);
  }
  let html = "";
  for (const name of Object.keys(byDoc)) {
    html += '<div class="blocked-doc">' + esc(name) + "</div><ul>";
    for (const item of byDoc[name]) html += describeBlocked(item);
    html += "</ul>";
  }
  const n = blocked.length;
  await confirmAsync(n + " 处引用无法上传（详见下方）", html);
  return true;
}
