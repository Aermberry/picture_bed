import { $ } from "../lib/dom.js";

const logo = $("logo");

/** Logo 动效状态（不注入色值）。 @param {any} s */
export function logoState(s) {
  logo.classList.remove("scanning", "uploading");
  if (s) logo.classList.add(s);
}

/** 点击 Logo 预览扫描 / 上传动效。 */
export function initLogo() {
  logo.addEventListener("click", () => {
    if (logo.classList.contains("scanning")) {
      logoState("uploading");
      setTimeout(() => logoState(null), 2200);
    } else logoState("scanning");
  });
}
