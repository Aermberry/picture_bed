import { $, qsAll } from "./lib/dom.js";
import { titles } from "./lib/titles.js";
import { initTheme } from "./features/theme.js";
import { initLogo } from "./features/logo.js";
import { refreshHealth } from "./features/health.js";
import { initGallery, loadGallery } from "./features/gallery.js";
import { initManage, refreshManage } from "./features/manage.js";
import { initSettings, loadConfigForm } from "./features/settings.js";
import { initDirPicker } from "./features/dir-picker.js";
import { initGhLogin } from "./features/gh-login.js";
import { initWall } from "./features/photo-wall.js";
import { initDropZone } from "./features/drop.js";

/** 「规范」仅本地调试显示（server 注入 __PICBED_UI_DEV__）。 */
function showSpecNavIfDev() {
  try {
    if (window.__PICBED_UI_DEV__) {
      const el = document.getElementById("navDoc");
      if (el) el.hidden = false;
    }
  } catch (_) { /* keep hidden */ }
}

/** @param {any} v */
export function switchView(v) {
  if (v === "doc" && !window.__PICBED_UI_DEV__) {
    v = "upload";
  }
  qsAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  ["upload", "manage", "gallery", "settings", "doc"].forEach((k) => {
    $("view-" + k).style.display = k === v ? "" : "none";
  });
  $("pageTitle").textContent = titles[v][0];
  $("pageCrumb").textContent = titles[v][1];
  if (v === "manage") refreshManage();
  if (v === "gallery") loadGallery();
  if (v === "settings") loadConfigForm();
}

function bindNav() {
  qsAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

/** 渲染器入口：只做装配与初始化，业务在各 feature 模块里。 */
export function bootstrap() {
  showSpecNavIfDev();
  initTheme();
  initLogo();
  bindNav();
  initGallery();
  initManage();
  initSettings();
  initDirPicker();
  initGhLogin();
  initWall();
  initDropZone();
  refreshHealth();
}
