import { $ } from "../lib/dom.js";
import { confirmAsync } from "./modal.js";
import { toast } from "./toast.js";

/* ── 可复用组件：可选择的网格 + 批量删除 ──
 * 照片墙 / 图库共用此组件，消除重复的选择/删除逻辑。
 * @param {object} opts
 * @param {string} opts.gridId        — 网格容器元素 id
 * @param {string} opts.deleteBtnId  — 删除按钮元素 id
 * @param {string} opts.itemSelector  — 可选项的 CSS 选择器（如 ".tile" 或 ".file-card"）
 * @param {string} opts.keyAttr       — 项的 data-* 属性名，用作选择 key（如 "key" 或 "path"）
 * @param {function} opts.canSelect   — (el) => boolean，判断某项是否可选
 * @param {function} opts.onDelete    — async (keys) => void，执行删除并返回
 * @param {string=} opts.confirmMsg   — 删除确认消息模板，{n} 替换为数量
 * @param {string=} opts.successMsg   — 删除成功消息模板，{n} 替换为数量
 * @param {function=} opts.onSuccess  — (n) => void，自定义成功提示；省略则用 successMsg
 * @returns {{clear:() => void, sync:() => void, restore:() => void, getKeys:() => string[], bind:() => void}}
 */
export function createSelectableGrid(opts) {
  const selected = new Set();
  const grid = $(opts.gridId);

  function syncBtn() {
    const btn = $(opts.deleteBtnId);
    if (!btn) return;
    const n = selected.size;
    btn.hidden = n === 0;
    btn.textContent = n > 0 ? "删除 " + n : "删除";
  }

  function clear() {
    selected.clear();
    if (grid) grid.querySelectorAll(opts.itemSelector + ".selected").forEach((t) => t.classList.remove("selected"));
    syncBtn();
  }

  function restore() {
    if (!grid) return;
    grid.querySelectorAll(opts.itemSelector).forEach((el) => {
      const key = el.dataset[opts.keyAttr] || "";
      if (key && selected.has(key)) el.classList.add("selected");
    });
  }

  function toggle(el) {
    const key = el.dataset[opts.keyAttr] || "";
    if (!key) return;
    if (selected.has(key)) {
      selected.delete(key);
      el.classList.remove("selected");
    } else {
      selected.add(key);
      el.classList.add("selected");
    }
    syncBtn();
  }

  function getKeys() { return Array.from(selected); }

  function bind() {
    if (!grid) return;
    grid.querySelectorAll(opts.itemSelector).forEach((el) => {
      el.addEventListener("click", () => {
        if (!opts.canSelect(el)) return;
        toggle(el);
      });
    });
  }

  async function handleDelete() {
    const n = selected.size;
    if (!n) return;
    const msg = (opts.confirmMsg || "删除选中的 {n} 项？").replace("{n}", String(n));
    if (!(await confirmAsync(msg))) return;
    const keys = getKeys();
    clear();
    try {
      const result = await opts.onDelete(keys);
      if (result === false) return; // onDelete 已自行处理提示
      if (typeof opts.onSuccess === "function") opts.onSuccess(n);
      else toast((opts.successMsg || "已删除 {n} 项").replace("{n}", String(n)));
    } catch (_) {
      toast("删除失败，请重试");
    }
  }

  // 绑定删除按钮
  const delBtn = $(opts.deleteBtnId);
  if (delBtn) delBtn.addEventListener("click", handleDelete);

  return { clear, sync: syncBtn, restore, getKeys, bind };
}
