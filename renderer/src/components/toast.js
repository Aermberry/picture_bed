import { $ } from "../lib/dom.js";

/** @param {any} msg */
export function toast(msg) {
  $("toastText").textContent = msg;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2200);
}
