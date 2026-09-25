export const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>picbed 本地控制台</title>
  <style>
    :root{
      --c-primary:#4E86AD;
      --c-primary-hover:#3D6F94;
      --c-primary-soft:#EAF2F8;
      --c-accent:#E39A6B;
      --c-success:#4C9A82;
      --c-danger:#C46B5C;
      --c-bg:#F3F7FA;
      --c-surface:#FFFFFF;
      --c-border:#DDE7EF;
      --c-text:#25384A;
      --c-text-2:#64798C;
      --c-text-3:#9AABBC;
      --r-sm:6px; --r-md:10px; --r-lg:16px; --r-full:999px;
      --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px;
      --sp-5:20px; --sp-6:24px; --sp-8:32px;
      --shadow-1:0 1px 3px rgba(0,0,0,.06);
      --shadow-2:0 4px 12px rgba(0,0,0,.08);
      font-family:"PingFang SC","Microsoft YaHei",-apple-system,sans-serif;
    }
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:var(--c-bg); color:var(--c-text);
      font-size:14px; line-height:1.5; min-width:860px;
    }
    .app{display:flex; height:100vh}
    .sidebar{
      width:72px; background:var(--c-surface);
      border-right:1px solid var(--c-border);
      display:flex; flex-direction:column; align-items:center;
      padding:var(--sp-5) 0; gap:var(--sp-2);
    }
    .logo{
      width:44px;height:44px;border-radius:14px;
      margin-bottom:var(--sp-6); position:relative; overflow:hidden;
      cursor:pointer; flex-shrink:0; transition:transform .15s, box-shadow .2s;
      box-shadow:0 2px 6px rgba(34,56,90,.18);
    }
    .logo:hover{transform:scale(1.06)}
    .logo svg{width:100%;height:100%;display:block}
    .logo .g-scan{opacity:0}
    .logo.scanning{animation:ringPulse 1.2s ease-out infinite}
    .logo.scanning .g-scan{opacity:1; animation:scanMove 1.2s ease-in-out infinite}
    @keyframes scanMove{0%,100%{transform:translateY(13px)}50%{transform:translateY(24px)}}
    @keyframes ringPulse{
      0%{box-shadow:0 0 0 0 rgba(78,134,173,.45)}
      100%{box-shadow:0 0 0 12px rgba(78,134,173,0)}
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
      font-size:34px; color:#fff; background:linear-gradient(135deg,#7FA8C9,#4E86AD);
    }
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
      position:fixed; right:24px; bottom:24px;
      background:var(--c-text); color:#fff; padding:12px 18px;
      border-radius:var(--r-md); box-shadow:var(--shadow-2);
      opacity:0; pointer-events:none; transition:opacity .2s, transform .2s;
      transform:translateY(8px); z-index:50;
    }
    .toast.show{opacity:1; transform:translateY(0)}
    .modal{
      position:fixed; inset:0; background:rgba(37,56,74,.35);
      display:none; align-items:center; justify-content:center; z-index:40;
    }
    .modal.show{display:flex}
    .modal .panel{
      background:var(--c-surface); border-radius:var(--r-lg); padding:var(--sp-6);
      width:min(420px,90vw); box-shadow:var(--shadow-2);
    }
    .modal h3{margin-bottom:var(--sp-3)}
    .modal .actions{display:flex; gap:var(--sp-3); justify-content:flex-end; margin-top:var(--sp-5)}
  </style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="i-upload" viewBox="0 0 24 24">
    <rect x="3.5" y="11" width="17" height="9.5" rx="1.5" fill="#fff" stroke="#2E4B7E" stroke-width="2"/>
    <path d="M12 3.2v8.8M8.5 6.7 12 3.2l3.5 3.5" fill="none" stroke="#2E4B7E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="7" y="16.2" width="10" height="2.4" rx="1.2" fill="#B5D8F2"/>
  </symbol>
  <symbol id="i-folder" viewBox="0 0 24 24">
    <path d="M3.5 6.2A1.7 1.7 0 0 1 5.2 4.5h3.9l2.1 2.6h7.6a1.7 1.7 0 0 1 1.7 1.7v9.5a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z" fill="#fff" stroke="#2E4B7E" stroke-width="2" stroke-linejoin="round"/>
    <rect x="6.8" y="13.2" width="7.5" height="2.2" rx="1.1" fill="#B5D8F2"/>
    <rect x="6.8" y="16.4" width="4.5" height="2.2" rx="1.1" fill="#C9CDD4"/>
  </symbol>
  <symbol id="i-gear" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5.4" fill="#fff" stroke="#2E4B7E" stroke-width="2"/>
    <circle cx="12" cy="12" r="1.9" fill="#B5D8F2"/>
    <g stroke="#2E4B7E" stroke-width="2" stroke-linecap="round">
      <path d="M12 2.6v2.8"/><path d="M12 18.6v2.8"/>
      <path d="M2.6 12h2.8"/><path d="M18.6 12h2.8"/>
      <path d="M5.4 5.4l2 2"/><path d="M16.6 16.6l2 2"/>
      <path d="M18.6 5.4l-2 2"/><path d="M7.4 16.6l-2 2"/>
    </g>
  </symbol>
  <symbol id="i-search" viewBox="0 0 24 24">
    <circle cx="10.5" cy="10.5" r="6.4" fill="#fff" stroke="#2E4B7E" stroke-width="2"/>
    <path d="M15.3 15.3l5 5" stroke="#2E4B7E" stroke-width="2" stroke-linecap="round"/>
    <path d="M7.3 9.2a3.6 3.6 0 0 1 2.6-2.4" fill="none" stroke="#B5D8F2" stroke-width="2" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-book" viewBox="0 0 24 24">
    <path d="M4.5 5.2A1.7 1.7 0 0 1 6.2 3.5h5.3a2 2 0 0 1 2 2v14a1.8 1.8 0 0 0-1.8-1.8H6.2A1.7 1.7 0 0 1 4.5 16z" fill="#fff" stroke="#2E4B7E" stroke-width="2" stroke-linejoin="round"/>
    <path d="M19.5 5.2a1.7 1.7 0 0 0-1.7-1.7H12.5a2 2 0 0 0-2 2v14a1.8 1.8 0 0 1 1.8-1.8h5.5a1.7 1.7 0 0 0 1.7-1.7z" fill="#B5D8F2" stroke="#2E4B7E" stroke-width="2" stroke-linejoin="round"/>
    <path d="M8 8.5h4M8 12h3" stroke="#C9CDD4" stroke-width="2" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-image" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="16" rx="2" fill="#fff" stroke="#2E4B7E" stroke-width="2"/>
    <circle cx="15.6" cy="9" r="1.8" fill="#E39A6B"/>
    <path d="M4.8 18.2 9.4 12.2l4 6z" fill="#B5D8F2" stroke="#2E4B7E" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M12.4 18.2l3.2-3.8 3.6 3.8z" fill="#C9CDD4" stroke="#2E4B7E" stroke-width="1.6" stroke-linejoin="round"/>
  </symbol>
</svg>

<div class="app">
  <nav class="sidebar">
    <div class="logo" id="logo" title="点击预览 Logo 动效状态">
      <svg viewBox="0 0 40 40">
        <defs>
          <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4E86AD"/><stop offset="1" stop-color="#4E86AD"/>
          </linearGradient>
          <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#1D9E75"/><stop offset="1" stop-color="#1D9E75"/>
          </linearGradient>
          <linearGradient id="gC" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#BA7517"/><stop offset="1" stop-color="#BA7517"/>
          </linearGradient>
        </defs>
        <rect class="bg" width="40" height="40" rx="13" fill="#4E86AD"/>
        <g class="g-glyph">
          <rect class="ink-f" x="8" y="9" width="13" height="13" rx="2.5" fill="#FFFFFF"/>
          <rect class="accent" x="19" y="18" width="13" height="13" rx="2.5" fill="#85B7EB"/>
          <path class="link" d="M14.6 17.2 23.4 26" stroke="#EF9F27" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        </g>
        <g class="g-scan"><rect x="10" width="20" height="2.8" rx="1.4" fill="#EF9F27"/></g>
        <g class="g-up">
          <path d="M20 30v-9.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M16 24l4-4 4 4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    </div>
    <button class="nav-item active" data-view="upload"><svg class="ico"><use href="#i-upload"/></svg>上传</button>
    <button class="nav-item" data-view="manage"><svg class="ico"><use href="#i-folder"/></svg>管理</button>
    <button class="nav-item" data-view="settings"><svg class="ico"><use href="#i-gear"/></svg>设置</button>
    <button class="nav-item" data-view="doc"><svg class="ico"><use href="#i-book"/></svg>规范</button>
    <div class="spacer"></div>
    <div class="avatar">P</div>
  </nav>

  <main class="main">
    <header class="topbar">
      <h1 id="pageTitle">文件放置</h1>
      <span class="crumb" id="pageCrumb">拖入文件即可上传 · picbed 本地控制台</span>
      <div class="right">
        <span class="hint" id="health">…</span>
      </div>
    </header>

    <!-- 上传 / 文件放置 -->
    <section class="content" id="view-upload">
      <div class="dropzone" id="dropzone">
        <div class="big-ico"><svg><use href="#i-image"/></svg></div>
        <h2 id="dropTitle">将文件拖放到此处</h2>
        <p>拖拽 md / html 文档或文件夹 · 策略 A 强制绑根 · 支持 JPG / PNG / GIF / WebP</p>
        <div class="row" style="justify-content:center">
          <button class="btn btn-primary" id="btnPick" type="button">选择文件</button>
          <button class="btn btn-ghost" id="btnPaste" type="button">粘贴剪贴板</button>
        </div>
        <span class="hint">上传后自动生成外链，可复制 Markdown / HTML / URL；先绑定扫描根再 scan / plan / sync</span>
      </div>

      <div class="card">
        <h3>绑定扫描根（root）</h3>
        <div class="row">
          <input id="root" type="text" placeholder="服务端真实路径，例如 E:/WorkSpace/docs" />
          <button class="btn btn-primary" id="bind" type="button">绑定</button>
        </div>
        <div class="status" id="rootStatus">未绑定根目录时不能 scan / plan / sync</div>
      </div>

      <div class="card">
        <h3>工作集</h3>
        <table>
          <thead><tr><th>名称</th><th>相对路径</th><th>类型</th><th>状态</th></tr></thead>
          <tbody id="workset"></tbody>
        </table>
      </div>

      <div class="card">
        <h3>计划 / 同步</h3>
        <div class="row">
          <button class="btn btn-ghost" id="scan" type="button">scan</button>
          <button class="btn btn-ghost" id="plan" type="button">plan</button>
          <button class="btn btn-ghost" id="syncDry" type="button">sync --dry-run</button>
          <button class="btn btn-primary" id="sync" type="button">确认并 sync</button>
        </div>
        <div class="status" id="opStatus"></div>
        <h3 style="margin-top:16px">计划分组</h3>
        <table>
          <thead><tr><th>action</th><th>raw / local</th><th>doc</th><th>reason</th></tr></thead>
          <tbody id="planBody"></tbody>
        </table>
        <h3 style="margin-top:16px">结果</h3>
        <pre id="result">（尚无）</pre>
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
      <p class="hint" style="margin-bottom:16px">💡 本页可切换左上角 Logo 配色，预览扫描 / 上传动效。</p>
      <h2>🎨 主题配色 ·「晨雾蓝 × 落日暖」</h2>
      <div class="token-row">
        <div class="chip"><span class="dot" style="background:#4E86AD"></span>Primary 丹宁蓝 · #4E86AD</div>
        <div class="chip"><span class="dot" style="background:#3D6F94"></span>Primary-Hover · #3D6F94</div>
        <div class="chip"><span class="dot" style="background:#EAF2F8"></span>Primary-Soft 雾蓝 · #EAF2F8</div>
        <div class="chip"><span class="dot" style="background:#E39A6B"></span>Accent 落日琥珀 · #E39A6B</div>
        <div class="chip"><span class="dot" style="background:#4C9A82"></span>Success 青瓷绿 · #4C9A82</div>
        <div class="chip"><span class="dot" style="background:#C46B5C"></span>Danger 陶土红 · #C46B5C</div>
        <div class="chip"><span class="dot" style="background:#F3F7FA;border:1px solid #DDE7EF"></span>BG 晨雾蓝灰 · #F3F7FA</div>
        <div class="chip"><span class="dot" style="background:#FFFFFF;border:1px solid #DDE7EF"></span>Surface · #FFFFFF</div>
        <div class="chip"><span class="dot" style="background:#DDE7EF"></span>Border · #DDE7EF</div>
        <div class="chip"><span class="dot" style="background:#25384A"></span>Text 藏青 · #25384A</div>
        <div class="chip"><span class="dot" style="background:#64798C"></span>Text-2 灰蓝 · #64798C</div>
        <div class="chip"><span class="dot" style="background:#9AABBC"></span>Text-3 · #9AABBC</div>
      </div>
      <ul class="spec-list">
        <li><b>60-30-10 法则</b>：60% 雾蓝灰底/白面 · 30% 丹宁蓝 · 10% 落日琥珀（点睛，不铺面）</li>
        <li>间距 4 的倍数；圆角 6 / 10 / 16 / 999；阴影 shadow-1 / shadow-2</li>
        <li>H1 16/600 · H2 18/700 · Body 14/400 · Caption 12/400</li>
      </ul>
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
        <li>粗描边双色 · 描边 <code>#2E4B7E</code> · 线宽 2/24 · 点缀 <code>#B5D8F2</code> / <code>#C9CDD4</code> · 点睛 <code>#E39A6B</code></li>
        <li>导航 22px · 行内 16px · 空状态主视觉 52px</li>
      </ul>
      <h2>✨ Logo 与状态动效</h2>
      <ul class="spec-list">
        <li>44×44 squircle · 层叠相片 + 琥珀外链斜线 · 三态 idle / scanning / uploading</li>
        <li style="list-style:none;margin-left:-20px">
          <div class="token-row" style="margin-top:8px">
            <button class="chip chip-btn active" data-var="" type="button">V1 丹宁雾蓝</button>
            <button class="chip chip-btn" data-var="v2" type="button">V2 青瓷绿</button>
            <button class="chip chip-btn" data-var="v3" type="button">V3 落日琥珀</button>
          </div>
          <span class="hint">↑ 点击切换 Logo 配色；点击左上角 Logo 预览动效</span>
        </li>
      </ul>
      <h2>🔗 交互</h2>
      <ul class="spec-list">
        <li>导航切换四视图 · 拖放上传触发 Logo 动效 · 设置保存 Toast · FileCard 复制外链</li>
      </ul>
    </section>
  </main>
</div>

<div class="toast" id="toast"></div>
<div class="modal" id="modal">
  <div class="panel">
    <h3 id="modalTitle">确认</h3>
    <p id="modalBody" class="hint"></p>
    <div class="actions">
      <button class="btn btn-ghost" id="modalCancel" type="button">取消</button>
      <button class="btn btn-primary" id="modalOk" type="button">确认</button>
    </div>
  </div>
</div>

<script>
  const $ = (id) => document.getElementById(id);
  const workset = [];
  let manifestEntries = [];
  let sortDesc = true;

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
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  function confirmAsync(msg) {
    return new Promise((resolve) => {
      $("modalBody").textContent = msg;
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

  /* ── 导航 ── */
  function switchView(v) {
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

  /* ── Logo ── */
  const logo = $("logo");
  let upTimer = null;
  function logoState(s) {
    logo.classList.remove("scanning", "uploading");
    if (s) logo.classList.add(s);
  }
  const VARIANTS = {
    "": { bg: "url(#gA)", ink: "#FFFFFF" },
    v2: { bg: "url(#gB)", ink: "#FFFFFF" },
    v3: { bg: "url(#gC)", ink: "#FFFFFF" },
  };
  function applyVariant(v) {
    const c = VARIANTS[v] || VARIANTS[""];
    logo.classList.remove("v2", "v3");
    if (v) logo.classList.add(v);
    const svg = logo.querySelector("svg");
    svg.querySelector(".bg").setAttribute("fill", c.bg);
    svg.querySelectorAll(".ink-f").forEach((el) => el.setAttribute("fill", c.ink));
    svg.querySelectorAll(".g-up path").forEach((el) => el.setAttribute("stroke", c.ink));
    if (v === "v3") {
      svg.querySelector(".accent").setAttribute("fill", "#FAC775");
      svg.querySelector(".link").setAttribute("stroke", "#854F0B");
      svg.querySelector(".g-scan rect").setAttribute("fill", "#854F0B");
    } else if (v === "v2") {
      svg.querySelector(".accent").setAttribute("fill", "#9FE1CB");
      svg.querySelector(".link").setAttribute("stroke", "#EF9F27");
      svg.querySelector(".g-scan rect").setAttribute("fill", "#EF9F27");
    } else {
      svg.querySelector(".accent").setAttribute("fill", "#85B7EB");
      svg.querySelector(".link").setAttribute("stroke", "#EF9F27");
      svg.querySelector(".g-scan rect").setAttribute("fill", "#EF9F27");
    }
  }
  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyVariant(btn.dataset.var);
    });
  });
  applyVariant("");
  logo.addEventListener("click", () => {
    if (logo.classList.contains("scanning")) {
      logoState("uploading");
      setTimeout(() => logoState(null), 2200);
    } else logoState("scanning");
  });

  /* ── 健康 ── */
  async function refreshHealth() {
    const { data } = await api("/api/health");
    if (data.ok) setHealth("本机服务正常 · schema " + data.schemaVersion, "ok");
    else setHealth("服务异常", "bad");
  }

  /* ── 工作集 / 拖放 ── */
  function renderWorkset() {
    $("workset").innerHTML =
      workset
        .map(
          (w) =>
            "<tr><td>" +
            esc(w.name) +
            "</td><td>" +
            esc(w.rel || "—") +
            '</td><td><span class="tag ' +
            esc(w.type) +
            '">' +
            esc(w.type) +
            "</span></td><td>" +
            esc(w.status) +
            "</td></tr>"
        )
        .join("") || '<tr><td colspan="4" class="muted">空 · 请拖拽文档/文件夹</td></tr>';
  }

  $("bind").onclick = async () => {
    const root = $("root").value.trim();
    if (!root) return;
    const { data } = await api("/api/session/bind-root", { root });
    if (data.ok) {
      $("rootStatus").textContent = "已绑定：" + data.data.root;
      $("rootStatus").className = "status ok";
      toast("根目录已绑定");
    } else {
      $("rootStatus").textContent = data.error?.message || "绑定失败";
      $("rootStatus").className = "status bad";
    }
  };

  const dz = $("dropzone");
  async function ingestDrop(dt) {
    const items = [];
    if (dt.items) {
      for (const item of dt.items) {
        if (item.kind !== "file") continue;
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          items.push({ name: entry.name, rel: entry.name, type: "dir" });
        } else {
          const f = item.getAsFile();
          if (!f) continue;
          items.push({ name: f.name, rel: f.webkitRelativePath || f.name, type: "file" });
        }
      }
    }
    for (const it of items) {
      const { data } = await api("/api/session/drop", {
        name: it.name,
        relativePath: it.rel,
        type: it.type,
      });
      if (data.ok && data.data.boundRoot) {
        $("root").value = data.data.boundRoot;
        $("rootStatus").textContent = "已绑定：" + data.data.boundRoot;
        $("rootStatus").className = "status ok";
      }
      workset.push({
        name: it.name,
        rel: it.rel,
        type: it.type,
        status: data.ok ? data.data.action || "ok" : (data.error?.code || "E") + ": " + (data.error?.message || ""),
      });
    }
    renderWorkset();
    logoState("uploading");
    clearTimeout(upTimer);
    upTimer = setTimeout(() => logoState(null), 2200);
  }

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
    $("dropTitle").textContent = "正在处理…";
    await ingestDrop(e.dataTransfer);
    $("dropTitle").textContent = "已加入工作集";
    setTimeout(() => ($("dropTitle").textContent = "将文件拖放到此处"), 1800);
  });

  $("btnPick").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      const dt = { items: [] };
      // synthesize from FileList via DataTransfer if available
      const files = Array.from(input.files || []);
      for (const f of files) {
        workset.push({
          name: f.name,
          rel: f.webkitRelativePath || f.name,
          type: "file",
          status: "pending-drop",
        });
      }
      if (files.length) {
        // still need server bind; prompt path via root input
        toast("已加入本地列表，请绑定 root 后拖拽或填写路径");
        renderWorkset();
        logoState("uploading");
        setTimeout(() => logoState(null), 2200);
      }
    };
    input.click();
  };
  $("btnPaste").onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        $("root").value = text.trim();
        toast("已粘贴路径，请点击绑定");
      } else toast("剪贴板为空");
    } catch {
      toast("无法读取剪贴板");
    }
  };

  /* ── plan / sync ── */
  function renderPlan(plan) {
    $("planBody").innerHTML =
      (plan || [])
        .map(
          (p) =>
            "<tr><td><span class=\\"tag " +
            esc(p.action) +
            '">' +
            esc(p.action) +
            "</span></td><td>" +
            esc(p.raw || p.localPath || "") +
            "</td><td>" +
            esc(p.doc || "") +
            "</td><td>" +
            esc(p.reason || "") +
            "</td></tr>"
        )
        .join("") || '<tr><td colspan="4" class="muted">无</td></tr>';
  }

  async function runOp(kind, extra) {
    $("opStatus").textContent = "执行中…";
    $("opStatus").className = "status";
    const { status, data } = await api("/api/" + kind, extra || {});
    $("result").textContent = JSON.stringify(data, null, 2);
    if (data.ok) {
      $("opStatus").textContent = kind + " ok";
      $("opStatus").className = "status ok";
      if (data.data?.plan) renderPlan(data.data.plan);
      if (kind === "sync") toast("同步完成");
    } else {
      $("opStatus").textContent = (data.error?.code || "E") + ": " + (data.error?.message || status);
      $("opStatus").className = "status bad";
    }
    return data;
  }

  $("scan").onclick = () => runOp("scan");
  $("plan").onclick = () => runOp("plan");
  $("syncDry").onclick = () => runOp("sync", { confirm: true, dryRun: true });
  $("sync").onclick = async () => {
    if (!(await confirmAsync("将上传图片并改写文档，确认执行 sync？"))) return;
    await runOp("sync", { confirm: true, dryRun: false });
  };

  /* ── 管理 ── */
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
          return (
            '<div class="file-card" data-url="' +
            esc(e.publicUrl || "") +
            '" data-name="' +
            esc(name) +
            '">' +
            '<div class="file-thumb" style="background:linear-gradient(135deg,#7FA8C9,#4E86AD)">' +
            (hasUrl ? '<img src="' + esc(e.publicUrl) + '" alt="" onerror="this.remove()"/>' : "🖼") +
            "</div>" +
            '<div class="file-meta"><div class="name">' +
            esc(name) +
            '</div><div class="row"><span>' +
            esc(String(e.sha256 || "").slice(0, 8) || "—") +
            '</span><span class="tag">' +
            (hasUrl ? "外链中" : "无外链") +
            "</span></div></div></div>"
          );
        })
        .join("") || '<div class="muted">暂无映射文件</div>';
    $("fileGrid").querySelectorAll(".file-card").forEach((card) => {
      card.addEventListener("click", async () => {
        const url = card.dataset.url;
        if (!url) return toast("无外链可复制");
        await navigator.clipboard.writeText(url).catch(() => {});
        toast("已复制外链：" + card.dataset.name);
      });
    });
    const total = items.length;
    $("statTotal").textContent = String(total);
    $("statMapped").textContent = String((list || []).filter((e) => e.publicUrl).length);
    titles.manage[1] = "共 " + total + " 个文件";
    if (!$("view-manage").style.display || $("view-manage").style.display !== "none") {
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
    // month count: entries with updatedAt in current month, else 0
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

  /* ── 设置 ── */
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

  renderWorkset();
  refreshHealth();
</script>
</body>
</html>
`;
