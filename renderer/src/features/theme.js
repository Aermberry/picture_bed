import { $, qsAll } from "../lib/dom.js";

/** @type {string[]} */
const THEME_WHITELIST = ["", "klein", "cream"];

/** @type {Record<string, any>} */
const LOGO_VARIANTS = {
  "": [
    { key: "", label: "D1 晴空蓝" },
    { key: "v2", label: "D2 暮紫" },
    { key: "v3", label: "D3 夕照金" },
  ],
  klein: [
    { key: "", label: "A1 柔群青" },
    { key: "v2", label: "A2 暮蓝" },
    { key: "v3", label: "A3 夕橙" },
  ],
  cream: [
    { key: "", label: "B1 柔樱粉" },
    { key: "v2", label: "B2 深紫影" },
    { key: "v3", label: "B3 若叶绿" },
  ],
};

/** @type {Record<string, any>} */
const THEME_TOKENS = {
  "": { name: "晴空蓝", primary: "#4E93C0", accent: "#FFC978", bg: "#EDF4FA", text: "#3E5670", soft: "#E8F4FB", border: "#DCE9F5" },
  klein: { name: "柔群青", primary: "#6484CE", accent: "#FFA978", bg: "#EDF2F9", text: "#3E4A63", soft: "#E9EFFB", border: "#DEE5F0" },
  cream: { name: "柔樱粉", primary: "#D37493", accent: "#86D9B4", bg: "#FAF1F4", text: "#63495E", soft: "#FBEDF2", border: "#F7E1E9" },
};

let curTheme = "";
let curLogo = 0;

function applyLogo() {
  const list = (LOGO_VARIANTS[curTheme] || LOGO_VARIANTS[""]).list
    || LOGO_VARIANTS[curTheme] || LOGO_VARIANTS[""];
  const v = (list[curLogo] || list[0]).key;
  if (v) document.body.dataset.logo = v;
  else delete document.body.dataset.logo;
}

function syncThemeUI() {
  qsAll("[data-theme-btn]").forEach((b) => {
    b.classList.toggle("active", b.dataset.themeBtn === curTheme);
  });
  const sel = $("themeSelect");
  if (sel) sel.value = curTheme;
}

function renderTokenSwatches() {
  const t = THEME_TOKENS[curTheme] || THEME_TOKENS[""];
  const el = $("tokenSwatches");
  if (!el) return;
  const rows = [
    ["Primary", t.primary], ["Accent", t.accent], ["BG", t.bg],
    ["Border", t.border], ["Text", t.text], ["Primary-Soft", t.soft],
  ];
  el.innerHTML = rows
    .map(([n, c]) => '<div class="chip"><span class="dot" style="background:' + c + '"></span>' + n + " " + c + "</div>")
    .join("");
}

function renderLogoVarRow() {
  /** @type {any[]} */
  const list = LOGO_VARIANTS[curTheme] || LOGO_VARIANTS[""];
  const el = $("logoVarRow");
  if (!el) return;
  el.innerHTML = list
    .map((v, i) =>
      '<button type="button" class="chip chip-btn' + (i === curLogo ? " active" : "") + '" data-logo-idx="' + i + '">' + v.label + "</button>",
    )
    .join("");
  /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll("[data-logo-idx]")).forEach((b) => {
    b.addEventListener("click", () => {
      curLogo = Number(b.dataset.logoIdx) || 0;
      applyLogo();
      renderLogoVarRow();
    });
  });
}

/** @param {string} t */
export function setTheme(t) {
  curTheme = THEME_WHITELIST.indexOf(t) > -1 ? t : "";
  curLogo = 0;
  if (curTheme) document.body.dataset.theme = curTheme;
  else delete document.body.dataset.theme;
  try { localStorage.setItem("picbed.theme", curTheme); } catch (_) {}
  applyLogo();
  syncThemeUI();
  renderTokenSwatches();
  renderLogoVarRow();
}

/** 恢复本机主题并绑定换肤入口（顶栏 pills / 规范页 chips / 设置页下拉）。 */
export function initTheme() {
  try {
    const saved = localStorage.getItem("picbed.theme") || "";
    if (THEME_WHITELIST.indexOf(saved) > -1) curTheme = saved;
  } catch (_) {}
  if (curTheme) document.body.dataset.theme = curTheme;
  applyLogo();
  syncThemeUI();
  renderTokenSwatches();
  renderLogoVarRow();

  qsAll("[data-theme-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeBtn || ""));
  });
  const themeSelect = $("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => setTheme(themeSelect.value || ""));
  }
}
