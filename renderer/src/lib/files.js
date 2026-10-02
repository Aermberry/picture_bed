/** 拖入文件的本机绝对路径（桌面端经 preload 桥；浏览器里通常拿不到）。 @param {any} f */
export function filePathOf(f) {
  if (!f) return "";
  try {
    if (window.picbedNative && typeof window.picbedNative.getPathForFile === "function") {
      const p = window.picbedNative.getPathForFile(f);
      if (p) return p;
    }
  } catch (_) {}
  try {
    if (typeof f.path === "string" && f.path) return f.path;
  } catch (_) {}
  return "";
}

/** @param {any} n */
export function isImageName(n) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(String(n || ""));
}

/** @param {any} n */
export function isDocName(n) {
  return /\.(md|markdown|html?|txt)$/i.test(String(n || ""));
}

/** 目录不收；只收图片或文档。 @param {any} n @param {any} type */
export function isAcceptedDrop(n, type) {
  if (type === "dir") return false;
  return isImageName(n) || isDocName(n);
}
