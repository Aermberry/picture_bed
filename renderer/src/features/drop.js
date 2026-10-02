import { $ } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { filePathOf, isImageName, isDocName, isAcceptedDrop } from "../lib/files.js";
import { logoState } from "./logo.js";
import { mergeWallItems, scanIntoPreview, setPreviewIdle, photoWallTitle, wallCount } from "./photo-wall.js";

const dz = $("dropzone");
/** 拖动计时器：占位（拖拽期间不做上传态切换）。 */
let upTimer = null;

// DataTransfer 仅在 drop 事件派发期间可读，必须同步收集
/** @param {DataTransfer} dt */
export function collectDropItems(dt) {
  /** @type {any[]} */
  const items = [];
  /** @type {Record<string, number>} */
  const seen = {};
  /** @type {any[]} */
  const blobPreviews = [];
  /** @param {File} f @param {boolean} isDir */
  function takeFile(f, isDir) {
    const abs = filePathOf(f);
    const name = f.name || "file";
    const rel = f.webkitRelativePath || name;
    const key = abs || rel;
    if (!key || seen[key]) return;
    if (isDir) return;
    if (!isAcceptedDrop(name, "file") && (f.type || "").indexOf("image/") !== 0) return;
    seen[key] = 1;
    if (isImageName(name) || (f.type || "").indexOf("image/") === 0) {
      try {
        blobPreviews.push({ src: URL.createObjectURL(f), name, abs });
      } catch (_) {}
    }
    items.push({ name, rel, type: "file", abs });
  }

  if (dt.files && dt.files.length) {
    for (const f of dt.files) takeFile(f, false);
  }
  if (dt.items) {
    for (const item of dt.items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
      const f = item.getAsFile && item.getAsFile();
      const isDir = !!(entry && entry.isDirectory);
      if (isDir) continue;
      if (f) takeFile(f, false);
    }
  }

  items.sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1));
  return { items, blobPreviews };
}

/** @param {any[]} items */
export async function submitDrop(items) {
  let dropped = 0;
  let err = "";
  const previewPaths = [];
  const dropDocs = [];
  for (const it of items) {
    const { data } = await api("/api/session/drop", {
      name: it.name,
      relativePath: it.rel,
      type: it.type,
      absPath: it.abs || undefined,
    });
    if (data.ok) {
      dropped += 1;
      const pp = data.data && data.data.previewPath;
      // previewPath is image-only; a dropped document must not enter the wall
      if (pp && isImageName(pp)) previewPaths.push(pp);
      else if (it.abs && isImageName(it.abs)) previewPaths.push(it.abs);
      if (it.abs && isDocName(it.abs)) dropDocs.push(it.abs);
      else if (it.name && isDocName(it.name) && it.abs) dropDocs.push(it.abs);
    } else {
      err = (data.error && data.error.message) || "drop failed";
    }
  }
  return { dropped, err, previewPaths, dropDocs };
}

/** 拖放：先出本地 blob 预览，再等服务器往返。 */
export function initDropZone() {
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (/** @type {any} */ e) => {
      e.preventDefault();
      dz.classList.add("drag");
      logoState("scanning");
      $("dropTitle").textContent = "正在扫描文件…";
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (/** @type {any} */ e) => {
      e.preventDefault();
      dz.classList.remove("drag");
      if (ev === "dragleave" && !upTimer) {
        logoState(null);
        if (dz.classList.contains("has-photos")) $("dropTitle").textContent = photoWallTitle();
        else $("dropTitle").textContent = "将文件拖放到此处";
      }
    }),
  );
  dz.addEventListener("drop", async (/** @type {any} */ e) => {
    $("dropTitle").textContent = "正在扫描…";
    // 即时本地预览：blob URL 无需等待服务器往返
    const { items, blobPreviews } = collectDropItems(e.dataTransfer);
    if (!items.length && !blobPreviews.length) {
      toast("仅支持图片或文档（不接受文件夹）");
      // keep any wall already showing; just restore the headline
      if (wallCount()) $("dropTitle").textContent = photoWallTitle();
      else setPreviewIdle();
      return;
    }
    if (blobPreviews.length) mergeWallItems(blobPreviews);
    const r = await submitDrop(items);
    if (r && r.err && !r.dropped) {
      toast(r.err);
      if (wallCount()) $("dropTitle").textContent = photoWallTitle();
      else if (!blobPreviews.length) setPreviewIdle();
      return;
    }
    logoState("scanning");
    await scanIntoPreview({ previewPaths: r.previewPaths, blobPreviews, dropDocs: r.dropDocs });
    logoState(null);
  });
}
