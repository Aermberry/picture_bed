import { $ } from "../lib/dom.js";
import { api } from "../lib/api.js";

/** @param {any} text @param {any=} cls */
export function setHealth(text, cls) {
  const el = $("health");
  el.textContent = text;
  el.style.color = cls === "ok" ? "var(--c-success)" : cls === "bad" ? "var(--c-danger)" : "var(--c-text-3)";
}

export async function refreshHealth() {
  const { data } = await api("/api/health");
  if (data.ok) setHealth("本机服务正常 · schema " + data.schemaVersion, "ok");
  else setHealth("服务异常", "bad");
}
