export const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>picbed 本地控制台</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a222c;
      --ink: #e7eef7;
      --muted: #8b9bab;
      --accent: #f0a500;
      --ok: #3ecf8e;
      --bad: #f07178;
      --warn: #e6c07b;
      --line: #2a3542;
      --radius: 12px;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid var(--line);
    }
    header h1 { font-size: 18px; margin: 0; font-weight: 600; }
    header .sub { color: var(--muted); font-size: 12px; margin-top: 4px; }
    main {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 20px 24px 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
    }
    section.full { grid-column: 1 / -1; }
    h2 { font-size: 14px; margin: 0 0 12px; letter-spacing: 0.02em; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    input[type="text"] {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--line);
      color: var(--ink);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
    }
    .row { display: flex; gap: 8px; margin-bottom: 12px; }
    .row input { flex: 1; }
    button {
      background: var(--accent);
      color: #1a1200;
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    button.secondary {
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--line);
    }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    #drop {
      border: 1.5px dashed var(--line);
      border-radius: var(--radius);
      padding: 28px 16px;
      text-align: center;
      color: var(--muted);
      margin-bottom: 12px;
      transition: border-color 0.15s, background 0.15s;
    }
    #drop.over {
      border-color: var(--accent);
      background: rgba(240, 165, 0, 0.08);
      color: var(--ink);
    }
    .status { font-size: 12px; color: var(--muted); margin-top: 8px; }
    .status.ok { color: var(--ok); }
    .status.bad { color: var(--bad); }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      word-break: break-all;
    }
    th { color: var(--muted); font-weight: 500; }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
    }
    .tag.upload { background: rgba(240,165,0,.15); color: var(--accent); }
    .tag.skip-cache { background: rgba(62,207,142,.12); color: var(--ok); }
    .tag.skip-remote { background: rgba(139,155,171,.15); color: var(--muted); }
    .tag.blocked { background: rgba(240,113,120,.12); color: var(--bad); }
    .tag.file, .tag.dir { background: rgba(139,155,171,.15); color: var(--muted); }
    .muted { color: var(--muted); }
    pre {
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      overflow: auto;
      max-height: 240px;
      font-size: 11px;
    }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>picbed 本地控制台</h1>
      <div class="sub">拖拽文档/目录 · 策略 A 强制绑根 · token 不进浏览器</div>
    </div>
    <div class="status" id="health">…</div>
  </header>
  <main>
    <section>
      <h2>1. 绑定扫描根（root）</h2>
      <label for="root">服务端真实路径（拖入文件夹或手动填写）</label>
      <div class="row">
        <input id="root" type="text" placeholder="例如 E:/WorkSpace/docs" />
        <button id="bind">绑定</button>
      </div>
      <div class="status" id="rootStatus">未绑定根目录时不能 scan / plan / sync</div>
    </section>

    <section>
      <h2>2. 拖拽工作集</h2>
      <div id="drop">将 <strong>md / html 文档</strong> 或 <strong>文件夹</strong> 拖到此处<br/><span class="muted">文档将在已绑定 root 下按相对路径解析</span></div>
      <table>
        <thead><tr><th>名称</th><th>相对路径</th><th>类型</th><th>状态</th></tr></thead>
        <tbody id="workset"></tbody>
      </table>
    </section>

    <section class="full">
      <h2>3. 计划 / 同步</h2>
      <div class="actions">
        <button class="secondary" id="scan">scan</button>
        <button class="secondary" id="plan">plan</button>
        <button id="syncDry">sync --dry-run</button>
        <button id="sync">确认并 sync</button>
      </div>
      <div class="status" id="opStatus"></div>
      <h2 style="margin-top:16px">计划分组</h2>
      <table>
        <thead><tr><th>action</th><th>raw / local</th><th>doc</th><th>reason</th></tr></thead>
        <tbody id="planBody"></tbody>
      </table>
      <h2 style="margin-top:16px">结果</h2>
      <pre id="result">（尚无）</pre>
    </section>

    <section>
      <h2>4. 回滚（F19）</h2>
      <div class="actions">
        <button class="secondary" id="loadManifest">查看 manifest</button>
        <button class="secondary" id="revertDry">revert --dry-run</button>
        <button id="revert">确认并 revert</button>
      </div>
      <pre id="revertOut">（尚无）</pre>
    </section>

    <section>
      <h2>5. 配置 / doctor（F20）</h2>
      <div class="row">
        <input id="cfgKey" type="text" placeholder="如 github.owner 或 url.style" />
        <input id="cfgVal" type="text" placeholder="值" />
      </div>
      <div class="actions">
        <button class="secondary" id="cfgGet">读配置</button>
        <button id="cfgSet">写配置（确认）</button>
        <button class="secondary" id="doctor">doctor</button>
      </div>
      <pre id="cfgOut">（尚无）</pre>
    </section>

    <section>
      <h2>6. 审计 run（F21）</h2>
      <div class="actions"><button class="secondary" id="runs">刷新 runs</button></div>
      <pre id="runsOut">（尚无）</pre>
    </section>

    <section>
      <h2>7. watch（F22）</h2>
      <div class="actions">
        <button class="secondary" id="watchPreview">启动 preview</button>
        <button class="secondary" id="watchConfirm">启动 confirm-each</button>
        <button class="secondary" id="watchStop">停止</button>
      </div>
      <pre id="watchOut">（未启动）</pre>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const workset = [];

    async function api(path, body) {
      const res = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    function setHealth(text, cls) {
      const el = $('health');
      el.textContent = text;
      el.className = 'status' + (cls ? ' ' + cls : '');
    }

    function renderWorkset() {
      const tb = $('workset');
      tb.innerHTML = workset.map((w) =>
        '<tr><td>' + esc(w.name) + '</td><td>' + esc(w.rel || '—') + '</td><td><span class="tag ' + w.type + '">' + w.type + '</span></td><td>' + esc(w.status) + '</td></tr>'
      ).join('') || '<tr><td colspan="4" class="muted">空</td></tr>';
    }

    function esc(s) {
      return String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    async function refreshHealth() {
      const { data } = await api('/api/health');
      if (data.ok) setHealth('本机服务正常 · schema ' + data.schemaVersion, 'ok');
      else setHealth('服务异常', 'bad');
    }

    $('bind').onclick = async () => {
      const root = $('root').value.trim();
      if (!root) return;
      const { data } = await api('/api/session/bind-root', { root });
      if (data.ok) {
        $('rootStatus').textContent = '已绑定：' + data.data.root;
        $('rootStatus').className = 'status ok';
      } else {
        $('rootStatus').textContent = data.error?.message || '绑定失败';
        $('rootStatus').className = 'status bad';
      }
    };

    const drop = $('drop');
    ['dragenter','dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    }));
    ['dragleave','drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('over');
    }));
    drop.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const items = [];
      if (dt.items) {
        for (const item of dt.items) {
          if (item.kind !== 'file') continue;
          const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
          if (entry && entry.isDirectory) {
            items.push({ name: entry.name, rel: entry.name, type: 'dir' });
          } else {
            const f = item.getAsFile();
            if (!f) continue;
            items.push({ name: f.name, rel: f.webkitRelativePath || f.name, type: 'file' });
          }
        }
      }
      for (const it of items) {
        const { data } = await api('/api/session/drop', {
          name: it.name,
          relativePath: it.rel,
          type: it.type,
        });
        if (data.ok && data.data.boundRoot) {
          $('root').value = data.data.boundRoot;
          $('rootStatus').textContent = '已绑定：' + data.data.boundRoot;
          $('rootStatus').className = 'status ok';
        }
        workset.push({
          name: it.name,
          rel: it.rel,
          type: it.type,
          status: data.ok ? (data.data.action || 'ok') : (data.error?.code + ': ' + data.error?.message),
        });
      }
      renderWorkset();
    });

    async function runOp(kind, extra) {
      $('opStatus').textContent = '执行中…';
      $('opStatus').className = 'status';
      const { status, data } = await api('/api/' + kind, extra || {});
      $('result').textContent = JSON.stringify(data, null, 2);
      if (data.ok) {
        $('opStatus').textContent = kind + ' ok';
        $('opStatus').className = 'status ok';
        if (data.data?.plan) renderPlan(data.data.plan);
      } else {
        $('opStatus').textContent = (data.error?.code || 'E') + ': ' + (data.error?.message || status);
        $('opStatus').className = 'status bad';
      }
      return data;
    }

    function renderPlan(plan) {
      const tb = $('planBody');
      tb.innerHTML = (plan || []).map((p) =>
        '<tr><td><span class="tag ' + esc(p.action) + '">' + esc(p.action) + '</span></td><td>' + esc(p.raw || p.localPath || '') + '</td><td>' + esc(p.doc || '') + '</td><td>' + esc(p.reason || '') + '</td></tr>'
      ).join('') || '<tr><td colspan="4" class="muted">无</td></tr>';
    }

    $('scan').onclick = () => runOp('scan');
    $('plan').onclick = () => runOp('plan');
    $('syncDry').onclick = () => runOp('sync', { confirm: true, dryRun: true });
    $('sync').onclick = async () => {
      if (!confirm('将上传图片并改写文档，确认执行 sync？')) return;
      await runOp('sync', { confirm: true, dryRun: false });
    };

    $('loadManifest').onclick = async () => {
      const { data } = await api('/api/manifest');
      $('revertOut').textContent = JSON.stringify(data, null, 2);
    };
    $('revertDry').onclick = async () => {
      const { data } = await api('/api/revert', { dryRun: true, confirm: true });
      $('revertOut').textContent = JSON.stringify(data, null, 2);
    };
    $('revert').onclick = async () => {
      if (!confirm('将把文档中的图床 URL 还原为本地路径，确认 revert？')) return;
      const { data } = await api('/api/revert', { confirm: true, dryRun: false });
      $('revertOut').textContent = JSON.stringify(data, null, 2);
    };

    $('cfgGet').onclick = async () => {
      const { data } = await api('/api/config');
      $('cfgOut').textContent = JSON.stringify(data, null, 2);
    };
    $('cfgSet').onclick = async () => {
      if (!confirm('将写入配置文件，确认？')) return;
      const { data } = await api('/api/config', {
        key: $('cfgKey').value.trim(),
        value: $('cfgVal').value.trim(),
        confirm: true,
      });
      $('cfgOut').textContent = JSON.stringify(data, null, 2);
    };
    $('doctor').onclick = async () => {
      const { data } = await api('/api/doctor', {});
      $('cfgOut').textContent = JSON.stringify(data, null, 2);
    };

    $('runs').onclick = async () => {
      const { data } = await api('/api/runs');
      $('runsOut').textContent = JSON.stringify(data, null, 2);
    };

    async function watchStart(mode, confirmAuto) {
      const { data } = await api('/api/watch/start', { mode, confirm: confirmAuto });
      $('watchOut').textContent = JSON.stringify(data, null, 2);
    }
    $('watchPreview').onclick = () => watchStart('preview', false);
    $('watchConfirm').onclick = () => watchStart('confirm-each', false);
    $('watchStop').onclick = async () => {
      const { data } = await api('/api/watch/stop', {});
      $('watchOut').textContent = JSON.stringify(data, null, 2);
    };

    refreshHealth();
    renderWorkset();
  </script>
</body>
</html>
`;
