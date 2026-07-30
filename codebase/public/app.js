const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let catalog = [];
let user = null;
let authMode = "login";
let token = localStorage.getItem("vshare_token") || "";
let activeDocument = null;
let thinkingTimer = null;
let currentThinkingSteps = [];
let activeAgentTurnId = 0;
let agentPendingQuery = "";

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
  const file = (doc.fileUrl || doc.hasContent) ? `<button class="download" data-read="${esc(doc.id)}">Đọc tài liệu</button>` : "";
  const ownership = doc.ownerName ? `Đăng bởi ${esc(doc.ownerName)}` : "Cộng đồng VShare";
  const toggle = own ? `<button class="outline visibility" data-visibility="${esc(doc.id)}" data-enabled="${doc.available}">${doc.available ? "Ẩn tài liệu" : "Hiện tài liệu"}</button>` : "";
  return `<article class="post-card ${doc.available ? "" : "muted"}"><h3>${esc(doc.title)}</h3><p class="meta">${ownership} · ${esc(doc.date || "")} · ${esc(doc.level || "all")}</p><p>${esc(doc.summary)}</p>${extra}<div class="tags">${(doc.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div><div class="card-actions"><button data-id="${esc(doc.id)}">Chi tiết</button>${file}${toggle}</div></article>`;
}

function bindDetails(scope = document) {
  scope.querySelectorAll("[data-id]").forEach((button) => button.onclick = () => openDoc(button.dataset.id));
  scope.querySelectorAll("[data-read]").forEach((button) => button.onclick = () => openReader(button.dataset.read));
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
      const medal = [`#1`, `#2`, `#3`][index] || `#${index + 1}`;
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

function resetAgentConversation(message = "Agent chỉ dùng nguồn trong kho VShare.") {
  stopAgentThinking();
  currentThinkingSteps = [];
  activeAgentTurnId = 0;
  $("#agent-results").innerHTML = "";
  $("#agent-query").value = "";
  $("#agent-status").innerHTML = `<p class="caption">${esc(message)}</p>`;
}
function renderAgentContext() {
  const box = $("#agent-context");
  const input = $("#agent-query");
  if (!activeDocument) {
    box.classList.add("hidden");
    $("#agent-quick-actions").classList.add("hidden");
    box.innerHTML = "";
    input.placeholder = "Hỏi về tài liệu, tóm tắt, hoặc gợi ý lộ trình...";
    return;
  }
  box.classList.remove("hidden");
  $("#agent-quick-actions").classList.remove("hidden");
  box.innerHTML = `<span>Đang hỏi: <strong>${esc(activeDocument.title)}</strong></span><button type="button" id="clear-agent-context">Bỏ context</button>`;
  input.placeholder = "Hỏi về tài liệu đang mở...";
  $("#clear-agent-context").onclick = () => { activeDocument = null; resetAgentConversation(); renderAgentContext(); };
}

function fileKind(doc) {
  const name = String(doc.fileName || doc.fileUrl || "").toLowerCase();
  const mime = String(doc.mimeType || "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || /\.(png|jpe?g)$/i.test(name)) return "image";
  if (mime.startsWith("text/") || name.endsWith(".txt")) return "text";
  return "download";
}

async function openReader(id) {
  const doc = (await api(`/api/documents/${encodeURIComponent(id)}`)).document;
  if ($("#detail")?.open) $("#detail").close();
  const switchingDocument = activeDocument?.id && activeDocument.id !== doc.id;
  activeDocument = doc;
  if (switchingDocument) resetAgentConversation(`Đã chuyển sang tài liệu "${doc.title}". Chat của tài liệu trước đã được xóa để tránh nhầm context.`);
  renderAgentContext();
  setTab("reader");
  const downloadUrl = `/api/documents/${encodeURIComponent(doc.id)}/download`;
  const kind = fileKind(doc);
  let viewer = `<div class="notice">Tài liệu này không có file preview gốc. Nội dung trích xuất chỉ được dùng khi bạn hỏi AI Agent.</div>`;
  if (kind === "pdf" || kind === "text") viewer = `<iframe class="reader-frame" src="${downloadUrl}" title="${esc(doc.title)}"></iframe>`;
  if (kind === "image") viewer = `<div class="reader-media"><img src="${downloadUrl}" alt="${esc(doc.title)}"></div>`;
  if (kind === "download" && doc.fileUrl) viewer = `<div class="notice">Không thể xem trước định dạng này trong trình đọc. <a class="download" href="${downloadUrl}">Tải tệp gốc</a></div>`;
  $("#reader-body").innerHTML = `<article class="reader-head"><p class="meta">${esc(doc.ownerName || doc.source)} · ${esc(doc.level || "all")}</p><h2>${esc(doc.title)}</h2><p>${esc(doc.summary)}</p><div class="reader-actions"><button class="primary" type="button" data-agent-prompt="Tóm tắt tài liệu này">Tóm tắt bằng AI</button><button class="outline" type="button" data-agent-prompt="Tạo câu hỏi ôn tập từ tài liệu này">Tạo câu hỏi ôn tập</button></div></article>${viewer}`;
  bindAgentPrompts($("#reader-body"));
}

function scrollAgentResults() {
  const results = $("#agent-results");
  results.scrollTop = results.scrollHeight;
}

function renderAgentMessage(data) {
  const title = data.status === "summary" ? "Tóm tắt" : "Trả lời";
  const sources = (data.sources || []).map((source) => `<span class="tag">${esc(source.title || source.documentId)}</span>`).join("");
  return `<article class="agent-final ai-answer"><h3>${title}</h3><p>${esc(data.message).replace(/\n/g, "<br>")}</p>${sources ? `<div class="tags"><strong>Nguồn:</strong> ${sources}</div>` : ""}</article>`;
}

function openAgent() {
  $("#agent-panel").classList.remove("hidden");
  $("#agent-fab").classList.add("active");
  setTimeout(() => $("#agent-query").focus(), 0);
}

function closeAgent() {
  $("#agent-panel").classList.add("hidden");
  $("#agent-fab").classList.remove("active");
}


function stopAgentThinking() {
  if (thinkingTimer) clearInterval(thinkingTimer);
  thinkingTimer = null;
}

function formatAgentStep(step) {
  if (typeof step === "string") return step;
  const label = step.label ? `${step.label}: ` : "";
  return `${label}${step.detail || step.kind || "Đã xử lý một bước."}`;
}

function renderAgentSteps(steps, activeStep, state = "running", caption = "", targetSelector = "#agent-status") {
  const normalizedSteps = (steps || []).map(formatAgentStep);
  const title = state === "done" ? "Observation · hoàn tất" : state === "error" ? "Observation · lỗi" : "Observation · Agent đang làm";
  const items = normalizedSteps.map((step, index) => {
    const cls = state === "done" || index < activeStep ? "done" : index === activeStep ? "active" : "";
    return `<li class="${cls}">${esc(step)}</li>`;
  }).join("");
  const extra = caption ? `<p>${esc(caption)}</p>` : "";
  const target = $(targetSelector);
  if (target) target.innerHTML = `<div class="agent-observations ${state}"><span>${title}</span><ol>${items}</ol>${extra}</div>`;
  scrollAgentResults();
}

function startAgentThinking(query, targetSelector = "#agent-status") {
  stopAgentThinking();
  currentThinkingSteps = activeDocument
    ? [
        `Nhận câu hỏi về tài liệu "${activeDocument.title}"`,
        "Kiểm tra câu hỏi có đủ rõ để đọc tài liệu hay không",
        "Chuẩn bị gọi tool nếu cần bằng chứng từ tài liệu",
      ]
    : [
        "Nhận câu hỏi của bạn",
        "Kiểm tra câu hỏi có phải nhu cầu tìm tài liệu rõ ràng hay không",
        "Chuẩn bị gọi tool tìm kiếm nếu intent đủ rõ",
      ];
  let activeStep = 0;
  renderAgentSteps(currentThinkingSteps, activeStep, "running", "", targetSelector);
  thinkingTimer = setInterval(() => {
    activeStep = Math.min(activeStep + 1, currentThinkingSteps.length - 1);
    renderAgentSteps(currentThinkingSteps, activeStep, "running", "", targetSelector);
  }, 900);
}
function renderAgentResult(data) {
  if (["summary", "answer"].includes(data.status)) {
    return renderAgentMessage(data) + (data.results || []).map((item) => card(item.document, `<p><strong>Vì sao phù hợp:</strong> ${esc(item.reason)}</p>`)).join("");
  }
  if (data.status !== "results") {
    return `<div class="notice">${esc(data.clarifyingQuestion || data.message || "Chưa tìm thấy tài liệu phù hợp.")}</div>`;
  }
  return data.results.map((item) => card(item.document, `<p><strong>Vì sao phù hợp:</strong> ${esc(item.reason)}</p>`)).join("");
}

function bindAgentPrompts(scope = document) {
  scope.querySelectorAll("[data-agent-prompt]").forEach((button) => button.onclick = () => {
    $("#agent-query").value = button.dataset.agentPrompt;
    openAgent();
    $("#agent-form").requestSubmit();
  });
}

$("#agent-fab").onclick = () => $("#agent-panel").classList.contains("hidden") ? openAgent() : closeAgent();
$("#agent-close").onclick = closeAgent;
$("#reader-back").onclick = () => { activeDocument = null; resetAgentConversation(); renderAgentContext(); setTab("feed"); };
bindAgentPrompts();

$("#agent-form").onsubmit = async (event) => {
  event.preventDefault();
  const input = $("#agent-query");
  const query = input.value.trim();
  if (!query) return;
  const effectiveQuery = agentPendingQuery ? `${agentPendingQuery}. ${query}` : query;
  const turnId = ++activeAgentTurnId;
  const turnSelector = `#agent-turn-${turnId}`;
  $("#agent-results").insertAdjacentHTML("beforeend", `<section id="agent-turn-${turnId}" class="agent-turn"><div class="agent-user">${esc(query)}</div><div class="agent-turn-observations"></div><div class="agent-turn-answer"></div></section>`);
  $("#agent-status").innerHTML = `<p class="caption">Agent chỉ dùng nguồn trong kho VShare. Bạn có thể hỏi tiếp ngay trong khung này.</p>`;
  input.value = "";
  startAgentThinking(effectiveQuery, `${turnSelector} .agent-turn-observations`);
  try {
    const body = activeDocument ? { query: effectiveQuery, documentId: activeDocument.id } : { query: effectiveQuery };
    const data = await api("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    agentPendingQuery = data.status === "clarify" ? effectiveQuery : "";
    stopAgentThinking();
    const count = data.status === "results" ? ` · ${data.results.length} gợi ý` : "";
    const finalSteps = Array.isArray(data.steps) && data.steps.length ? data.steps : currentThinkingSteps;
    renderAgentSteps(finalSteps, finalSteps.length, "done", `${data.mode} · dựa trên nguồn trong VShare${count}`, `${turnSelector} .agent-turn-observations`);
    $(`${turnSelector} .agent-turn-answer`).innerHTML = renderAgentResult(data);
    bindDetails($(turnSelector));
    scrollAgentResults();
  } catch (error) {
    stopAgentThinking();
    renderAgentSteps(currentThinkingSteps, currentThinkingSteps.length, "error", error.message, `${turnSelector} .agent-turn-observations`);
    $(`${turnSelector} .agent-turn-answer`).innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
    scrollAgentResults();
  }
};

$("#create-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  $("#create-status").innerHTML = '<p class="loading">Đang tải tài liệu lên...</p>';
  try {
    const data = await api("/api/documents", { method: "POST", body: new FormData(form) });
    $("#create-status").innerHTML = `<div class="success">Đã đăng "${esc(data.document.title)}".</div>`;
    form.reset();
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
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try {
    const data = await api(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    token = data.token; user = data.user; localStorage.setItem("vshare_token", token);
    updateAuthUi(); $("#auth-dialog").close(); form.reset();
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
    $("#detail-body").innerHTML = `<p class="meta">${esc(doc.ownerName || doc.source)} · ${esc(doc.level)}</p><h2>${esc(doc.title)}</h2><p>${esc(doc.summary)}</p><p><strong>Tệp:</strong> ${esc(doc.fileName || "Chưa có")}</p>${(doc.fileUrl || doc.hasContent) ? `<button class="primary inline" type="button" data-read="${esc(doc.id)}">Đọc tài liệu</button>` : ""}`;
    bindDetails($("#detail-body"));
    $("#detail").showModal();
  } catch (error) { alert(error.message); }
}
$("[data-detail-close]").onclick = () => $("#detail").close();

if (token) {
  try { user = (await api("/api/auth/me")).user; } catch { token = ""; localStorage.removeItem("vshare_token"); }
}
updateAuthUi();
renderAgentContext();
await Promise.all([loadCatalog(), loadContributors()]);


