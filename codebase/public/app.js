const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let catalog = [];
let user = null;
let authMode = "login";
let token = localStorage.getItem("vshare_token") || "";

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra.");
  return data;
}

function setTab(id) {
  document.querySelectorAll(".tab,.panel").forEach((item) => item.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${id}"]`)?.classList.add("active");
  $(`#${id}`)?.classList.add("active");
  if (id === "my-docs") loadMyDocuments();
}
document.querySelectorAll(".tab").forEach((tab) => tab.onclick = () => {
  if (tab.classList.contains("protected") && !user) return openAuth("login");
  setTab(tab.dataset.tab);
});

function updateAuthUi() {
  $("#guest-actions").classList.toggle("hidden", Boolean(user));
  $("#user-actions").classList.toggle("hidden", !user);
  $(".protected").forEach?.(() => {});
  if (user) $("#user-name").textContent = user.displayName;
}

function card(doc, extra = "", own = false) {
  const file = doc.fileUrl ? `<a class="download" href="/api/documents/${encodeURIComponent(doc.id)}/download" target="_blank">Mở / tải tệp</a>` : "";
  const ownership = doc.ownerName ? `Đăng bởi ${esc(doc.ownerName)}` : "Cộng đồng VShare";
  const toggle = own ? `<button class="outline visibility" data-visibility="${esc(doc.id)}" data-enabled="${doc.available}">${doc.available ? "Ẩn tài liệu" : "Hiện tài liệu"}</button>` : "";
  return `<article class="post-card ${doc.available ? "" : "muted"}"><h3>${esc(doc.title)}</h3><p class="meta">${ownership} · ${esc(doc.date || "")} · ${esc(doc.level || "all")}</p><p>${esc(doc.summary)}</p>${extra}<div class="tags">${(doc.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div><div class="card-actions"><button data-id="${esc(doc.id)}">Chi tiết</button>${file}${toggle}</div></article>`;
}

function bindDetails(scope = document) {
  scope.querySelectorAll("[data-id]").forEach((button) => button.onclick = () => openDoc(button.dataset.id));
  scope.querySelectorAll("[data-visibility]").forEach((button) => button.onclick = async () => {
    await api(`/api/documents/${button.dataset.visibility}/visibility`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: button.dataset.enabled !== "true" }) });
    await Promise.all([loadCatalog(), loadMyDocuments()]);
  });
}

function renderFeed() {
  const term = $("#feed-search").value.trim().toLowerCase();
  const category = $("#category-filter").value;
  const filtered = catalog.filter((doc) => (!term || `${doc.title} ${doc.summary} ${(doc.tags || []).join(" ")}`.toLowerCase().includes(term)) && (category === "Tất cả" || doc.category === category));
  $("#feed-count").textContent = `${filtered.length} tài liệu thật`;
  $("#feed-list").innerHTML = filtered.map((doc) => card(doc)).join("") || '<div class="notice">Chưa có tài liệu phù hợp.</div>';
  bindDetails($("#feed-list"));
}
$("#feed-search").oninput = renderFeed;
$("#category-filter").onchange = renderFeed;

async function loadCatalog() {
  catalog = (await api("/api/catalog")).items;
  renderFeed();
}

async function loadContributors() {
  try {
    const contributors = (await api("/api/contributors?limit=5")).items;
    $("#contributors-list").innerHTML = contributors.map((person, index) => {
      const initial = esc(person.displayName.trim().charAt(0).toUpperCase());
      const medal = ["🥇", "🥈", "🥉"][index] || `#${index + 1}`;
      return `<article class="contributor-card">
        <span class="rank">${medal}</span>
        <span class="avatar">${initial}</span>
        <span class="contributor-info"><strong>${esc(person.displayName)}</strong><small>${esc(person.bio || (person.role === "admin" ? "Quản trị viên VShare" : "Thành viên VShare"))}</small></span>
        <span class="post-count"><strong>${person.postCount}</strong><small>bài đăng</small></span>
      </article>`;
    }).join("") || '<p class="caption">Chưa có người dùng đăng bài.</p>';
  } catch (error) {
    $("#contributors-list").innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
}

$("#search-form").onsubmit = async (event) => {
  event.preventDefault();
  $("#status").innerHTML = '<p class="loading">Đang tìm và kiểm tra nguồn…</p>';
  $("#results").innerHTML = "";
  try {
    const data = await api("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: $("#query").value }) });
    if (data.status !== "results") {
      $("#status").innerHTML = `<div class="notice">${esc(data.clarifyingQuestion || data.message || "Chưa tìm thấy tài liệu phù hợp.")}</div>`;
      return;
    }
    $("#status").innerHTML = `<p class="caption">Tìm thấy ${data.results.length} gợi ý · ${esc(data.mode)}</p>`;
    $("#results").innerHTML = data.results.map((item) => card(item.document, `<p><strong>Vì sao phù hợp:</strong> ${esc(item.reason)}</p>`)).join("");
    bindDetails($("#results"));
  } catch (error) {
    $("#status").innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
};

$("#create-form").onsubmit = async (event) => {
  event.preventDefault();
  $("#create-status").innerHTML = '<p class="loading">Đang tải tài liệu lên…</p>';
  try {
    const data = await api("/api/documents", { method: "POST", body: new FormData(event.currentTarget) });
    $("#create-status").innerHTML = `<div class="success">Đã đăng “${esc(data.document.title)}”.</div>`;
    event.currentTarget.reset();
    await loadCatalog();
  } catch (error) {
    $("#create-status").innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
};

async function loadMyDocuments() {
  if (!user) return;
  try {
    const data = await api("/api/my/documents");
    $("#my-list").innerHTML = data.items.map((doc) => card(doc, "", true)).join("") || '<div class="notice">Bạn chưa đăng tài liệu nào.</div>';
    bindDetails($("#my-list"));
  } catch (error) {
    $("#my-list").innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
}

function openAuth(mode) {
  authMode = mode;
  $("#auth-title").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  $("#auth-submit").textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  $("#name-field").classList.toggle("hidden", mode === "login");
  $("#auth-status").innerHTML = "";
  $("#auth-dialog").showModal();
}
document.querySelectorAll("[data-auth]").forEach((button) => button.onclick = () => openAuth(button.dataset.auth));
$("[data-close]").onclick = () => $("#auth-dialog").close();

$("#auth-form").onsubmit = async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const data = await api(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    token = data.token; user = data.user; localStorage.setItem("vshare_token", token);
    updateAuthUi(); $("#auth-dialog").close(); event.currentTarget.reset();
  } catch (error) {
    $("#auth-status").innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
};

$("#logout").onclick = async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  token = ""; user = null; localStorage.removeItem("vshare_token"); updateAuthUi(); setTab("feed");
};

async function openDoc(id) {
  try {
    const doc = (await api(`/api/documents/${encodeURIComponent(id)}`)).document;
    $("#detail-body").innerHTML = `<p class="meta">${esc(doc.ownerName || doc.source)} · ${esc(doc.level)}</p><h2>${esc(doc.title)}</h2><p>${esc(doc.summary)}</p><p><strong>Tệp:</strong> ${esc(doc.fileName || "Chưa có")}</p>${doc.fileUrl ? `<a class="primary inline" target="_blank" href="/api/documents/${encodeURIComponent(doc.id)}/download">Mở tài liệu</a>` : ""}`;
    $("#detail").showModal();
  } catch (error) { alert(error.message); }
}
$("[data-detail-close]").onclick = () => $("#detail").close();

if (token) {
  try { user = (await api("/api/auth/me")).user; } catch { token = ""; localStorage.removeItem("vshare_token"); }
}
updateAuthUi();
await Promise.all([loadCatalog(), loadContributors()]);
