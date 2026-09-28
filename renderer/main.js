  /** @type {(id: string) => any} */
  const $ = (id) => document.getElementById(id);
  /** @type {(sel: string) => NodeListOf<HTMLElement>} */
  const qsAll = (sel) => /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(sel));
  /** @type {any[]} */
  let manifestEntries = [];
  let sortDesc = true;

  /* ---- DOTween-style DOM tween (rAF + easing, interruptible) ---- */
  const Ease = {
    /** @param {number} t */
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    /** @param {number} t */
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  /** @type {WeakMap<object, {sx:number,sy:number,x:number,y:number}>} */
  const tweenVal = new WeakMap();
  /** @type {WeakMap<object, number>} */
  const tweenRaf = new WeakMap();

  /** @param {HTMLElement} el */
  function tweenState(el) {
    return tweenVal.get(el) || { sx: 1, sy: 1, x: 0, y: 0 };
  }

  /** @param {HTMLElement} el @param {{sx:number,sy:number,x:number,y:number}} s */
  function applyTransform(el, s) {
    tweenVal.set(el, s);
    el.style.transform = "translate(" + s.x + "px," + s.y + "px) scale(" + s.sx + "," + s.sy + ")";
  }

  /**
   * DOTween-style tween of scale + translate (one rAF per element).
   * A new call cancels the in-flight frame and continues from the live value.
   * @param {HTMLElement} el
   * @param {{ sx?: number, sy?: number, scale?: number, x?: number, y?: number }} to
   * @param {{ duration?: number, ease?: "outCubic" | "inOutSine" }} [opts]
   */
  function dotween(el, to, opts) {
    const duration = (opts && opts.duration) || 0.28;
    const easeFn = opts && opts.ease === "inOutSine" ? Ease.inOutSine : Ease.outCubic;
    const prev = tweenRaf.get(el);
    if (prev != null) cancelAnimationFrame(prev);
    const from = tweenState(el);
    // `scale` is shorthand for uniform sx/sy
    const uni = to.scale != null ? to.scale : null;
    const target = {
      sx: to.sx != null ? to.sx : uni != null ? uni : from.sx,
      sy: to.sy != null ? to.sy : uni != null ? uni : from.sy,
      x: to.x != null ? to.x : from.x,
      y: to.y != null ? to.y : from.y,
    };
    const done =
      Math.abs(from.sx - target.sx) < 0.001 &&
      Math.abs(from.sy - target.sy) < 0.001 &&
      Math.abs(from.x - target.x) < 0.01 &&
      Math.abs(from.y - target.y) < 0.01;
    if (done) {
      applyTransform(el, target);
      return;
    }
    const t0 = performance.now();
    const step = (/** @type {number} */ now) => {
      const t = Math.min(1, (now - t0) / (duration * 1000));
      const k = easeFn(t);
      applyTransform(el, {
        sx: from.sx + (target.sx - from.sx) * k,
        sy: from.sy + (target.sy - from.sy) * k,
        x: from.x + (target.x - from.x) * k,
        y: from.y + (target.y - from.y) * k,
      });
      if (t < 1) tweenRaf.set(el, requestAnimationFrame(step));
      else tweenRaf.delete(el);
    };
    tweenRaf.set(el, requestAnimationFrame(step));
  }

  /**
   * DOScale: tween an element's uniform scale (DOTween-style).
   * @param {HTMLElement} el
   * @param {number} to
   * @param {{ duration?: number, ease?: "outCubic" | "inOutSine" }} [opts]
   */
  function doscale(el, to, opts) {
    dotween(el, { scale: to }, opts);
  }

  /**
   * Photo-wall hover focus (two-phase, no overlap):
   * 1) hovered grows; neighbours SHRINK first (phase 1)
   * 2) then neighbours SHIFT clear of the enlarged box (phase 2)
   * Geometric rule: only grow into free room; dashed-line edges stay pinned.
   * @param {HTMLElement | null} hovered  null → reset every tile
   */
  /** @type {number | null} */
  let wallFocusPhase2 = null;

  function applyWallFocus(hovered) {
    const wall = $("previewGrid");
    const dz = $("dropzone");
    if (!wall || !dz) return;
    const tiles = wall.querySelectorAll(".tile");
    const HOVER_SCALE = 1.22;
    const MARGIN = 8;
    const GAP = 12;
    const SHRINK = 0.88;
    const PHASE1 = 0.18;
    const PHASE2 = 0.22;

    if (wallFocusPhase2 != null) {
      clearTimeout(wallFocusPhase2);
      wallFocusPhase2 = null;
    }

    if (!hovered) {
      tiles.forEach((t) => {
        const el = /** @type {HTMLElement} */ (t);
        el.style.zIndex = "";
        el.style.transformOrigin = "";
        dotween(el, { sx: 1, sy: 1, x: 0, y: 0 }, { ease: "inOutSine", duration: 0.32 });
      });
      return;
    }

    // Coordinates relative to the PHOTO WALL (not the whole dropzone) so
    // enlarged/shifted tiles never paint over the 重置/上传 action bar.
    const wallRect = wall.getBoundingClientRect();
    const originX = wallRect.left + wall.clientLeft;
    const originY = wallRect.top + wall.clientTop;
    const maxW = wall.clientWidth;
    const maxH = wall.clientHeight;

    /**
     * @param {HTMLElement} el
     * @returns {{el:HTMLElement,left:number,top:number,width:number,height:number,cx:number,cy:number,hw:number,hh:number}}
     */
    function measure(el) {
      const saved = el.style.transform;
      el.style.transform = "none";
      const r = el.getBoundingClientRect();
      el.style.transform = saved;
      const left = r.left - originX;
      const top = r.top - originY;
      return {
        el: el,
        left: left,
        top: top,
        width: r.width,
        height: r.height,
        cx: left + r.width / 2,
        cy: top + r.height / 2,
        hw: r.width / 2,
        hh: r.height / 2,
      };
    }

    /** @type {ReturnType<typeof measure>[]} */
    const boxes = [];
    tiles.forEach((t) => boxes.push(measure(/** @type {HTMLElement} */ (t))));
    const h = boxes.find((b) => b.el === hovered);
    if (!h) return;

    // Per-edge dashed-line pin (one edge near → grow away; opposite edges → freeze axis).
    const NEAR = 28;
    const nearLeft = h.left <= MARGIN + NEAR;
    const nearRight = maxW - (h.left + h.width) <= MARGIN + NEAR;
    const nearTop = h.top <= MARGIN + NEAR;
    const nearBottom = maxH - (h.top + h.height) <= MARGIN + NEAR;
    let allowX = true;
    let allowY = true;
    /** @type {0 | 0.5 | 1} */
    let oxn = 0.5;
    /** @type {0 | 0.5 | 1} */
    let oyn = 0.5;

    if (nearLeft && nearRight) {
      allowX = false;
      oxn = 0.5;
    } else if (nearLeft) {
      oxn = 0;
    } else if (nearRight) {
      oxn = 1;
    }
    if (nearTop && nearBottom) {
      allowY = false;
      oyn = 0.5;
    } else if (nearTop) {
      oyn = 0;
    } else if (nearBottom) {
      oyn = 1;
    }

    // Free room to the frame and to SHRUNK neighbours (phase-1 geometry).
    let freeL = h.left - MARGIN;
    let freeR = maxW - MARGIN - (h.left + h.width);
    let freeT = h.top - MARGIN;
    let freeB = maxH - MARGIN - (h.top + h.height);
    boxes.forEach((b) => {
      if (b.el === hovered) return;
      const halfW = b.hw * SHRINK;
      const halfH = b.hh * SHRINK;
      const bL = b.cx - halfW;
      const bR = b.cx + halfW;
      const bT = b.cy - halfH;
      const bB = b.cy + halfH;
      const vO = Math.min(h.top + h.height, bB) - Math.max(h.top, bT);
      const hO = Math.min(h.left + h.width, bR) - Math.max(h.left, bL);
      if (vO > 0) {
        if (bR <= h.left) freeL = Math.min(freeL, h.left - bR - GAP);
        if (bL >= h.left + h.width) freeR = Math.min(freeR, bL - (h.left + h.width) - GAP);
      }
      if (hO > 0) {
        if (bB <= h.top) freeT = Math.min(freeT, h.top - bB - GAP);
        if (bT >= h.top + h.height) freeB = Math.min(freeB, bT - (h.top + h.height) - GAP);
      }
    });
    freeL = Math.max(0, freeL);
    freeR = Math.max(0, freeR);
    freeT = Math.max(0, freeT);
    freeB = Math.max(0, freeB);

    // Origin: pinned edge wins; otherwise the roomier side (toward free space).
    if (allowX && !nearLeft && !nearRight) oxn = freeR >= freeL ? 0 : 1;
    if (allowY && !nearTop && !nearBottom) oyn = freeB >= freeT ? 0 : 1;
    hovered.style.transformOrigin = (oxn * 100) + "% " + (oyn * 100) + "%";
    hovered.style.zIndex = "3";

    /** @param {0 | 0.5 | 1} origin @param {number} before @param {number} after @param {number} size */
    function scaleFromRoom(origin, before, after, size) {
      if (origin === 0) return 1 + after / size;
      if (origin === 1) return 1 + before / size;
      return 1 + 2 * Math.min(before, after) / size;
    }
    let targetSx = allowX ? Math.min(HOVER_SCALE, scaleFromRoom(oxn, freeL, freeR, h.width)) : 1;
    let targetSy = allowY ? Math.min(HOVER_SCALE, scaleFromRoom(oyn, freeT, freeB, h.height)) : 1;
    targetSx = Math.max(1, targetSx);
    targetSy = Math.max(1, targetSy);

    // Enlarged box (non-centre origin) + gap — where neighbours must end up outside of.
    const enL = h.left - h.width * oxn * (targetSx - 1) - GAP;
    const enR = h.left + h.width + h.width * (1 - oxn) * (targetSx - 1) + GAP;
    const enT = h.top - h.height * oyn * (targetSy - 1) - GAP;
    const enB = h.top + h.height + h.height * (1 - oyn) * (targetSy - 1) + GAP;

    /**
     * Phase-2 shift: place the SHRUNK visual box clear of [enL,enR]x[enT,enB],
     * then run pairwise separation so shifted tiles never cover each other.
     */
    /** @type {{el:HTMLElement, cx:number, cy:number, hw:number, hh:number, x:number, y:number}[]} */
    const bodies = [];
    boxes.forEach((b) => {
      if (b.el === hovered) return;
      const sw = b.hw * SHRINK;
      const sh = b.hh * SHRINK;
      const minX = MARGIN + sw - b.cx;
      const maxX = maxW - MARGIN - sw - b.cx;
      const minY = MARGIN + sh - b.cy;
      const maxY = maxH - MARGIN - sh - b.cy;
      let pushX = 0;
      let pushY = 0;
      /** @param {number} px @param {number} py */
      function ov(px, py) {
        const l = b.cx + px - sw;
        const r = b.cx + px + sw;
        const t = b.cy + py - sh;
        const bm = b.cy + py + sh;
        return {
          oX: Math.min(r, enR) - Math.max(l, enL),
          oY: Math.min(bm, enB) - Math.max(t, enT),
          l: l, r: r, t: t, bm: bm,
        };
      }
      const first = ov(0, 0);
      if (first.oX > 0 && first.oY > 0) {
        const preferX = Math.abs(b.cx - h.cx) >= Math.abs(b.cy - h.cy);
        /** @param {ReturnType<typeof ov>} o @param {boolean} horizontal */
        function exit(o, horizontal) {
          if (horizontal) return b.cx >= h.cx ? enR - o.l : -(o.r - enL);
          return b.cy >= h.cy ? enB - o.t : -(o.bm - enT);
        }
        if (preferX) {
          pushX = exit(first, true);
          pushX = Math.min(Math.max(pushX, minX), Math.max(minX, maxX));
          const second = ov(pushX, 0);
          if (second.oX > 0 && second.oY > 0) {
            pushY = exit(second, false);
            pushY = Math.min(Math.max(pushY, minY), Math.max(minY, maxY));
          }
        } else {
          pushY = exit(first, false);
          pushY = Math.min(Math.max(pushY, minY), Math.max(minY, maxY));
          const second = ov(0, pushY);
          if (second.oX > 0 && second.oY > 0) {
            pushX = exit(second, true);
            pushX = Math.min(Math.max(pushX, minX), Math.max(minX, maxX));
          }
        }
      }
      bodies.push({ el: b.el, cx: b.cx, cy: b.cy, hw: sw, hh: sh, x: pushX, y: pushY });
    });

    // Pairwise separation: shifted tiles must not cover each other either.
    // Hovered is a static obstacle (enlarged box); only neighbours absorb MTV.
    for (let iter = 0; iter < 8; iter++) {
      let dirty = false;
      // each neighbour vs the enlarged hovered box
      for (const a of bodies) {
        let l = a.cx + a.x - a.hw;
        let r = a.cx + a.x + a.hw;
        let t = a.cy + a.y - a.hh;
        let bm = a.cy + a.y + a.hh;
        const oX = Math.min(r, enR) - Math.max(l, enL);
        const oY = Math.min(bm, enB) - Math.max(t, enT);
        if (oX > 0 && oY > 0) {
          const preferX = oX < oY;
          if (preferX) {
            a.x += a.cx + a.x >= h.cx ? oX : -oX;
          } else {
            a.y += a.cy + a.y >= h.cy ? oY : -oY;
          }
          dirty = true;
        }
      }
      // neighbour vs neighbour (split MTV)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          const al = a.cx + a.x - a.hw;
          const ar = a.cx + a.x + a.hw;
          const at = a.cy + a.y - a.hh;
          const ab = a.cy + a.y + a.hh;
          const bl = b.cx + b.x - b.hw;
          const br = b.cx + b.x + b.hw;
          const bt = b.cy + b.y - b.hh;
          const bb = b.cy + b.y + b.hh;
          const oX = Math.min(ar, br) - Math.max(al, bl);
          const oY = Math.min(ab, bb) - Math.max(at, bt);
          if (oX > 0 && oY > 0) {
            const preferX = oX < oY;
            const halfX = oX / 2;
            const halfY = oY / 2;
            if (preferX) {
              const dir = a.cx + a.x >= b.cx + b.x ? 1 : -1;
              a.x += dir * halfX;
              b.x -= dir * halfX;
            } else {
              const dir = a.cy + a.y >= b.cy + b.y ? 1 : -1;
              a.y += dir * halfY;
              b.y -= dir * halfY;
            }
            dirty = true;
          }
        }
      }
      // clamp everyone back into the frame
      for (const a of bodies) {
        const minX = MARGIN + a.hw - a.cx;
        const maxX = maxW - MARGIN - a.hw - a.cx;
        const minY = MARGIN + a.hh - a.cy;
        const maxY = maxH - MARGIN - a.hh - a.cy;
        a.x = Math.min(Math.max(a.x, minX), Math.max(minX, maxX));
        a.y = Math.min(Math.max(a.y, minY), Math.max(minY, maxY));
      }
      if (!dirty) break;
    }

    /** @type {{el:HTMLElement, x:number, y:number}[]} */
    const shifts = bodies.map((a) => ({ el: a.el, x: a.x, y: a.y }));

    // ---- Phase 1: neighbours shrink first, hovered grows ----
    boxes.forEach((b) => {
      if (b.el === hovered) return;
      const el = b.el;
      el.style.zIndex = "1";
      el.style.transformOrigin = "50% 50%";
      dotween(el, { sx: SHRINK, sy: SHRINK, x: 0, y: 0 }, { ease: "outCubic", duration: PHASE1 });
    });
    dotween(hovered, { sx: targetSx, sy: targetSy, x: 0, y: 0 }, { ease: "outCubic", duration: 0.28 });

    // ---- Phase 2: after shrink completes, neighbours shift clear ----
    wallFocusPhase2 = window.setTimeout(() => {
      wallFocusPhase2 = null;
      if (!hovered.isConnected) return;
      shifts.forEach((s) => {
        dotween(s.el, { sx: SHRINK, sy: SHRINK, x: s.x, y: s.y }, { ease: "inOutSine", duration: PHASE2 });
      });
    }, Math.round(PHASE1 * 1000));
  }

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
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  /** @param {any} text @param {any=} cls */
  function setHealth(text, cls) {
    const el = $("health");
    el.textContent = text;
    el.style.color = cls === "ok" ? "var(--c-success)" : cls === "bad" ? "var(--c-danger)" : "var(--c-text-3)";
  }

  /** @param {number} used @param {number} total */
  function setQuota(used, total) {
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    $("quotaFill").style.width = pct + "%";
    $("quotaVal").textContent = used + " / " + total;
    $("quota").classList.toggle("hot", pct > 80);
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
    ["upload", "manage", "settings", "doc"].forEach((k) => {
      $("view-" + k).style.display = k === v ? "" : "none";
    });
    $("pageTitle").textContent = titles[v][0];
    $("pageCrumb").textContent = titles[v][1];
    if (v === "manage") refreshManage();
    if (v === "settings") loadConfigForm();
  }
  qsAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

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
    const g = $("previewGrid");
    const a = $("previewActions");
    const dz = $("dropzone");
    if (g) {
      g.hidden = true;
      g.innerHTML = "";
    }
    if (a) a.hidden = true;
    if (dz) dz.classList.remove("has-photos");
    $("dropTitle").textContent = title || "将文件拖放到此处";
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
          '<figure class="tile">' +
          '<img alt="" loading="lazy" src="' + src + '" />' +
          (name ? '<figcaption class="name">' + esc(name) + "</figcaption>" : "") +
          "</figure>"
        );
      })
      .join("");
    g.hidden = false;
    if (dz) dz.classList.add("has-photos");
    // Keep the headline in sync with tiles actually in the wall (failed loads drop out).
    /** @type {NodeListOf<HTMLImageElement>} */ (g.querySelectorAll("img")).forEach((img) => {
      img.addEventListener("error", () => {
        const tile = img.parentNode;
        if (tile && tile.parentNode) tile.parentNode.removeChild(tile);
        syncWallChrome();
      });
    });
    // DOTween hover focus: hovered grows, neighbours shrink + push away.
    g.querySelectorAll(".tile").forEach((tile) => {
      const el = /** @type {HTMLElement} */ (tile);
      el.addEventListener("mouseenter", () => applyWallFocus(el));
      el.addEventListener("mouseleave", () => applyWallFocus(null));
    });
    syncWallChrome();
  }

  /** Show actions/headline only when the wall actually has tiles. */
  function syncWallChrome() {
    const g = $("previewGrid");
    const a = $("previewActions");
    const dz = $("dropzone");
    const n = g ? g.querySelectorAll(".tile").length : 0;
    if (a) a.hidden = n === 0;
    if (n === 0) {
      if (dz) dz.classList.remove("has-photos");
      $("dropTitle").textContent = "将文件拖放到此处";
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
    toast("已重置");
  };

  $("btnUpload").onclick = async () => {
    if (!(await confirmAsync("将上传图片并改写文档，确认上传？"))) return;
    const { status, data } = await api("/api/sync", { confirm: true, dryRun: false });
    if (data.ok) {
      const c = (data.data && data.data.counts) || {};
      toast(c.uploaded != null ? "上传完成 · " + c.uploaded : "上传完成");
      setPreviewIdle();
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
    setQuota(items.length, 200);
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
    const runsRes = await api("/api/runs");
    const runs = runsRes.data?.data?.runs || runsRes.data?.data || [];
    $("statRuns").textContent = String(Array.isArray(runs) ? runs.length : 0);
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

  $("loadManifest").onclick = async () => {
    const { data } = await api("/api/manifest");
    $("revertOut").textContent = JSON.stringify(data, null, 2);
  };
  $("revertDry").onclick = async () => {
    const { data } = await api("/api/revert", { dryRun: true, confirm: true });
    $("revertOut").textContent = JSON.stringify(data, null, 2);
  };
  $("revert").onclick = async () => {
    if (!(await confirmAsync("将把文档中的图床 URL 还原为本地路径，确认 revert？"))) return;
    const { data } = await api("/api/revert", { confirm: true, dryRun: false });
    $("revertOut").textContent = JSON.stringify(data, null, 2);
    toast("revert 已执行");
  };

  $("runs").onclick = async () => {
    const { data } = await api("/api/runs");
    $("runsOut").textContent = JSON.stringify(data, null, 2);
  };

  /** @param {any} mode @param {any} confirmAuto */
  async function watchStart(mode, confirmAuto) {
    const { data } = await api("/api/watch/start", { mode, confirm: confirmAuto });
    $("watchOut").textContent = JSON.stringify(data, null, 2);
  }
  $("watchPreview").onclick = () => watchStart("preview", false);
  $("watchConfirm").onclick = () => watchStart("confirm-each", false);
  $("watchStop").onclick = async () => {
    const { data } = await api("/api/watch/stop", {});
    $("watchOut").textContent = JSON.stringify(data, null, 2);
  };

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
    $("cfgToken").value = tok ? tok : "••••••••";
    $("cfgToken").title = "token 仅掩码展示";
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
    $("cfgOut").textContent = JSON.stringify(last?.data ?? {}, null, 2);
    toast("已保存");
    loadConfigForm();
  };
  $("doctor").onclick = async () => {
    const { data } = await api("/api/doctor", {});
    $("cfgOut").textContent = JSON.stringify(data, null, 2);
    toast(data.ok ? "doctor 通过" : "doctor 发现问题");
  };

  const themeSelect = $("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => setTheme(themeSelect.value || ""));
  }

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
  setQuota(0, 200);
  refreshHealth();
