/** @type {(id: string) => any} */
export const $ = (id) => document.getElementById(id);

/** @type {(sel: string) => NodeListOf<HTMLElement>} */
export const qsAll = (sel) => /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(sel));

/** @param {any} s */
export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => /** @type {Record<string, string>} */ ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
