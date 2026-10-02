import { $ } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { confirmAsync } from "../components/modal.js";

/** 读配置回填表单（token 仅回显遮罩，绝不回显明文）。 */
export async function loadConfigForm() {
  const { data } = await api("/api/config");
  if (!data.ok) return;
  const d = data.data || {};
  const gh = d.github || {};
  const url = d.url || {};
  $("cfgOwner").value = gh.owner || "";
  $("cfgRepo").value = gh.repo || "";
  $("cfgBranch").value = gh.branch || "";
  $("cfgDir").value = gh.dir || "";
  $("cfgDir").title = gh.dir
    ? `当前目录：${gh.dir}（只读显示；点此或「选择目录」按钮浏览仓库）`
    : "未配置；点此或「选择目录」按钮浏览仓库目录";
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

/** 设置页：读/存配置 + PAT + 导入导出。 */
export function initSettings() {
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
}
