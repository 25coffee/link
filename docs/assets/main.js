const CONFIG = {
  // TODO: 把这里替换成你的腾讯表单分享链接
  // 例如：https://wj.qq.com/s2/xxxxxx/xxxx/
  FORM_URL: "https://wj.qq.com/s2/26026404/5c3d/",

  // 静态展示数据（由你手工导出/或 GitHub Actions 同步生成）
  DATA_URL: "./data/submissions.json",
};

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function renderCard(item) {
  const title = escapeHtml(item.title ?? "");
  const content = escapeHtml(item.content ?? "");
  const nickname = escapeHtml(item.nickname ?? "");
  const contact = escapeHtml(item.contact ?? "");

  return `
    <article class="card">
      <h3 class="card__title">${title || "（无标题）"}</h3>
      <p class="card__content">${content || "（无内容）"}</p>
      <dl class="card__meta">
        <dt>昵称</dt>
        <dd>${nickname || "—"}</dd>
        <dt>联系方式</dt>
        <dd>${contact || "—"}</dd>
      </dl>
    </article>
  `.trim();
}

async function loadData() {
  // 加 cache-bust，避免 GitHub Pages / 浏览器缓存不刷新
  const url = `${CONFIG.DATA_URL}?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`拉取数据失败：HTTP ${res.status}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.items)) {
    throw new Error("数据格式不正确：需要 { items: [...] }");
  }
  return json;
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    return tb - ta;
  });
}

function setError(msg) {
  const box = $("errorBox");
  if (!msg) {
    box.hidden = true;
    box.textContent = "";
    return;
  }
  box.hidden = false;
  box.textContent = msg;
}

function setEmpty(isEmpty) {
  $("emptyState").hidden = !isEmpty;
}

function setMeta({ count, updatedAt }) {
  $("countText").textContent = `共 ${count} 条`;
  $("updatedText").textContent = updatedAt ? `更新于 ${fmtTime(updatedAt)}` : "";
}

async function refresh() {
  setError("");
  try {
    const data = await loadData();
    const items = sortItems(data.items);
    setMeta({ count: items.length, updatedAt: data.updatedAt });

    const list = $("list");
    if (!items.length) {
      list.innerHTML = "";
      setEmpty(true);
      return;
    }

    setEmpty(false);
    list.innerHTML = items.map(renderCard).join("\n");
  } catch (e) {
    setEmpty(true);
    setMeta({ count: 0, updatedAt: "" });
    setError(e instanceof Error ? e.message : String(e));
  }
}

function init() {
  $("formLink").href = CONFIG.FORM_URL;
  $("refreshBtn").addEventListener("click", () => refresh());
  refresh();
}

window.addEventListener("DOMContentLoaded", init);

