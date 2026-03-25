const CONFIG = {
  // TODO: 把这里替换成你的腾讯表单分享链接
  // 例如：https://wj.qq.com/s2/xxxxxx/xxxx/
  FORM_URL: "https://wj.qq.com/s2/26026404/5c3d/",

  // 静态展示数据（由你手工导出/或 GitHub Actions 同步生成）
  DATA_URL: "./data/submissions.json",
};

const STORAGE_KEY = "contactUnlocked:v1";
const VIEW_COUNTER_KEY = "25coffee-link-homepage";
const VIEW_COUNTER_NS = "25coffee-link";

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

function getItemId(item, index) {
  const base =
    (item.title ?? "") + "|" + (item.nickname ?? "") + "|" + (item.createdAt ?? "") + "|" + index;
  // Simple stable hash (djb2) to keep IDs short.
  let h = 5381;
  for (let i = 0; i < base.length; i += 1) h = (h * 33) ^ base.charCodeAt(i);
  return `i_${(h >>> 0).toString(16)}`;
}

function loadUnlockedSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveUnlockedSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

let pendingReveal = null; // { id, contact }
let unlocked = loadUnlockedSet();
let pickedPayMethod = ""; // "alipay" | "wechat" | ""

function renderCard(item, index) {
  const title = escapeHtml(item.title ?? "");
  const content = escapeHtml(item.content ?? "");
  const nickname = escapeHtml(item.nickname ?? "");
  const contact = escapeHtml(item.contact ?? "");
  const id = getItemId(item, index);
  const isUnlocked = unlocked.has(id);

  return `
    <article class="card">
      <h3 class="card__title">${title || "（无标题）"}</h3>
      <p class="card__content">${content || "（无内容）"}</p>
      <dl class="card__meta">
        <dt>昵称</dt>
        <dd>${nickname || "—"}</dd>
        <dt>联系方式</dt>
        <dd>
          ${
            isUnlocked
              ? `<span data-contact-text>${contact || "—"}</span>`
              : `<span class="contact__hidden" data-contact-masked>已隐藏</span>
                 <button class="contact__btn" type="button" data-reveal data-id="${id}" data-contact="${contact}">
                   解锁联系方式（¥2.99/次）
                 </button>`
          }
        </dd>
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

async function updateViews() {
  const el = document.getElementById("viewText");
  if (!el) return;
  el.textContent = "浏览量：—";
  try {
    const url = `https://api.countapi.xyz/hit/${encodeURIComponent(VIEW_COUNTER_NS)}/${encodeURIComponent(
      VIEW_COUNTER_KEY,
    )}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const v = Number(data?.value);
    if (!Number.isFinite(v)) throw new Error("bad value");
    el.textContent = `浏览量：${v}`;
  } catch {
    // silently keep placeholder
  }
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
    list.innerHTML = items.map((it, idx) => renderCard(it, idx)).join("\n");
  } catch (e) {
    setEmpty(true);
    setMeta({ count: 0, updatedAt: "" });
    setError(e instanceof Error ? e.message : String(e));
  }
}

function openModal() {
  const modal = $("contactModal");
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  // Reset to pay step every time
  $("payStep").hidden = false;
  $("confirmStep").hidden = true;
  const input = $("txInput");
  input.value = "";
  $("txError").hidden = true;
  pickedPayMethod = "";
}

function closeModal() {
  const modal = $("contactModal");
  modal.hidden = true;
  document.body.style.overflow = "";
}

function gotoConfirmStep(payMethod) {
  pickedPayMethod = payMethod || "";
  $("payStep").hidden = true;
  $("confirmStep").hidden = false;
  $("txError").hidden = true;
  const input = $("txInput");
  input.focus();
}

function gotoPayStep() {
  $("payStep").hidden = false;
  $("confirmStep").hidden = true;
  $("txError").hidden = true;
  const input = $("txInput");
  input.value = "";
  pickedPayMethod = "";
}

function validateTxId(txId) {
  return /^\d{28}$/.test(txId);
}

function unlockAndRevealPending() {
  if (!pendingReveal) return;
  unlocked.add(pendingReveal.id);
  saveUnlockedSet(unlocked);

  // Update the specific card in-place
  const btn = document.querySelector(`button[data-reveal][data-id="${pendingReveal.id}"]`);
  if (btn) {
    const dd = btn.closest("dd");
    if (dd) dd.innerHTML = `<span data-contact-text>${pendingReveal.contact || "—"}</span>`;
  }
  pendingReveal = null;
}

function init() {
  $("formLink").href = CONFIG.FORM_URL;
  $("refreshBtn").addEventListener("click", () => refresh());

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const revealBtn = t.closest("button[data-reveal]");
    if (revealBtn) {
      const id = revealBtn.getAttribute("data-id") || "";
      const contact = revealBtn.getAttribute("data-contact") || "";
      pendingReveal = { id, contact };
      openModal();
      return;
    }

    const payBtn = t.closest("button[data-pay]");
    if (payBtn) {
      // Pick a pay method first, then require transaction id confirmation.
      const method = payBtn.getAttribute("data-pay") || "";
      gotoConfirmStep(method);
      return;
    }
  });

  $("txConfirmBtn").addEventListener("click", () => {
    const txId = $("txInput").value.trim();
    if (!validateTxId(txId)) {
      $("txError").hidden = false;
      return;
    }
    // NOTE: 静态站无法真实校验支付，仅做格式校验。
    $("txError").hidden = true;
    closeModal();
    unlockAndRevealPending();
  });

  $("txInput").addEventListener("input", () => {
    $("txError").hidden = true;
  });

  $("txBackBtn").addEventListener("click", () => {
    gotoPayStep();
  });

  updateViews();
  refresh();
}

window.addEventListener("DOMContentLoaded", init);

