export const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>picbed 本地控制台</title>
  <script>window.__PICBED_UI_DEV__ = __PICBED_UI_DEV_FLAG__;</script>
  <style>
    /* ========== Design Tokens · 晴空蓝 × 夕照金（京阿尼柔光水彩） ========== */
    :root{
      --c-primary:#4E93C0;
      --c-primary-hover:#3C7BA6;
      --c-primary-soft:#E8F4FB;
      --c-primary-mist:#F3F9FD;
      --c-primary-vivid:#8ACFEE;
      --c-accent:#FFC978;
      --c-success:#6BD9B4;
      --c-danger:#FF8B96;
      --c-bg:#EDF4FA;
      --c-bg-2:#E4EEF8;
      --c-surface:#FFFFFF;
      --c-border:#DCE9F5;
      --c-text:#3E5670;
      --c-text-2:#6B85A2;
      --c-text-3:#93B1CC;
      --c-shadow:90,130,170;
      /* Logo 专属令牌（组件级） */
      --logo-bg:#4E93C0;
      --logo-ink:#FFFFFF;
      --logo-accent:#A9DDF3;
      --logo-line:#FFC978;
      --logo-ring:78,147,192;
      --logo-bg-v2:#8A7EB4;   --logo-accent-v2:#C4BBE4; --logo-line-v2:#FFC978; --logo-ring-v2:138,126,180;
      --logo-bg-v3:#FFC978;   --logo-accent-v3:#FFE3B3; --logo-line-v3:#8A6A3A; --logo-ring-v3:255,201,120;
      /* 图标令牌（粗描边双色 · 随主题） */
      --ico-stroke:#2E4B7E;
      --ico-fill:#FFFFFF;
      --ico-soft:#B5D8F2;
      --ico-muted:#C3D5EC;
      --ico-dot:#FFC978;
      --r-sm:8px; --r-md:14px; --r-lg:20px; --r-full:999px;
      --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px;
      --sp-5:20px; --sp-6:24px; --sp-8:32px;
      --shadow-1:0 2px 8px rgba(90,130,170,.10);
      --shadow-2:0 8px 24px rgba(90,130,170,.14);
      font-family:"PingFang SC","Microsoft YaHei",-apple-system,sans-serif;
    }
    /* A 柔群青 × 夕橙奶油 */
    body[data-theme="klein"]{
      --c-primary:#6484CE; --c-primary-hover:#5573BC; --c-primary-soft:#E9EFFB;
      --c-primary-mist:#F4F8FD; --c-primary-vivid:#8FB0EF;
      --c-accent:#FFA978; --c-success:#6FD4AA; --c-danger:#F4836F;
      --c-bg:#EDF2F9; --c-bg-2:#E5EBF5; --c-border:#DEE5F0;
      --c-text:#3E4A63; --c-text-2:#66748F; --c-text-3:#9FAEC6;
      --c-shadow:100,120,165;
      --logo-bg:#6484CE; --logo-accent:#A9C0F2; --logo-line:#FFA978; --logo-ring:100,132,206;
      --logo-bg-v2:#78739F; --logo-accent-v2:#B4AEE0; --logo-line-v2:#FFA978; --logo-ring-v2:120,115,159;
      --logo-bg-v3:#FFA978; --logo-accent-v3:#FFD0AF; --logo-line-v3:#FFFFFF; --logo-ring-v3:255,169,120;
      --ico-stroke:#2F3D6B; --ico-soft:#A9C0F2; --ico-muted:#CBD3E8; --ico-dot:#FFA978;
    }
    /* B 柔樱粉 × 若叶 */
    body[data-theme="cream"]{
      --c-primary:#D37493; --c-primary-hover:#BE6280; --c-primary-soft:#FBEDF2;
      --c-primary-mist:#FDF7F9; --c-primary-vivid:#F5B3CC;
      --c-accent:#86D9B4; --c-success:#86D9B4; --c-danger:#F58B8E;
      --c-bg:#FAF1F4; --c-bg-2:#F6E9EF; --c-border:#F7E1E9;
      --c-text:#63495E; --c-text-2:#8E718A; --c-text-3:#C6AAC0;
      --c-shadow:175,120,145;
      --logo-bg:#D37493; --logo-accent:#F8C9DC; --logo-line:#FFFFFF; --logo-ring:211,116,147;
      --logo-bg-v2:#6E5468; --logo-accent-v2:#C6A5CE; --logo-line-v2:#F8C9DC; --logo-ring-v2:110,84,104;
      --logo-bg-v3:#86D9B4; --logo-accent-v3:#C2EBDC; --logo-line-v3:#FFFFFF; --logo-ring-v3:134,217,180;
      --ico-stroke:#6E4A62; --ico-soft:#F8C9DC; --ico-muted:#E8D5E0; --ico-dot:#86D9B4;
    }
    /* Logo 候选位提升（回退到当前主题生效值，不写死 hex） */
    body[data-logo="v2"], body[data-theme][data-logo="v2"]{
      --logo-bg:var(--logo-bg-v2, var(--logo-bg));
      --logo-accent:var(--logo-accent-v2, var(--logo-accent));
      --logo-line:var(--logo-line-v2, var(--logo-line));
      --logo-ring:var(--logo-ring-v2, var(--logo-ring));
    }
    body[data-logo="v3"], body[data-theme][data-logo="v3"]{
      --logo-bg:var(--logo-bg-v3, var(--logo-bg));
      --logo-accent:var(--logo-accent-v3, var(--logo-accent));
      --logo-line:var(--logo-line-v3, var(--logo-line));
      --logo-ring:var(--logo-ring-v3, var(--logo-ring));
    }

    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:
        radial-gradient(1100px 460px at 16% -8%, rgba(255,255,255,.85), rgba(255,255,255,0) 68%),
        linear-gradient(180deg, var(--c-bg) 0%, var(--c-bg-2) 100%);
      background-attachment:fixed;
      color:var(--c-text);
      font-size:14px; line-height:1.5; min-width:860px;
      --shadow-1:0 2px 8px rgba(var(--c-shadow,90,130,170),.10);
      --shadow-2:0 8px 24px rgba(var(--c-shadow,90,130,170),.14);
    }
    .app{display:flex; height:100vh}
    .sidebar{
      width:72px; background:var(--c-surface);
      border-right:1px solid var(--c-border);
      display:flex; flex-direction:column; align-items:center;
      padding:var(--sp-5) 0; gap:var(--sp-2);
    }

    /* Logo：造型零色值，全部消费 --logo-* */
    .logo{
      width:44px;height:44px;border-radius:14px;
      margin-bottom:var(--sp-6); position:relative; overflow:hidden;
      cursor:pointer; flex-shrink:0; transition:transform .15s, box-shadow .2s;
      box-shadow:0 2px 6px rgba(var(--logo-ring,78,147,192),.28);
    }
    .logo .bg{fill:var(--logo-bg,#4E93C0)}
    .logo .ink-f{fill:var(--logo-ink,#FFFFFF)}
    .logo .accent{fill:var(--logo-accent,#A9DDF3)}
    .logo .link{stroke:var(--logo-line,#FFC978)}
    .logo .g-scan rect{fill:var(--logo-line,#FFC978)}
    .logo .g-up path{stroke:var(--logo-ink,#FFFFFF)}
    .logo:hover{transform:scale(1.06)}
    .logo svg{width:100%;height:100%;display:block}
    .logo .g-scan{opacity:0}
    .logo.scanning{animation:ringPulse 1.2s ease-out infinite}
    .logo.scanning .g-scan{opacity:1; animation:scanMove 1.2s ease-in-out infinite}
    @keyframes scanMove{0%,100%{transform:translateY(13px)}50%{transform:translateY(24px)}}
    @keyframes ringPulse{
      0%{box-shadow:0 0 0 0 rgba(var(--logo-ring,78,147,192),.45)}
      100%{box-shadow:0 0 0 12px rgba(var(--logo-ring,78,147,192),0)}
    }
    .logo .g-up{opacity:0}
    .logo.uploading .g-up{opacity:1; animation:rise 0.9s ease-in-out infinite}
    .logo.uploading .g-glyph{animation:settle 0.9s ease-in-out infinite}
    @keyframes rise{
      0%{transform:translateY(4px);opacity:.2}
      45%{transform:translateY(-1px);opacity:1}
      100%{transform:translateY(-6px);opacity:0}
    }
    @keyframes settle{0%,100%{transform:translateY(0)}45%{transform:translateY(1.5px)}}

    .nav-item{
      width:56px; padding:var(--sp-2) 0;
      display:flex; flex-direction:column; align-items:center; gap:4px;
      border-radius:var(--r-md); cursor:pointer;
      color:var(--c-text-2); font-size:12px;
      transition:all .15s; border:none; background:none;
    }
    .nav-item .ico{width:22px;height:22px;display:block}
    .nav-item:hover{background:var(--c-primary-soft); color:var(--c-primary)}
    .nav-item.active{background:var(--c-primary-soft); color:var(--c-primary); font-weight:600}
    .sidebar .spacer{flex:1}
    .avatar{
      width:36px;height:36px;border-radius:var(--r-full);
      background:var(--c-primary-soft);color:var(--c-primary);
      display:flex;align-items:center;justify-content:center;font-weight:600;
    }

    .main{flex:1; display:flex; flex-direction:column; overflow:hidden}
    .topbar{
      height:56px; background:var(--c-surface);
      border-bottom:1px solid var(--c-border);
      display:flex; align-items:center; padding:0 var(--sp-6); gap:var(--sp-4);
    }
    .topbar h1{font-size:16px; font-weight:600}
    .topbar .crumb{color:var(--c-text-3); font-size:13px}
    .topbar .right{margin-left:auto; display:flex; gap:var(--sp-3); align-items:center}
    .content{flex:1; overflow:auto; padding:var(--sp-6)}
    .hint{font-size:12px; color:var(--c-text-3)}

    /* 图标令牌消费（symbol 内只挂 class，零硬编码） */
    .ico-s{fill:var(--ico-fill,#fff); stroke:var(--ico-stroke,#2E4B7E)}
    .ico-stroke{fill:none; stroke:var(--ico-stroke,#2E4B7E)}
    .ico-soft{fill:var(--ico-soft,#B5D8F2); stroke:var(--ico-stroke,#2E4B7E)}
    .ico-muted{fill:var(--ico-muted,#C3D5EC); stroke:var(--ico-stroke,#2E4B7E)}
    .ico-dot{fill:var(--ico-dot,#FFC978)}

    /* 顶栏容量进度条：主色填充 + Primary-Soft 轨道，>80% 转 Danger */
    .quota{display:flex; align-items:center; gap:8px; min-width:180px}
    .quota .lbl{font-size:12px; color:var(--c-text-3); white-space:nowrap}
    .quota .bar{
      flex:1; height:6px; border-radius:var(--r-full);
      background:var(--c-primary-soft); overflow:hidden;
    }
    .quota .fill{height:100%; width:24%; border-radius:var(--r-full); background:var(--c-primary); transition:width .3s, background .2s}
    .quota.hot .fill{background:var(--c-danger)}
    .quota .val{font-size:12px; color:var(--c-text-2); white-space:nowrap}

    .theme-pills{display:flex; gap:6px}
    .pill{
      font-size:11px; padding:4px 10px; border-radius:var(--r-full);
      border:1px solid var(--c-border); background:var(--c-surface);
      color:var(--c-text-2); cursor:pointer; font-family:inherit;
    }
    .pill:hover{border-color:var(--c-primary); color:var(--c-primary)}
    .pill.active{background:var(--c-primary); border-color:var(--c-primary); color:#fff; font-weight:600}

    .dropzone{
      min-height:420px;
      border:2px dashed var(--c-border);
      border-radius:var(--r-lg); background:var(--c-surface);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:var(--sp-4); transition:all .2s; cursor:pointer;
      padding:var(--sp-6);
    }
    .dropzone:hover,.dropzone.drag{
      border-color:var(--c-primary); background:var(--c-primary-soft);
    }
    .dropzone .big-ico{
      width:88px;height:88px;border-radius:var(--r-full);
      background:var(--c-primary-soft); display:flex;align-items:center;justify-content:center;
    }
    .dropzone .big-ico svg{width:52px;height:52px}
    .dropzone h2{font-size:18px}
    .dropzone p{color:var(--c-text-2)}
    .preview-grid{
      display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));
      gap:10px;margin:18px 0 12px;max-height:280px;overflow:auto;
    }
    .preview-grid img{
      width:100%;height:88px;object-fit:cover;border-radius:10px;
      border:1px solid var(--c-border);background:var(--c-surface);
    }
    .preview-grid .miss{
      height:88px;border-radius:10px;border:1px dashed var(--c-border);
      display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--c-text-3);
    }

    .btn{
      padding:10px 24px; border-radius:var(--r-md); border:none;
      font-size:14px; cursor:pointer; transition:all .15s; font-weight:500;
    }
    .btn-primary{background:var(--c-primary); color:#fff}
    .btn-primary:hover{background:var(--c-primary-hover)}
    .btn-ghost{background:none; color:var(--c-text-2); border:1px solid var(--c-border)}
    .btn-ghost:hover{color:var(--c-primary); border-color:var(--c-primary)}
    .btn-danger{background:none; color:var(--c-danger); border:1px solid var(--c-danger)}
    .btn:disabled{opacity:.45; cursor:not-allowed}

    .card{
      background:var(--c-surface); border-radius:var(--r-md);
      padding:var(--sp-5); margin-top:var(--sp-4); box-shadow:var(--shadow-1);
    }
    .card h3{font-size:15px; margin-bottom:var(--sp-3)}
    .row{display:flex; gap:var(--sp-3); align-items:center; flex-wrap:wrap}
    .row input[type="text"], .row select{
      flex:1; min-width:180px; padding:8px 12px;
      border:1px solid var(--c-border); border-radius:var(--r-sm);
      font-size:14px; background:var(--c-surface); color:var(--c-text);
    }
    .row input:focus,.row select:focus{outline:none; border-color:var(--c-primary)}
    .status{font-size:12px; color:var(--c-text-2); margin-top:var(--sp-2)}
    .status.ok{color:var(--c-success)}
    .status.bad{color:var(--c-danger)}

    table{width:100%; border-collapse:collapse; font-size:12px}
    th,td{text-align:left; padding:8px 6px; border-bottom:1px solid var(--c-border); vertical-align:top; word-break:break-all}
    th{color:var(--c-text-2); font-weight:500}
    .tag{
      display:inline-block; font-size:11px; padding:1px 8px;
      border-radius:var(--r-full); background:var(--c-primary-soft); color:var(--c-primary);
    }
    .tag.upload{background:var(--c-primary-soft); color:var(--c-primary)}
    .tag.skip-cache{background:rgba(76,154,130,.15); color:var(--c-success)}
    .tag.skip-remote{background:rgba(154,171,188,.2); color:var(--c-text-2)}
    .tag.blocked{background:rgba(196,107,92,.15); color:var(--c-danger)}
    .tag.dir,.tag.file{background:rgba(154,171,188,.18); color:var(--c-text-2)}
    pre{
      background:var(--c-bg); border:1px solid var(--c-border); border-radius:var(--r-sm);
      padding:12px; overflow:auto; max-height:220px; font-size:11px; margin-top:var(--sp-3);
    }
    .muted{color:var(--c-text-3)}
    .linkish{
      border:none; background:none; color:var(--c-danger);
      font-size:11px; cursor:pointer; padding:0 4px; font-family:inherit;
    }
    .linkish:hover{text-decoration:underline}

    .stat-row{display:flex; gap:var(--sp-4); margin-bottom:var(--sp-5)}
    .stat-card{
      flex:1; background:var(--c-surface); border-radius:var(--r-md);
      padding:var(--sp-4) var(--sp-5); box-shadow:var(--shadow-1);
    }
    .stat-card .num{font-size:22px; font-weight:700; margin-top:4px}
    .stat-card .lbl{color:var(--c-text-2); font-size:13px}
    .toolbar{display:flex; gap:var(--sp-3); margin-bottom:var(--sp-4); align-items:center}
    .search{
      flex:1; max-width:320px; padding:8px 12px;
      border:1px solid var(--c-border); border-radius:var(--r-md);
      background:var(--c-surface); color:var(--c-text);
    }
    .search::placeholder{color:var(--c-text-3)}
    .file-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:var(--sp-4)}
    @media (max-width:1100px){ .file-grid{grid-template-columns:repeat(3,1fr)} }
    .file-card{
      background:var(--c-surface); border-radius:var(--r-md); overflow:hidden;
      box-shadow:var(--shadow-1); transition:all .15s; cursor:pointer;
      border:1px solid transparent;
    }
    .file-card:hover{box-shadow:var(--shadow-2); transform:translateY(-2px)}
    .file-thumb{
      height:110px; display:flex;align-items:center;justify-content:center;
      font-size:34px; color:#fff;
    }
    .file-thumb.th1{background:linear-gradient(135deg,#A9DDF3,#4E93C0)}
    .file-thumb.th2{background:linear-gradient(135deg,#FFE3B3,#FFC978)}
    .file-thumb.th3{background:linear-gradient(135deg,#C4BBE4,#8A7EB4)}
    .file-thumb.th4{background:linear-gradient(135deg,#B8E8D8,#6BD9B4)}
    body[data-theme="klein"] .th1{background:linear-gradient(135deg,#A9C0F2,#6484CE)}
    body[data-theme="klein"] .th2{background:linear-gradient(135deg,#FFD0AF,#FFA978)}
    body[data-theme="klein"] .th3{background:linear-gradient(135deg,#CBD3E8,#8D99B8)}
    body[data-theme="klein"] .th4{background:linear-gradient(135deg,#9A95C4,#6E6A9E)}
    body[data-theme="cream"] .th1{background:linear-gradient(135deg,#F8C9DC,#D37493)}
    body[data-theme="cream"] .th2{background:linear-gradient(135deg,#C2EBDC,#86D9B4)}
    body[data-theme="cream"] .th3{background:linear-gradient(135deg,#FFE4EE,#F5B3CC)}
    body[data-theme="cream"] .th4{background:linear-gradient(135deg,#D6EEF4,#A8D4DE)}
    .file-thumb img{width:100%;height:100%;object-fit:cover}
    .file-meta{padding:var(--sp-3)}
    .file-meta .name{font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
    .file-meta .row{display:flex; justify-content:space-between; margin-top:4px; font-size:12px; color:var(--c-text-3)}

    .settings{max-width:640px}
    .form-row{display:flex; align-items:center; margin-bottom:var(--sp-4)}
    .form-row:last-child{margin-bottom:0}
    .form-row label{width:150px; color:var(--c-text-2); flex-shrink:0; white-space:nowrap}
    .form-row input[type="text"], .form-row select{
      flex:1; padding:8px 12px; border:1px solid var(--c-border);
      border-radius:var(--r-sm); font-size:14px;
    }
    .form-row input:focus,.form-row select:focus{outline:none; border-color:var(--c-primary)}
    .form-row .switch{position:relative; width:36px; height:20px; margin-left:auto; flex-shrink:0}
    .switch input{display:none}
    .switch .track{
      position:absolute; inset:0; background:var(--c-border);
      border-radius:var(--r-full); cursor:pointer; transition:.2s;
    }
    .switch .track::after{
      content:""; position:absolute; width:16px;height:16px;
      border-radius:50%; background:#fff; top:2px; left:2px; transition:.2s;
      box-shadow:var(--shadow-1);
    }
    .switch input:checked + .track{background:var(--c-primary)}
    .switch input:checked + .track::after{left:18px}

    .doc{max-width:860px}
    .token-row{display:flex; gap:var(--sp-3); flex-wrap:wrap; margin:var(--sp-3) 0}
    .chip{
      display:flex; align-items:center; gap:8px;
      background:var(--c-surface); border:1px solid var(--c-border);
      border-radius:var(--r-md); padding:8px 14px; font-size:13px;
    }
    .chip-btn{cursor:pointer; font-family:inherit; color:var(--c-text-2); transition:all .15s}
    .chip-btn:hover{border-color:var(--c-primary); color:var(--c-primary)}
    .chip-btn.active{background:var(--c-primary); color:#fff; border-color:var(--c-primary); font-weight:600}
    .dot{width:16px;height:16px;border-radius:4px}
    .spec-list{margin:var(--sp-3) 0 0; padding-left:20px; color:var(--c-text-2); font-size:13px}
    .spec-list li{margin-bottom:6px}
    .doc h2{font-size:16px; margin:var(--sp-6) 0 var(--sp-2)}
    .doc h2:first-child{margin-top:0}
    code{
      background:var(--c-bg); padding:1px 6px; border-radius:4px;
      font-family:Consolas,monospace; font-size:12px; color:var(--c-danger);
    }

    .toast{
      position:fixed; left:50%; bottom:32px; transform:translate(-50%,12px);
      background:var(--c-surface); color:var(--c-text);
      padding:12px 18px; border:1px solid var(--c-border);
      border-radius:var(--r-md); box-shadow:var(--shadow-2);
      opacity:0; pointer-events:none; transition:all .25s;
      z-index:50;
      display:flex; align-items:center; gap:10px;
    }
    .toast.show{opacity:1; transform:translate(-50%,0)}
    .toast .mark{
      width:22px;height:22px;border-radius:var(--r-full); flex-shrink:0;
      background:var(--c-accent); color:#fff; font-size:12px;
      display:flex; align-items:center; justify-content:center;
    }

    .modal{
      position:fixed; inset:0; background:rgba(37,56,74,.35);
      display:none; align-items:center; justify-content:center; z-index:40;
    }
    .modal.show{display:flex}
    .modal .panel{
      background:var(--c-surface); border-radius:var(--r-lg); padding:var(--sp-6);
      width:min(420px,90vw); box-shadow:var(--shadow-2);
      animation:fadeUp .15s ease-out;
    }
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .modal h3{margin-bottom:var(--sp-3)}
    .modal .actions{display:flex; gap:var(--sp-3); justify-content:flex-end; margin-top:var(--sp-5)}
    .detail-url{
      font-size:11px; word-break:break-all; background:var(--c-bg);
      border:1px solid var(--c-border); border-radius:var(--r-sm);
      padding:8px; margin-top:8px; color:var(--c-text-2);
    }
  </style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="i-upload" viewBox="0 0 24 24">
    <rect class="ico-s" x="3.5" y="11" width="17" height="9.5" rx="1.5" stroke-width="2"/>
    <path class="ico-stroke" d="M12 3.2v8.8M8.5 6.7 12 3.2l3.5 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect class="ico-soft" x="7" y="16.2" width="10" height="2.4" rx="1.2"/>
  </symbol>
  <symbol id="i-folder" viewBox="0 0 24 24">
    <path class="ico-s" d="M3.5 6.2A1.7 1.7 0 0 1 5.2 4.5h3.9l2.1 2.6h7.6a1.7 1.7 0 0 1 1.7 1.7v9.5a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z" stroke-width="2" stroke-linejoin="round"/>
    <rect class="ico-soft" x="6.8" y="13.2" width="7.5" height="2.2" rx="1.1"/>
    <rect class="ico-muted" x="6.8" y="16.4" width="4.5" height="2.2" rx="1.1"/>
  </symbol>
  <symbol id="i-gear" viewBox="0 0 24 24">
    <circle class="ico-s" cx="12" cy="12" r="5.4" stroke-width="2"/>
    <circle class="ico-soft" cx="12" cy="12" r="1.9"/>
    <g class="ico-stroke" stroke-width="2" stroke-linecap="round">
      <path d="M12 2.6v2.8"/><path d="M12 18.6v2.8"/>
      <path d="M2.6 12h2.8"/><path d="M18.6 12h2.8"/>
      <path d="M5.4 5.4l2 2"/><path d="M16.6 16.6l2 2"/>
      <path d="M18.6 5.4l-2 2"/><path d="M7.4 16.6l-2 2"/>
    </g>
  </symbol>
  <symbol id="i-search" viewBox="0 0 24 24">
    <circle class="ico-s" cx="10.5" cy="10.5" r="6.4" stroke-width="2"/>
    <path class="ico-stroke" d="M15.3 15.3l5 5" stroke-width="2" stroke-linecap="round"/>
    <path class="ico-soft" d="M7.3 9.2a3.6 3.6 0 0 1 2.6-2.4" stroke-width="2" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-book" viewBox="0 0 24 24">
    <path class="ico-s" d="M4.5 5.2A1.7 1.7 0 0 1 6.2 3.5h5.3a2 2 0 0 1 2 2v14a1.8 1.8 0 0 0-1.8-1.8H6.2A1.7 1.7 0 0 1 4.5 16z" stroke-width="2" stroke-linejoin="round"/>
    <path class="ico-soft" d="M19.5 5.2a1.7 1.7 0 0 0-1.7-1.7H12.5a2 2 0 0 0-2 2v14a1.8 1.8 0 0 1 1.8-1.8h5.5a1.7 1.7 0 0 0 1.7-1.7z" stroke-width="2" stroke-linejoin="round"/>
    <path class="ico-muted" d="M8 8.5h4M8 12h3" stroke-width="2" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-image" viewBox="0 0 24 24">
    <rect class="ico-s" x="3" y="4" width="18" height="16" rx="2" stroke-width="2"/>
    <circle class="ico-dot" cx="15.6" cy="9" r="1.8"/>
    <path class="ico-soft" d="M4.8 18.2 9.4 12.2l4 6z" stroke-width="1.6" stroke-linejoin="round"/>
    <path class="ico-muted" d="M12.4 18.2l3.2-3.8 3.6 3.8z" stroke-width="1.6" stroke-linejoin="round"/>
  </symbol>
</svg>

<div class="app">
  <nav class="sidebar">
    <div class="logo" id="logo" title="点击预览 Logo 动效状态">
      <svg viewBox="0 0 40 40">
        <rect class="bg" width="40" height="40" rx="13"/>
        <g class="g-glyph">
          <rect class="ink-f" x="8" y="9" width="13" height="13" rx="2.5"/>
          <rect class="accent" x="19" y="18" width="13" height="13" rx="2.5"/>
          <path class="link" d="M14.6 17.2 23.4 26" fill="none" stroke-width="2.4" stroke-linecap="round"/>
        </g>
        <g class="g-scan"><rect x="10" width="20" height="2.8" rx="1.4"/></g>
        <g class="g-up">
          <path d="M20 30v-9.5" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M16 24l4-4 4 4" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    </div>
    <button class="nav-item active" data-view="upload"><svg class="ico"><use href="#i-upload"/></svg>上传</button>
    <button class="nav-item" data-view="manage"><svg class="ico"><use href="#i-folder"/></svg>管理</button>
    <button class="nav-item" data-view="settings"><svg class="ico"><use href="#i-gear"/></svg>设置</button>
    <button class="nav-item" id="navDoc" data-view="doc" hidden><svg class="ico"><use href="#i-book"/></svg>规范</button>
    <div class="spacer"></div>
    <div class="avatar">P</div>
  </nav>

  <main class="main">
    <header class="topbar">
      <h1 id="pageTitle">文件放置</h1>
      <span class="crumb" id="pageCrumb">拖入文件即可上传 · picbed 本地控制台</span>
      <div class="right">
        <div class="quota" id="quota" title="本机映射规模示意">
          <span class="lbl">已用</span>
          <div class="bar"><div class="fill" id="quotaFill"></div></div>
          <span class="val" id="quotaVal">0 / 200</span>
        </div>
        <div class="theme-pills" id="themePills">
          <button type="button" class="pill active" data-theme-btn="">晴空蓝</button>
          <button type="button" class="pill" data-theme-btn="klein">柔群青</button>
          <button type="button" class="pill" data-theme-btn="cream">柔樱粉</button>
        </div>
        <span class="hint" id="health">…</span>
      </div>
    </header>

    <!-- 上传 / 文件放置 -->
    <section class="content" id="view-upload">
      <div class="dropzone" id="dropzone">
        <div class="big-ico"><svg><use href="#i-image"/></svg></div>
        <h2 id="dropTitle">将文件拖放到此处</h2>
        <p>拖拽 md / html 文档或文件夹 · 自动扫描图片</p>
        <span class="hint">支持 JPG / PNG / GIF / WebP · 扫描成功后可上传或重置</span>
        <div class="preview-grid" id="previewGrid" hidden></div>
        <div class="row" id="previewActions" style="justify-content:center" hidden>
          <button class="btn btn-ghost" id="btnReset" type="button">重置</button>
          <button class="btn btn-primary" id="btnUpload" type="button">上传</button>
        </div>
      </div>
    </section>

    <!-- 管理 -->
    <section class="content" id="view-manage" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div class="lbl">文件总数</div><div class="num" id="statTotal">0</div></div>
        <div class="stat-card"><div class="lbl">本月上传</div><div class="num" id="statMonth">0</div></div>
        <div class="stat-card"><div class="lbl">已映射</div><div class="num" id="statMapped">0</div></div>
        <div class="stat-card"><div class="lbl">审计记录</div><div class="num" id="statRuns">0</div></div>
      </div>
      <div class="toolbar">
        <input class="search" id="fileSearch" placeholder="搜索文件名…" />
        <button class="btn btn-ghost" id="fileSort" type="button">按时间 ↓</button>
        <button class="btn btn-primary" id="batchCopy" type="button" style="margin-left:auto">批量复制外链</button>
      </div>
      <div class="file-grid" id="fileGrid"></div>

      <div class="card">
        <h3>回滚（F19）</h3>
        <div class="row">
          <button class="btn btn-ghost" id="loadManifest" type="button">查看 manifest</button>
          <button class="btn btn-ghost" id="revertDry" type="button">revert --dry-run</button>
          <button class="btn btn-danger" id="revert" type="button">确认并 revert</button>
        </div>
        <pre id="revertOut">（尚无）</pre>
      </div>

      <div class="card">
        <h3>审计 run（F21）</h3>
        <div class="row"><button class="btn btn-ghost" id="runs" type="button">刷新 runs</button></div>
        <pre id="runsOut">（尚无）</pre>
      </div>

      <div class="card">
        <h3>watch（F22）</h3>
        <div class="row">
          <button class="btn btn-ghost" id="watchPreview" type="button">启动 preview</button>
          <button class="btn btn-ghost" id="watchConfirm" type="button">启动 confirm-each</button>
          <button class="btn btn-ghost" id="watchStop" type="button">停止</button>
        </div>
        <pre id="watchOut">（未启动）</pre>
      </div>
    </section>

    <!-- 设置 -->
    <section class="content" id="view-settings" style="display:none">
      <div class="settings">
        <div class="card" style="margin-top:0">
          <h3>图床配置</h3>
          <div class="form-row"><label>Owner</label><input type="text" id="cfgOwner" placeholder="github.owner" /></div>
          <div class="form-row"><label>Repo</label><input type="text" id="cfgRepo" placeholder="github.repo" /></div>
          <div class="form-row"><label>Branch</label><input type="text" id="cfgBranch" placeholder="github.branch" /></div>
          <div class="form-row"><label>目录</label><input type="text" id="cfgDir" placeholder="github.dir" /></div>
          <div class="form-row"><label>URL 风格</label>
            <select id="cfgUrlStyle">
              <option value="raw">raw</option>
              <option value="jsdelivr">jsdelivr</option>
              <option value="custom">custom</option>
            </select>
          </div>
          <div class="form-row"><label>Token</label><input type="text" id="cfgToken" readonly value="••••••••" /></div>
        </div>
        <div class="card">
          <h3>上传偏好</h3>
          <div class="form-row"><label>写操作需确认</label>
            <label class="switch"><input type="checkbox" id="prefConfirm" checked><span class="track"></span></label>
          </div>
          <div class="form-row"><label>自动备份文档</label>
            <label class="switch"><input type="checkbox" id="prefBackup" checked><span class="track"></span></label>
          </div>
          <div class="form-row"><label>watch 默认预览</label>
            <label class="switch"><input type="checkbox" id="prefWatchPreview" checked><span class="track"></span></label>
          </div>
        </div>
        <div class="card">
          <h3>外观主题</h3>
          <div class="form-row"><label>界面主题</label>
            <select id="themeSelect">
              <option value="">晴空蓝 × 夕照金</option>
              <option value="klein">A 柔群青 × 夕橙</option>
              <option value="cream">B 柔樱粉 × 若叶</option>
            </select>
          </div>
          <div class="hint">主题切换即时生效并记忆在本机 localStorage；Logo 候选随主题联动。</div>
        </div>
        <div class="card">
          <h3>自检 doctor（F20）</h3>
          <div class="row">
            <button class="btn btn-ghost" id="doctor" type="button">运行 doctor</button>
            <button class="btn btn-ghost" id="cfgGet" type="button">读配置</button>
            <button class="btn btn-primary" id="cfgSet" type="button">保存设置</button>
          </div>
          <div class="status hint" id="cfgHint">缺 token 时使用 PICBED_GITHUB_TOKEN / GITHUB_TOKEN / gh auth token；此处永不回显 secret。</div>
          <pre id="cfgOut">（尚无）</pre>
        </div>
      </div>
    </section>

    <!-- 规范 -->
    <section class="content doc" id="view-doc" style="display:none">
      <p class="hint" style="margin-bottom:16px">💡 顶栏可切换三套主题；Logo 候选随主题联动；点击左上角 Logo 预览扫描 / 上传动效。</p>
      <h2>🎨 主题配色（京阿尼柔光 · 三套令牌换肤）</h2>
      <div class="token-row" id="themeSwitchRow">
        <button type="button" class="chip chip-btn active" data-theme-btn="">默认 · 晴空蓝</button>
        <button type="button" class="chip chip-btn" data-theme-btn="klein">A · 柔群青</button>
        <button type="button" class="chip chip-btn" data-theme-btn="cream">B · 柔樱粉</button>
      </div>
      <div class="token-row" id="tokenSwatches"></div>
      <ul class="spec-list">
        <li><b>京阿尼七原则</b>：去浊提纯 · 彩度阴影 · 高光留白 · 空气透视 · 亮色分离 · 柔化降饱和 · 彩色柔影</li>
        <li>底色：A <code>#EDF2F9</code> · B <code>#FAF1F4</code> · 默认 <code>#EDF4FA</code>（与纯白差 10+）</li>
        <li>页面空气渐变 + 顶部白雾；投影用 <code>--c-shadow</code> 彩色柔影，不用死黑</li>
        <li>换肤原理：<code>body[data-theme]</code> 覆盖 <code>--c-*</code> 与 <code>--logo-*</code>，组件结构零改动</li>
      </ul>
      <h2>✨ Logo 令牌与候选位</h2>
      <ul class="spec-list">
        <li>SVG 造型<strong>零色值</strong>，全部 <code>var(--logo-*)</code>；JS 只写 <code>data-theme</code> / <code>data-logo</code></li>
        <li>候选位 ① 主色同族 ② 中性 ③ 辅助色点睛 —— 随主题自动切换三套</li>
      </ul>
      <div class="token-row" id="logoVarRow"></div>
      <h2>🖼 图标规范</h2>
      <div class="token-row">
        <div class="chip"><svg style="width:30px;height:30px"><use href="#i-upload"/></svg>i-upload</div>
        <div class="chip"><svg style="width:30px;height:30px"><use href="#i-folder"/></svg>i-folder</div>
        <div class="chip"><svg style="width:30px;height:30px"><use href="#i-gear"/></svg>i-gear</div>
        <div class="chip"><svg style="width:30px;height:30px"><use href="#i-search"/></svg>i-search</div>
        <div class="chip"><svg style="width:30px;height:30px"><use href="#i-book"/></svg>i-book</div>
        <div class="chip"><svg style="width:30px;height:30px"><use href="#i-image"/></svg>i-image</div>
      </div>
      <ul class="spec-list">
        <li>粗描边双色 · 描边 <code>#2E4B7E</code> · 线宽 2/24 · 点缀 <code>#B5D8F2</code> / <code>#C9CDD4</code></li>
        <li>导航 22px · 行内 16px · 空状态主视觉 52px</li>
      </ul>
      <h2>🔗 交互</h2>
      <ul class="spec-list">
        <li>导航四视图 · 拖放触发 Logo 动效 · FileCard 详情浮层（复制外链）· 设置保存 Toast（琥珀点睛）</li>
        <li>顶栏容量条 &gt;80% 自动转 Danger</li>
      </ul>
    </section>
  </main>
</div>

<div class="toast" id="toast"><span class="mark">✓</span><span id="toastText"></span></div>
<div class="modal" id="modal">
  <div class="panel">
    <h3 id="modalTitle">确认</h3>
    <p id="modalBody" class="hint"></p>
    <div id="modalExtra"></div>
    <div class="actions">
      <button class="btn btn-ghost" id="modalCancel" type="button">取消</button>
      <button class="btn btn-primary" id="modalOk" type="button">确认</button>
    </div>
  </div>
</div>

<script>
  const $ = (id) => document.getElementById(id);
  let manifestEntries = [];
  let sortDesc = true;

  const THEME_WHITELIST = ["", "klein", "cream"];
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
  const THEME_TOKENS = {
    "": { name: "晴空蓝", primary: "#4E93C0", accent: "#FFC978", bg: "#EDF4FA", text: "#3E5670", soft: "#E8F4FB", border: "#DCE9F5" },
    klein: { name: "柔群青", primary: "#6484CE", accent: "#FFA978", bg: "#EDF2F9", text: "#3E4A63", soft: "#E9EFFB", border: "#DEE5F0" },
    cream: { name: "柔樱粉", primary: "#D37493", accent: "#86D9B4", bg: "#FAF1F4", text: "#63495E", soft: "#FBEDF2", border: "#F7E1E9" },
  };

  let curTheme = "";
  let curLogo = 0;

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
    document.querySelectorAll("[data-theme-btn]").forEach((b) => {
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
    const list = LOGO_VARIANTS[curTheme] || LOGO_VARIANTS[""];
    const el = $("logoVarRow");
    if (!el) return;
    el.innerHTML = list.map((v, i) =>
      '<button type="button" class="chip chip-btn' + (i === curLogo ? " active" : "") + '" data-logo-idx="' + i + '">' + v.label + "</button>"
    ).join("");
    el.querySelectorAll("[data-logo-idx]").forEach((b) => {
      b.addEventListener("click", () => {
        curLogo = Number(b.dataset.logoIdx) || 0;
        applyLogo();
        renderLogoVarRow();
      });
    });
  }

  document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeBtn || ""));
  });

  const titles = {
    upload: ["文件放置", "拖入文件即可上传 · picbed 本地控制台"],
    manage: ["文件管理", "共 0 个文件"],
    settings: ["设置", "图床配置与上传偏好"],
    doc: ["设计规范", "令牌 · 组件 · 原型连线"],
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function toast(msg) {
    $("toastText").textContent = msg;
    $("toast").classList.add("show");
    setTimeout(() => $("toast").classList.remove("show"), 2200);
  }

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
    const fmt = (kind) => {
      if (!has) return "";
      if (kind === "md") return "![" + name + "](" + url + ")";
      if (kind === "html") return '<img src="' + url + '" alt="' + name + '" />';
      return url;
    };
    let kind = "url";
    $("modalExtra").querySelectorAll("[data-copy]").forEach((b) => {
      b.addEventListener("click", () => {
        kind = b.dataset.copy;
        $("modalExtra").querySelectorAll("[data-copy]").forEach((x) => x.classList.remove("active"));
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

  async function api(path, body, method) {
    const res = await fetch(path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  function setHealth(text, cls) {
    const el = $("health");
    el.textContent = text;
    el.style.color = cls === "ok" ? "var(--c-success)" : cls === "bad" ? "var(--c-danger)" : "var(--c-text-3)";
  }

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

  function switchView(v) {
    if (v === "doc" && !window.__PICBED_UI_DEV__) {
      v = "upload";
    }
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    ["upload", "manage", "settings", "doc"].forEach((k) => {
      $("view-" + k).style.display = k === v ? "" : "none";
    });
    $("pageTitle").textContent = titles[v][0];
    $("pageCrumb").textContent = titles[v][1];
    if (v === "manage") refreshManage();
    if (v === "settings") loadConfigForm();
  }
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  /* ── Logo 动效（不注入色值） ── */
  const logo = $("logo");
  let upTimer = null;
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
  function filePathOf(f) {
    try {
      if (window.picbedNative && typeof window.picbedNative.getPathForFile === "function") {
        return window.picbedNative.getPathForFile(f) || "";
      }
    } catch (_) { /* browser */ }
    return "";
  }

  async function ingestDrop(dt) {
    const items = [];
    if (dt.items) {
      for (const item of dt.items) {
        if (item.kind !== "file") continue;
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        const f = item.getAsFile && item.getAsFile();
        const abs = f ? filePathOf(f) : "";
        if (entry && entry.isDirectory) {
          items.push({ name: entry.name, rel: entry.name, type: "dir", abs });
        } else if (f) {
          items.push({
            name: f.name,
            rel: f.webkitRelativePath || f.name,
            type: "file",
            abs,
          });
        }
      }
    }
    items.sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1));
    let dropped = 0;
    let err = "";
    for (const it of items) {
      const { data } = await api("/api/session/drop", {
        name: it.name,
        relativePath: it.rel,
        type: it.type,
        absPath: it.abs || undefined,
      });
      if (data.ok) dropped += 1;
      else err = (data.error && data.error.message) || "drop failed";
    }
    return { dropped, err, count: items.length };
  }

  function setPreviewIdle() {
    const g = $("previewGrid");
    const a = $("previewActions");
    if (g) {
      g.hidden = true;
      g.innerHTML = "";
    }
    if (a) a.hidden = true;
    $("dropTitle").textContent = "将文件拖放到此处";
  }

  function setPreviewImages(items) {
    const g = $("previewGrid");
    const a = $("previewActions");
    if (!g || !a) return;
    if (!items || !items.length) {
      g.hidden = true;
      g.innerHTML = "";
      a.hidden = true;
      return;
    }
    g.innerHTML = items
      .map((p) => {
        const src = "/api/preview?path=" + encodeURIComponent(p);
        return '<img alt="" loading="lazy" src="' + src + '" onerror="this.classList.add(\'miss\');this.removeAttribute(\'src\')" />';
      })
      .join("");
    g.hidden = false;
    a.hidden = false;
    $("dropTitle").textContent = "扫描到 " + items.length + " 张图片";
  }

  async function scanIntoPreview() {
    const { data } = await api("/api/plan", {});
    if (!data.ok) {
      toast((data.error && data.error.message) || "扫描失败");
      setPreviewIdle();
      return;
    }
    const plan = (data.data && data.data.plan) || [];
    const paths = [];
    const seen = {};
    for (const p of plan) {
      const lp = p.localPath;
      if (!lp || seen[lp]) continue;
      if (p.action === "blocked" || p.action === "skip-remote") continue;
      seen[lp] = 1;
      paths.push(lp);
    }
    setPreviewImages(paths);
    if (!paths.length) toast("未扫描到本地图片");
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
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("drag");
      logoState("scanning");
      $("dropTitle").textContent = "正在扫描文件…";
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
      if (ev === "dragleave" && !upTimer) {
        logoState(null);
        $("dropTitle").textContent = "将文件拖放到此处";
      }
    })
  );
  dz.addEventListener("drop", async (e) => {
    $("dropTitle").textContent = "正在扫描…";
    const r = await ingestDrop(e.dataTransfer);
    if (r && r.err && !r.dropped) {
      toast(r.err);
      setPreviewIdle();
      return;
    }
    logoState("scanning");
    await scanIntoPreview();
    logoState(null);
  });

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
          const name = String(e.localPath || e.publicUrl || "asset").split(/[\\\\/]/).pop();
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
    $("fileGrid").querySelectorAll(".file-card").forEach((card) => {
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
    await navigator.clipboard.writeText(urls.join("\\n")).catch(() => {});
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
</script>
</body>
</html>
`;
