  /** @type {(id: string) => any} */
  const $ = (id) => document.getElementById(id);
  /** @type {(sel: string) => NodeListOf<HTMLElement>} */
  const qsAll = (sel) => /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(sel));
  /** @type {any[]} */
  let manifestEntries = [];
  let sortDesc = true;

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

  /** @param {string} t */
  function setTheme(t) {
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
    el.innerHTML = rows.map(([n, c]) =>
      '<div class="chip"><span class="dot" style="background:' + c + '"></span>' + n + " " + c + "</div>"
    ).join("");
  }

  function renderLogoVarRow() {
    /** @type {any[]} */
    const list = LOGO_VARIANTS[curTheme] || LOGO_VARIANTS[""];
    const el = $("logoVarRow");
    if (!el) return;
    el.innerHTML = list.map((v, i) =>
      '<button type="button" class="chip chip-btn' + (i === curLogo ? " active" : "") + '" data-logo-idx="' + i + '">' + v.label + "</button>"
    ).join("");
    /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll("[data-logo-idx]")).forEach((b) => {
      b.addEventListener("click", () => {
        curLogo = Number(b.dataset.logoIdx) || 0;
        applyLogo();
        renderLogoVarRow();
      });
    });
  }

  qsAll("[data-theme-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeBtn || ""));
  });

  /** @type {Record<string, string[]>} */
  const titles = {
    upload: ["文件放置", "拖入文件即可上传 · picbed 本地控制台"],
    manage: ["文件管理", "共 0 个文件"],
    gallery: ["图库", "浏览仓库文件夹与图片"],
    settings: ["设置", "图床配置与上传偏好"],
    doc: ["设计规范", "令牌 · 组件 · 原型连线"],
  };

  /** @param {any} s */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => /** @type {Record<string, string>} */ ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  /** @param {any} msg */
  function toast(msg) {
    $("toastText").textContent = msg;
    $("toast").classList.add("show");
    setTimeout(() => $("toast").classList.remove("show"), 2200);
  }

  /** @param {any} msg @param {any=} extraHtml */
  function confirmAsync(msg, extraHtml) {
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

  /** @param {any} name @param {any} url */
  function openDetail(name, url) {
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

  /** @param {string} path @param {any=} body @param {string=} method */
  async function api(path, body, method) {
    const res = await fetch(path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", "X-Picbed-UI": "1" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  }

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
   * @returns {{clear:() => void, sync:() => void, restore:() => void, getKeys:() => string[]}}
   */
  function createSelectableGrid(opts) {
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

  /** @param {any} text @param {any=} cls */
  function setHealth(text, cls) {
    const el = $("health");
    el.textContent = text;
    el.style.color = cls === "ok" ? "var(--c-success)" : cls === "bad" ? "var(--c-danger)" : "var(--c-text-3)";
  }

  /* ── 导航 ── */
  // 「规范」仅本地调试显示（server 注入 __PICBED_UI_DEV__）
  (function showSpecNavIfDev() {
    try {
      if (window.__PICBED_UI_DEV__) {
        const el = document.getElementById("navDoc");
        if (el) el.hidden = false;
      }
    } catch (_) { /* keep hidden */ }
  })();

  /** @param {any} v */
  function switchView(v) {
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
  qsAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  /* ── 图库：浏览当前仓库文件夹 / 图片 ── */
  let galleryPath = "";
  let gallerySelectMode = false;
  /** @type {Map<string,{path:string,sha:string,name:string}>} 当前已加载的图片项（path → {sha,name}） */
  const galleryImgMap = new Map();

  function galleryParent(p) {
    const parts = String(p || "").split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  // 可选择网格组件 — 图库实例
  const gallerySelect = createSelectableGrid({
    gridId: "galleryGrid",
    deleteBtnId: "galleryDelete",
    itemSelector: ".file-card",
    keyAttr: "path",
    canSelect: (el) => gallerySelectMode && !el.dataset.dir && Boolean(el.dataset.path),
    confirmMsg: "将从 GitHub 仓库中永久删除选中的 {n} 张图片（不可恢复），确认删除？",
    async onDelete(keys) {
      const items = keys.map((p) => {
        const meta = galleryImgMap.get(p);
        return meta ? { path: meta.path, sha: meta.sha, name: meta.name } : null;
      }).filter(Boolean);
      const { data } = await api("/api/gallery/delete", { items });
      const d = (data.data && data.data.deleted) || 0;
      const f = (data.data && data.data.failed) || [];
      galleryExitSelectMode();
      loadGallery();
      if (f.length) { toast("已删除 " + d + " 张，失败 " + f.length + " 张"); return false; }
      return d;
    },
    onSuccess(n) { toast("已删除 " + n + " 张"); },
  });

  function galleryExitSelectMode() {
    gallerySelectMode = false;
    gallerySelect.clear();
    const btn = $("gallerySelect");
    if (btn) { btn.textContent = "选择"; btn.classList.remove("btn-primary"); btn.classList.add("btn-ghost"); }
    const g = $("galleryGrid");
    if (g) g.classList.remove("select-mode");
    gallerySelect.sync();
  }

  function galleryEnterSelectMode() {
    gallerySelectMode = true;
    const btn = $("gallerySelect");
    if (btn) { btn.textContent = "取消选择"; btn.classList.remove("btn-ghost"); btn.classList.add("btn-primary"); }
    const g = $("galleryGrid");
    if (g) g.classList.add("select-mode");
    gallerySelect.sync();
  }

  async function loadGallery() {
    const grid = $("galleryGrid");
    const empty = $("galleryEmpty");
    $("galleryPath").textContent = "/" + galleryPath;
    if ($("galleryUp")) $("galleryUp").hidden = !galleryPath;
    grid.innerHTML = '<div class="muted">加载中…</div>';
    empty.hidden = true;
    galleryImgMap.clear();
    gallerySelect.clear();
    const { status, data } = await api("/api/gallery?path=" + encodeURIComponent(galleryPath));
    if (!data.ok) {
      grid.innerHTML = "";
      empty.hidden = false;
      empty.textContent = (data.error && data.error.message) || ("加载失败 " + status);
      return;
    }
    const items = (data.data && data.data.items) || [];
    if (!items.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "此目录为空";
      return;
    }
    grid.innerHTML = items
      .map((it) => {
        const isDir = it.type === "dir";
        const isImg = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(it.name || "");
        if (!isDir && !isImg) return "";
        if (!isDir && it.sha) {
          galleryImgMap.set(it.path, { path: it.path, sha: it.sha, name: it.name || it.path });
        }
        return (
          '<div class="file-card" data-dir="' + (isDir ? esc(it.path) : "") + '" data-path="' + esc(it.path || "") + '" data-url="' + esc(it.url || "") + '" data-name="' + esc(it.name) + '">' +
          '<span class="fc-check">✓</span>' +
          '<div class="file-thumb th' + ((isDir ? 1 : 2)) + '">' +
          (isDir ? "📁" : isImg && it.url ? '<img src="' + esc(it.url) + '" alt="" onerror="this.remove()"/>' : "🖼") +
          '</div><div class="file-meta"><div class="name">' + esc(it.name) +
          '</div><div class="row"><span>' + (isDir ? "文件夹" : (it.size ? Math.round(it.size / 1024) + " KB" : "")) +
          '</span></div></div></div>'
        );
      })
      .join("");
    // 绑定选择 toggle（组件内部根据 canSelect 判断是否可选）
    gallerySelect.bind();
    // 非选择模式下的导航行为（打开详情 / 进入文件夹）
    /** @type {NodeListOf<HTMLElement>} */ (grid.querySelectorAll(".file-card")).forEach((card) => {
      card.addEventListener("click", () => {
        if (gallerySelectMode) return; // 选择模式下由组件处理 toggle，不走导航
        const dir = card.dataset.dir;
        if (dir) {
          galleryPath = dir;
          loadGallery();
          return;
        }
        openDetail(card.dataset.name, card.dataset.url);
      });
    });
  }
  $("galleryUp") && ($("galleryUp").onclick = () => {
    galleryPath = galleryParent(galleryPath);
    loadGallery();
  });
  $("galleryRefresh") && ($("galleryRefresh").onclick = () => loadGallery());
  $("gallerySelect") && ($("gallerySelect").onclick = () => {
    if (gallerySelectMode) galleryExitSelectMode();
    else galleryEnterSelectMode();
  });
  // galleryDelete 的删除逻辑由 gallerySelect 组件内部绑定处理

  /* ── Logo 动效（不注入色值） ── */
  const logo = $("logo");
  let upTimer = null;
  /** @param {any} s */
  function logoState(s) {
    logo.classList.remove("scanning", "uploading");
    if (s) logo.classList.add(s);
  }
  logo.addEventListener("click", () => {
    if (logo.classList.contains("scanning")) {
      logoState("uploading");
      setTimeout(() => logoState(null), 2200);
    } else logoState("scanning");
  });

  async function refreshHealth() {
    const { data } = await api("/api/health");
    if (data.ok) setHealth("本机服务正常 · schema " + data.schemaVersion, "ok");
    else setHealth("服务异常", "bad");
  }

  const dz = $("dropzone");
  /** @param {any} f */
  function filePathOf(f) {
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
  function isImageName(n) {
    return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(String(n || ""));
  }

  /** @param {any} n */
  function isDocName(n) {
    return /\.(md|markdown|html?|txt)$/i.test(String(n || ""));
  }

  /** @param {any} n @param {any} type */
  function isAcceptedDrop(n, type) {
    if (type === "dir") return false;
    return isImageName(n) || isDocName(n);
  }

  // DataTransfer 仅在 drop 事件派发期间可读，必须同步收集
  /** @param {DataTransfer} dt */
  function collectDropItems(dt) {
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
  async function submitDrop(items) {
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

  /** @type {any[]} */
  let wallItems = [];

  /** @param {any} p */
  function wallKey(p) {
    if (p && typeof p === "object") return String(p.abs || p.src || p.name || "");
    return String(p || "");
  }

  // 可选择网格组件 — 照片墙实例
  const wallSelect = createSelectableGrid({
    gridId: "previewGrid",
    deleteBtnId: "btnDelete",
    itemSelector: ".tile",
    keyAttr: "key",
    canSelect: (el) => Boolean(el.dataset.key),
    confirmMsg: "将从预览与会话中移除选中的 {n} 张图片（不上传、不改文档），确认删除？",
    successMsg: "已删除 {n} 张",
    async onDelete(keys) {
      wallItems = wallItems.filter((p) => !keys.includes(wallKey(p)));
      setPreviewImages(wallItems);
      await api("/api/session/remove", { keys });
    },
  });

  /** @param {any[]} items */
  function mergeWallItems(items) {
    /** @type {Record<string, number>} */
    const seen = {};
    for (const w of wallItems) seen[wallKey(w)] = 1;
    for (const p of items || []) {
      const key = wallKey(p);
      if (!key || seen[key]) continue;
      seen[key] = 1;
      wallItems.push(p);
    }
    setPreviewImages(wallItems);
  }

  /** @param {string=} title */
  function setPreviewIdle(title) {
    wallItems = [];
    wallSelect.clear();
    const g = $("previewGrid");
    const bar = $("wallSubbar");
    const idleHead = $("dzIdleHead");
    const dz = $("dropzone");
    if (g) {
      g.hidden = true;
      g.innerHTML = "";
    }
    if (bar) bar.hidden = true;
    if (idleHead) idleHead.hidden = false;
    if (dz) dz.classList.remove("has-photos");
    if (title) $("dropTitle").textContent = title;
  }

  /**
   * 最短列优先瀑布流：把 tile 分进 N 个 flex 列，每张进当前最矮的列。
   * 必须先清掉旧 pw-col，否则 load 事件会不断堆空列把内容挤没。
   */
  let layoutWallTimer = null;
  function schedulePhotoWallLayout() {
    if (layoutWallTimer != null) clearTimeout(layoutWallTimer);
    layoutWallTimer = window.setTimeout(() => {
      layoutWallTimer = null;
      layoutPhotoWall();
    }, 40);
  }

  function layoutPhotoWall() {
    const g = $("previewGrid");
    if (!g || g.hidden) return;
    const tiles = Array.from(g.querySelectorAll(".tile"));
    // drop previous column wrappers so they cannot accumulate as empty flex tracks
    g.querySelectorAll(".pw-col").forEach((c) => {
      const parent = c.parentNode;
      while (c.firstChild) parent.insertBefore(c.firstChild, c);
      if (parent) parent.removeChild(c);
    });
    if (!tiles.length) return;
    const w = g.clientWidth || 800;
    const n = w < 640 ? 2 : w < 1000 ? 3 : 4;
    /** @type {HTMLElement[]} */
    const cols = [];
    for (let i = 0; i < n; i++) {
      const col = document.createElement("div");
      col.className = "pw-col";
      col.style.paddingTop = i * 6 + "px";
      cols.push(col);
      g.appendChild(col);
    }
    const heights = new Array(n).fill(0);
    tiles.forEach((t) => {
      let best = 0;
      for (let i = 1; i < n; i++) if (heights[i] < heights[best] - 0.5) best = i;
      cols[best].appendChild(t);
      heights[best] += (t.offsetHeight || t.getBoundingClientRect().height || 120) + 6;
    });
  }

  /** @param {any[]} items */
  function setPreviewImages(items) {
    const g = $("previewGrid");
    const a = $("previewActions");
    const dz = $("dropzone");
    if (!g || !a) return;
    if (!items || !items.length) {
      setPreviewIdle();
      return;
    }
    // flat tiles first; layoutPhotoWall re-buckets them into columns
    g.innerHTML = items
      .map((p) => {
        let src = "";
        let name = "";
        if (p && typeof p === "object") {
          src = p.src || "";
          name = p.name || (p.abs ? String(p.abs).split(/[\\/]/).pop() || "" : "");
        } else if (typeof p === "string") {
          if (p.indexOf("blob:") === 0 || p.indexOf("data:") === 0) src = p;
          else {
            src = "/api/preview?path=" + encodeURIComponent(p);
            name = String(p).split(/[\\/]/).pop() || "";
          }
        }
        if (!src) return "";
        return (
          '<figure class="tile" data-key="' + esc(wallKey(p)) + '">' +
          '<img alt="" loading="lazy" src="' + src + '" />' +
          '<span class="check">✓</span>' +
          '<span class="sel-tag">已选</span>' +
          (name ? '<figcaption class="name">' + esc(name) + "</figcaption>" : "") +
          "</figure>"
        );
      })
      .join("");
    g.hidden = false;
    if (dz) dz.classList.add("has-photos");
    layoutPhotoWall();
    // Keep the headline in sync with tiles actually in the wall (failed loads drop out).
    /** @type {NodeListOf<HTMLImageElement>} */ (g.querySelectorAll("img")).forEach((img) => {
      img.addEventListener("error", () => {
        const tile = img.parentNode;
        if (tile && tile.parentNode) tile.parentNode.removeChild(tile);
        syncWallChrome();
        schedulePhotoWallLayout();
      });
      img.addEventListener("load", () => schedulePhotoWallLayout());
    });
    // 点选图块 → 多选删除（委托给组件）
    wallSelect.bind();
    // restore selection for tiles kept across re-render
    wallSelect.restore();
    syncWallChrome();
    wallSelect.sync();
  }

  /** Show actions/headline only when the wall actually has tiles. */
  function syncWallChrome() {
    const g = $("previewGrid");
    const a = $("previewActions");
    const dz = $("dropzone");
    const bar = $("wallSubbar");
    const idleHead = $("dzIdleHead");
    const n = g ? g.querySelectorAll(".tile").length : 0;
    if (a) a.hidden = n === 0;
    if (bar) bar.hidden = n === 0;
    if (idleHead) idleHead.hidden = n > 0;
    if (n === 0) {
      if (dz) dz.classList.remove("has-photos");
      $("dropTitle").textContent = "扫描到 0 张图片";
      return;
    }
    if (dz) dz.classList.add("has-photos");
    $("dropTitle").textContent = photoWallTitle();
  }

  /** @returns {string} */
  function photoWallTitle() {
    const g = $("previewGrid");
    const n = g ? g.querySelectorAll(".tile").length : 0;
    return "扫描到 " + n + " 张图片";
  }

  /** @param {any=} dropInfo */
  async function scanIntoPreview(dropInfo) {
    /** @type {any[]} */
    const paths = [];
    /** @type {Record<string, number>} */
    const seen = {};
    /** @param {any} p */
    function addPath(p) {
      const key = wallKey(p);
      if (!key || seen[key]) return;
      seen[key] = 1;
      paths.push(p);
    }

    // 0) this drop's File blobs — works without absolute FS path
    if (dropInfo && dropInfo.blobPreviews) {
      for (const b of dropInfo.blobPreviews) addPath(b);
    }
    if (dropInfo && dropInfo.previewPaths) {
      for (const p of dropInfo.previewPaths) {
        // blob 预览已覆盖同一文件，跳过服务器副本避免重复
        if (dropInfo.blobPreviews && dropInfo.blobPreviews.some((/** @type {any} */ b) => b.abs && b.abs === p)) continue;
        addPath(p);
      }
    }

    // 1) image refs inside THIS drop's docs only (never expand to the whole scan root)
    const dropDocs = (dropInfo && dropInfo.dropDocs) || [];
    if (dropDocs.length) {
      try {
        const { data } = await api("/api/plan", {});
        if (data.ok) {
          const plan = (data.data && data.data.plan) || [];
          /** @type {Record<string, number>} */
          const docSet = {};
          for (const d of dropDocs) docSet[String(d).replace(/\\/g, "/")] = 1;
          for (const p of plan) {
            if (!p.localPath) continue;
            if (p.action === "blocked" || p.action === "skip-remote") continue;
            const doc = String(p.doc || "").replace(/\\/g, "/");
            if (!doc || !docSet[doc]) continue;
            addPath(p.localPath);
          }
        } else if (!paths.length && !wallItems.length) {
          toast((data.error && data.error.message) || "扫描失败");
        }
      } catch (_) {
        if (!paths.length && !wallItems.length) toast("扫描失败");
      }
    }

    // Accumulate: keep tiles from earlier drops; only append this drop's hits.
    mergeWallItems(paths);
    if (!paths.length && !wallItems.length) toast("未扫描到本地图片");
  }

  $("btnReset").onclick = async () => {
    await api("/api/session/reset", {});
    setPreviewIdle();
    wallSelect.clear();
    toast("已重置");
  };

  // btnDelete 的删除逻辑由 wallSelect 组件内部绑定处理（无需再设 onclick）

  $("btnUpload").onclick = async () => {
    if (!(await confirmAsync("将上传图片并改写文档，确认上传？"))) return;
    const { status, data } = await api("/api/sync", { confirm: true, dryRun: false });
    if (data.ok) {
      const c = (data.data && data.data.counts) || {};
      toast(c.uploaded != null ? "上传完成 · " + c.uploaded : "上传完成");
      setPreviewIdle();
      wallSelect.clear();
    } else {
      toast((data.error && data.error.message) || "上传失败 " + status);
    }
  };

  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (/** @type {any} */ e) => {
      e.preventDefault();
      dz.classList.add("drag");
      logoState("scanning");
      $("dropTitle").textContent = "正在扫描文件…";
    })
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
    })
  );
  dz.addEventListener("drop", async (/** @type {any} */ e) => {
    $("dropTitle").textContent = "正在扫描…";
    // 即时本地预览：blob URL 无需等待服务器往返
    const { items, blobPreviews } = collectDropItems(e.dataTransfer);
    if (!items.length && !blobPreviews.length) {
      toast("仅支持图片或文档（不接受文件夹）");
      // keep any wall already showing; just restore the headline
      if (wallItems.length) $("dropTitle").textContent = photoWallTitle();
      else setPreviewIdle();
      return;
    }
    if (blobPreviews.length) mergeWallItems(blobPreviews);
    const r = await submitDrop(items);
    if (r && r.err && !r.dropped) {
      toast(r.err);
      if (wallItems.length) $("dropTitle").textContent = photoWallTitle();
      else if (!blobPreviews.length) setPreviewIdle();
      return;
    }
    logoState("scanning");
    await scanIntoPreview({ previewPaths: r.previewPaths, blobPreviews, dropDocs: r.dropDocs });
    logoState(null);
  });

  /** @param {any[]} list */
  function renderFiles(list) {
    const q = ($("fileSearch").value || "").toLowerCase();
    let items = (list || []).filter((e) => !q || String(e.publicUrl || e.localPath || "").toLowerCase().includes(q));
    items = items.slice().sort((a, b) => {
      const ka = String(a.updatedAt || a.localPath || "");
      const kb = String(b.updatedAt || b.localPath || "");
      return sortDesc ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
    $("fileGrid").innerHTML =
      items
        .map((e, i) => {
          const name = String(e.localPath || e.publicUrl || "asset").split(/[\\/]/).pop();
          const hasUrl = e.publicUrl && /^https?:/.test(e.publicUrl);
          const th = "th" + ((i % 4) + 1);
          return (
            '<div class="file-card" data-url="' + esc(e.publicUrl || "") + '" data-name="' + esc(name) + '">' +
            '<div class="file-thumb ' + th + '">' +
            (hasUrl ? '<img src="' + esc(e.publicUrl) + '" alt="" onerror="this.remove()"/>' : "🖼") +
            '</div><div class="file-meta"><div class="name">' + esc(name) +
            '</div><div class="row"><span>' + esc(String(e.sha256 || "").slice(0, 8) || "—") +
            '</span><span class="tag">' + (hasUrl ? "外链中" : "无外链") + "</span></div></div></div>"
          );
        })
        .join("") || '<div class="muted">暂无映射文件</div>';
    /** @type {NodeListOf<HTMLElement>} */ ($("fileGrid").querySelectorAll(".file-card")).forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.name, card.dataset.url));
    });
    $("statTotal").textContent = String(items.length);
    $("statMapped").textContent = String((list || []).filter((e) => e.publicUrl).length);
    titles.manage[1] = "共 " + items.length + " 个文件";
    if ($("view-manage").style.display !== "none") {
      $("pageCrumb").textContent = titles.manage[1];
    }
  }

  async function refreshManage() {
    const man = await api("/api/manifest");
    manifestEntries = man.data?.data?.entries || man.data?.data?.items || [];
    if (!Array.isArray(manifestEntries)) manifestEntries = [];
    renderFiles(manifestEntries);
    const withUrl = manifestEntries.filter((e) => e.publicUrl).length;
    const links = $("statLinks");
    if (links) links.textContent = String(withUrl);
    const runsEl = $("statRuns");
    if (runsEl) runsEl.remove();
    const now = new Date();
    const ym = now.getUTCFullYear() + "-" + String(now.getUTCMonth() + 1).padStart(2, "0");
    $("statMonth").textContent = String(
      manifestEntries.filter((e) => String(e.updatedAt || "").startsWith(ym)).length
    );
  }

  $("fileSearch").addEventListener("input", () => renderFiles(manifestEntries));
  $("fileSort").onclick = () => {
    sortDesc = !sortDesc;
    $("fileSort").textContent = sortDesc ? "按时间 ↓" : "按时间 ↑";
    renderFiles(manifestEntries);
  };
  $("batchCopy").onclick = async () => {
    const urls = manifestEntries.map((e) => e.publicUrl).filter(Boolean);
    if (!urls.length) return toast("无外链可复制");
    await navigator.clipboard.writeText(urls.join("\n")).catch(() => {});
    toast("已复制 " + urls.length + " 条外链");
  };

  $("loadManifest") && ($("loadManifest").onclick = null);

  async function loadConfigForm() {
    const { data } = await api("/api/config");
    if (!data.ok) return;
    const d = data.data || {};
    const gh = d.github || {};
    const url = d.url || {};
    $("cfgOwner").value = gh.owner || "";
    $("cfgRepo").value = gh.repo || "";
    $("cfgBranch").value = gh.branch || "";
    $("cfgDir").value = gh.dir || "";
    $("cfgUrlStyle").value = url.style || "raw";
    const tok = String(d.token ?? "");
    $("cfgToken").value = tok ? "••••••••" : "";
    $("cfgToken").placeholder = tok
      ? "已配置；粘贴新 PAT 可覆盖"
      : "粘贴 GitHub PAT（ghp_ / gho_ / github_pat_ …）";
    $("cfgToken").title = "可直接粘贴 PAT；保存写入本机用户配置（不进项目文件）";
    const tokBadge = $("tokenStatus");
    if (tokBadge) tokBadge.hidden = !tok;
  }

  $("cfgGet").onclick = async () => {
    const { data } = await api("/api/config");
    $("cfgOut").textContent = JSON.stringify(data, null, 2);
    loadConfigForm();
  };

  $("cfgSet").onclick = async () => {
    if (!(await confirmAsync("将写入配置文件，确认保存设置？"))) return;
    const pairs = [
      ["github.owner", $("cfgOwner").value.trim()],
      ["github.repo", $("cfgRepo").value.trim()],
      ["github.branch", $("cfgBranch").value.trim()],
      ["github.dir", $("cfgDir").value.trim()],
      ["url.style", $("cfgUrlStyle").value],
    ];
    /** @type {any} */
    let last;
    for (const [key, value] of pairs) {
      if (!value) continue;
      last = await api("/api/config", { key, value, confirm: true });
    }
    const tok = $("cfgToken").value.trim();
    if (tok && tok !== "••••••••") {
      last = await api("/api/auth/token", { token: tok, confirm: true });
      if (last.data && last.data.ok) {
        $("authHint").textContent = "已保存 PAT 到本机用户配置";
      } else {
        $("authHint").textContent = (last.data && last.data.error && last.data.error.message) || "Token 保存失败";
        $("cfgOut").textContent = JSON.stringify(last?.data ?? {}, null, 2);
        toast("Token 保存失败 " + last.status);
        return;
      }
    }
    $("cfgOut").textContent = JSON.stringify(last?.data ?? {}, null, 2);
    toast("已保存");
    loadConfigForm();
  };

  // ── GitHub 一键登录（调用 gh auth login --web）──
  let ghLoginPollTimer = null;
  const ghLoginBtn = $("cfgGhLogin");
  const ghLoginLog = $("ghLoginLog");
  const ghLoginHint = $("ghLoginHint");
  const ghLoginBtnLabel = ghLoginBtn ? ghLoginBtn.querySelector("span") : null;

  /** @param {string} text */
  function setGhLoginBtnLabel(text) {
    if (ghLoginBtnLabel) ghLoginBtnLabel.textContent = text;
    else if (ghLoginBtn) ghLoginBtn.textContent = text;
  }

  /** @param {string} kind - "" | "success" | "error" */
  function setGhLoginHint(text, kind = "") {
    if (!ghLoginHint) return;
    ghLoginHint.textContent = text;
    ghLoginHint.classList.remove("success", "error");
    if (kind) ghLoginHint.classList.add(kind);
  }

  function setGhLoginLoading(on, label) {
    if (!ghLoginBtn) return;
    ghLoginBtn.disabled = !!on;
    ghLoginBtn.classList.toggle("is-loading", !!on);
    if (label) setGhLoginBtnLabel(label);
  }

  async function pollGhLoginStatus() {
    const { data } = await api("/api/auth/gh-login/status");
    if (!data.ok) {
      if (ghLoginPollTimer) { clearInterval(ghLoginPollTimer); ghLoginPollTimer = null; }
      setGhLoginLoading(false, "GitHub 一键登录");
      setGhLoginHint((data.error && data.error.message) || "查询状态失败", "error");
      return;
    }
    const d = data.data || {};
    const status = d.status;
    if (d.output) {
      ghLoginLog.hidden = false;
      ghLoginLog.textContent = d.output;
      ghLoginLog.scrollTop = ghLoginLog.scrollHeight;
    }
    if (status === "done") {
      if (ghLoginPollTimer) { clearInterval(ghLoginPollTimer); ghLoginPollTimer = null; }
      setGhLoginLoading(false, "GitHub 一键登录");
      setGhLoginHint(d.message || "✅ 登录成功，已自动获取 token", "success");
      toast("GitHub 登录成功");
      loadConfigForm();
    } else if (status === "error") {
      if (ghLoginPollTimer) { clearInterval(ghLoginPollTimer); ghLoginPollTimer = null; }
      setGhLoginLoading(false, "GitHub 一键登录");
      setGhLoginHint(d.error || "❌ 登录失败", "error");
      toast("登录失败");
    }
  }

  ghLoginBtn && (ghLoginBtn.onclick = async () => {
    if (!(await confirmAsync("将调用 GitHub CLI 进行浏览器授权登录，确认开始？"))) return;
    setGhLoginLoading(true, "启动中…");
    setGhLoginHint("正在启动 gh auth login…");
    ghLoginLog.hidden = false;
    ghLoginLog.textContent = "";

    const { status, data } = await api("/api/auth/gh-login/start");
    if (!data.ok) {
      setGhLoginLoading(false, "GitHub 一键登录");
      setGhLoginHint((data.error && data.error.message) || "启动失败", "error");
      toast("启动登录失败 " + status);
      return;
    }
    const d = data.data || {};
    if (d.status === "done") {
      setGhLoginLoading(false, "GitHub 一键登录");
      setGhLoginHint(d.message || "✅ 已通过 gh CLI 获取 token", "success");
      toast("GitHub 登录成功");
      loadConfigForm();
      return;
    }
    setGhLoginHint(d.message || "请在弹出的浏览器中完成 GitHub 授权…");
    if (ghLoginPollTimer) clearInterval(ghLoginPollTimer);
    ghLoginPollTimer = setInterval(pollGhLoginStatus, 2000);
  });

  $("cfgExport") && ($("cfgExport").onclick = async () => {
    const { status, data } = await api("/api/config/export");
    if (!data.ok) {
      toast("导出失败 " + status);
      return;
    }
    const toml = (data.data && data.data.toml) || "";
    const blob = new Blob([toml], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "picbed.toml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast("已导出 picbed.toml（不含 token）");
  });

  const importFile = $("cfgImportFile");
  $("cfgImport") && ($("cfgImport").onclick = () => importFile && importFile.click());
  importFile && (importFile.onchange = async () => {
    const f = importFile.files && importFile.files[0];
    importFile.value = "";
    if (!f) return;
    const toml = await f.text();
    if (!(await confirmAsync("导入将校验并整体覆盖当前配置（不含 token），确认？"))) return;
    const { status, data } = await api("/api/config/import", { toml, confirm: true });
    $("cfgOut").textContent = JSON.stringify(data, null, 2);
    if (data.ok) {
      toast("已导入配置");
      loadConfigForm();
    } else {
      toast("导入失败 " + status + "：" + ((data.error && data.error.message) || ""));
    }
  });

  const themeSelect = $("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => setTheme(themeSelect.value || ""));
  }

  // 列数/最短列分布需随宽度变化重算
  let staggerTimer = null;
  window.addEventListener("resize", () => {
    if (staggerTimer != null) clearTimeout(staggerTimer);
    staggerTimer = window.setTimeout(() => {
      staggerTimer = null;
      schedulePhotoWallLayout();
    }, 120);
  });

  // 吸顶条背景随滚动渐隐（最低 0.82，禁止全透明）
  function updateWallBarFade() {
    const head = document.querySelector(".dz-head");
    if (!head) return;
    // find the deepest scrolling offset above the bar
    let y = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollers = document.querySelectorAll(".content, .main, .dropzone");
    scrollers.forEach((s) => {
      if (s.scrollTop > y) y = s.scrollTop;
    });
    const minA = 0.82;
    const a = Math.max(minA, 1 - Math.min(1 - minA, y / 240 * (1 - minA)));
    head.style.setProperty("--dz-head-alpha", String(a));
  }
  // capture:true so any scrolling ancestor notifies us
  window.addEventListener("scroll", updateWallBarFade, { passive: true, capture: true });
  updateWallBarFade();

  // init
  try {
    const saved = localStorage.getItem("picbed.theme") || "";
    if (THEME_WHITELIST.indexOf(saved) > -1) curTheme = saved;
  } catch (_) {}
  if (curTheme) document.body.dataset.theme = curTheme;
  applyLogo();
  syncThemeUI();
  renderTokenSwatches();
  renderLogoVarRow();
  refreshHealth();
