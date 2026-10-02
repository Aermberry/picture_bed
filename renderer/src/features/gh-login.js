import { $ } from "../lib/dom.js";
import { api } from "../lib/api.js";
import { toast } from "../components/toast.js";
import { confirmAsync } from "../components/modal.js";
import { loadConfigForm } from "./settings.js";

let ghLoginPollTimer = null;

/** ── GitHub 一键登录（调用 gh auth login --web）── */
export function initGhLogin() {
  const ghLoginBtn = $("cfgGhLogin");
  const ghLoginLog = $("ghLoginLog");
  const ghLoginHint = $("ghLoginHint");
  const ghLoginBtnLabel = ghLoginBtn ? ghLoginBtn.querySelector("span") : null;

  /** @param {string} text */
  function setGhLoginBtnLabel(text) {
    if (ghLoginBtnLabel) ghLoginBtnLabel.textContent = text;
    else if (ghLoginBtn) ghLoginBtn.textContent = text;
  }

  /** @param {string} text @param {string} kind - "" | "success" | "error" */
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

    // 仅 POST：服务端 /api/auth/gh-login/start 不收 GET（否则 404 no route）
    const { status, data } = await api("/api/auth/gh-login/start", {}, "POST");
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
}
