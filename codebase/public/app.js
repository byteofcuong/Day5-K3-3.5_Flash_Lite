import "dotenv/config";

let token = localStorage.getItem("vshare_token") || "";
let user = null;
let activeTab = "feed";
let authMode = "login";
let chatHistory = [];
let topicRoomsData = [];
let activeRoomId = null;

const $ = (selector) => document.querySelector(selector);
const esc = (str) => String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra");
  return data;
}

function card(doc, summarizeSection = "", isMy = false) {
  const fileBadge = doc.fileUrl ? `<a class="download" target="_blank" href="/api/documents/${encodeURIComponent(doc.id)}/download">Mở / tải tệp ↗</a>` : "";
  const detailBtn = `<button class="outline inline" onclick="openDoc('${esc(doc.id)}')">Chi tiết</button>`;
  const summarizeBtn = `<button class="outline inline" onclick="summarizeDoc('${esc(doc.id)}')">Tóm tắt bằng AI</button>`;
  const deleteBtn = isMy ? `<button class="outline inline" style="color:#d93434;border-color:#d93434;" onclick="deleteMyDoc('${esc(doc.id)}')">Xóa</button>` : "";

  return `
    <article class="post-card">
      <div class="meta">${esc(doc.ownerName || doc.source)} · Level: ${esc(doc.level)} · ${esc(doc.category)}</div>
      <h3>${esc(doc.title)}</h3>
      <p>${esc(doc.summary)}</p>
      <div class="tags">${(doc.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
      <div class="card-actions">${detailBtn} ${summarizeBtn} ${fileBadge} ${deleteBtn}</div>
      ${summarizeSection}
    </article>
  `;
}

async function renderFeed() {
  const feedEl = $("#feed-list");
  if (!feedEl) return;
  try {
    const documents = await api("/api/documents");
    const docArray = Array.isArray(documents) ? documents : (documents.documents || []);
    const search = $("#feed-search")?.value.toLowerCase().trim() || "";
    const category = $("#category-filter")?.value || "";

    const filtered = docArray.filter((doc) => {
      const matchesSearch = !search || doc.title.toLowerCase().includes(search) || doc.summary.toLowerCase().includes(search);
      const matchesCategory = !category || doc.category === category;
      return matchesSearch && matchesCategory;
    });

    feedEl.innerHTML = filtered.length ? filtered.map((doc) => card(doc)).join("") : '<div class="notice">Không tìm thấy tài liệu phù hợp.</div>';
  } catch (error) {
    feedEl.innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
}

async function summarizeDoc(id) {
  const container = $(`#summary-${id}`) || $(`#summary-${id}-modal`);
  if (!container) return;
  container.innerHTML = `<div class="loading">✨ AI đang đọc nội dung RAG và tóm tắt...</div>`;
  try {
    const res = await api(`/api/documents/${encodeURIComponent(id)}/summarize`, { method: "POST" });
    const pointsHtml = (res.keyPoints || []).map((p) => `<li>${esc(p)}</li>`).join("");
    container.innerHTML = `
      <div class="summary-box">
        <h4>✨ Bản tóm tắt RAG từ AI cho "${esc(res.title)}"</h4>
        <p><strong>🎯 Đối tượng phù hợp:</strong> ${esc(res.targetAudience)}</p>
        <p><strong>📌 3 Ý chính cốt lõi:</strong></p>
        <ul>${pointsHtml}</ul>
        <p><strong>💡 Khuyên đọc:</strong> ${esc(res.recommendedAction)}</p>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
}

async function deleteMyDoc(id) {
  if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) return;
  try {
    await api(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
    renderMyDocs();
    renderFeed();
  } catch (error) { alert(error.message); }
}

async function renderContributors() {
  const el = $("#contributors-list");
  if (!el) return;
  try {
    const list = await api("/api/contributors");
    el.innerHTML = list.map((item) => `
      <div class="contributor-card">
        <div class="rank">#${item.rank}</div>
        <div class="avatar">${esc(item.name.charAt(0).toUpperCase())}</div>
        <div class="contributor-info">
          <strong>${esc(item.name)}</strong>
          <small>${esc(item.topDoc)}</small>
        </div>
        <div class="post-count">
          <strong>${item.count}</strong>
          <small>bài đăng</small>
        </div>
      </div>
    `).join("");
  } catch (error) {
    el.innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
}

async function renderMyDocs() {
  const el = $("#mydocs-list");
  if (!el) return;
  try {
    const docs = await api("/api/my/documents");
    el.innerHTML = docs.length ? docs.map((doc) => card(doc, "", true)).join("") : '<div class="notice">Bạn chưa đăng tài liệu nào.</div>';
  } catch (error) {
    el.innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
  }
}

async function openDoc(id) {
  try {
    const doc = (await api(`/api/documents/${encodeURIComponent(id)}`)).document;
    const ratings = await api(`/api/documents/${encodeURIComponent(id)}/ratings`).catch(() => ({ averageRating: 5.0, totalReviews: 0, reviews: [] }));
    const reviewsHtml = (ratings.reviews || []).map(r => `<p style="margin:4px 0;">⭐ ${r.rating}/5 - <strong>${esc(r.userName)}:</strong> ${esc(r.comment)}</p>`).join("");

    const previewElement = doc.fileUrl
      ? `<iframe src="${esc(doc.fileUrl)}" class="reader-iframe" title="Xem tài liệu"></iframe>`
      : `<div class="reader-text-box"><p>${esc(doc.content || doc.summary)}</p></div>`;

    $("#detail-body").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 style="margin:0 0 4px;">📖 ${esc(doc.title)}</h2>
          <p class="meta" style="margin:0;">${esc(doc.ownerName || doc.source)} · ${esc(doc.level)} · ⭐ ${ratings.averageRating}/5 (${ratings.totalReviews} nhận xét)</p>
        </div>
        ${doc.fileUrl ? `<a class="download" target="_blank" href="/api/documents/${encodeURIComponent(doc.id)}/download" style="padding:6px 12px;font-size:0.83rem;">Tải tệp về máy ↗</a>` : ""}
      </div>

      <div class="reader-split-grid">
        <!-- CỘT TRÁI: ĐỌC TÀI LIỆU -->
        <div class="reader-left-pane">
          <h4 style="margin:0 0 8px;color:#1e293b;">📄 Nội Dung Bài Đọc</h4>
          ${previewElement}
          <div style="margin-top:10px;font-size:0.83rem;color:#64748b;">
            <p style="margin:4px 0;"><strong>Tóm tắt:</strong> ${esc(doc.summary)}</p>
          </div>
        </div>

        <!-- CỘT PHẢI: TRỢ GIẢNG AI & THẺ FLASHCARD SIDE-BY-SIDE -->
        <div class="reader-right-pane">
          <div class="summary-box" style="margin:0;height:100%;display:flex;flex-direction:column;background:#f0f9ff;border-color:#bae6fd;padding:14px;">
            <div style="display:flex;gap:8px;margin-bottom:10px;border-bottom:1px solid #bae6fd;padding-bottom:8px;">
              <button id="tab-tutor-btn" class="primary inline" style="padding:5px 10px;font-size:0.78rem;background:#0284c7;border-color:#0284c7;">💬 Hỏi Đáp AI</button>
              <button id="tab-flashcard-btn" class="outline inline" style="padding:5px 10px;font-size:0.78rem;color:#0284c7;border-color:#0284c7;">🎴 Thẻ Ôn Tập Flashcard AI</button>
            </div>

            <!-- TAB 1: HỎI ĐÁP AI -->
            <div id="pane-tutor" style="display:flex;flex-direction:column;flex:1;height:100%;">
              <p style="margin:0 0 8px;font-size:0.78rem;color:#0284c7;">Đặt câu hỏi để AI giải thích trực tiếp về các khái niệm trong tài liệu này.</p>
              
              <div id="doc-tutor-messages" class="chat-messages" style="height:380px;min-height:380px;background:#fff;border:1px solid #e0f2fe;border-radius:8px;padding:12px;margin-bottom:10px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">
                <div class="chat-msg assistant">Xin chào! Mình là Trợ giảng AI riêng cho bài đọc <strong>"${esc(doc.title)}"</strong>. Bạn có thắc mắc hay câu hỏi gì về nội dung bài đọc bên trái không?</div>
              </div>
              
              <form id="doc-tutor-form" style="display:flex;gap:8px;margin:0;">
                <input id="doc-tutor-input" placeholder="Hỏi AI về bài đọc này..." required style="margin:0;flex:1;">
                <button class="primary" style="padding:8px 14px;background:#0284c7;border-color:#0284c7;">Gửi</button>
              </form>
            </div>

            <!-- TAB 2: THẺ FLASHCARD AI -->
            <div id="pane-flashcard" style="display:none;flex-direction:column;flex:1;">
              <p style="margin:0 0 10px;font-size:0.78rem;color:#0284c7;">Bấm vào thẻ để lật xem đáp án ôn tập kiến thức trọng tâm.</p>
              <div id="flashcard-body" class="flashcard-container" style="flex:1;display:flex;flex-direction:column;justify-content:center;">
                <div class="loading" style="text-align:center;">✨ AI đang trích xuất Flashcard ôn tập...</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div class="summary-box" style="margin-top:14px;padding:10px 14px;">
        <h4 style="margin:0 0 6px;">💬 Đánh giá từ cộng đồng (${ratings.totalReviews})</h4>
        ${reviewsHtml || "<p style='margin:0;'>Chưa có nhận xét nào.</p>"}
      </div>
    `;

    // Tab Switching Logic
    let flashcardsData = null;
    let currentCardIdx = 0;

    $("#tab-tutor-btn")?.addEventListener("click", () => {
      $("#pane-tutor").style.display = "flex";
      $("#pane-flashcard").style.display = "none";
      $("#tab-tutor-btn").className = "primary inline";
      $("#tab-flashcard-btn").className = "outline inline";
    });

    $("#tab-flashcard-btn")?.addEventListener("click", async () => {
      $("#pane-tutor").style.display = "none";
      $("#pane-flashcard").style.display = "flex";
      $("#tab-tutor-btn").className = "outline inline";
      $("#tab-flashcard-btn").className = "primary inline";

      if (!flashcardsData) {
        try {
          const res = await api(`/api/documents/${encodeURIComponent(doc.id)}/flashcards`, { method: "POST" });
          flashcardsData = res.flashcards || [];
          renderFlashcard();
        } catch (err) {
          $("#flashcard-body").innerHTML = `<div class="notice error">Lỗi tạo thẻ: ${esc(err.message)}</div>`;
        }
      }
    });

    function renderFlashcard() {
      if (!flashcardsData || flashcardsData.length === 0) {
        $("#flashcard-body").innerHTML = `<div class="notice">Không có thẻ flashcard nào.</div>`;
        return;
      }
      const card = flashcardsData[currentCardIdx];
      let isFlipped = false;

      $("#flashcard-body").innerHTML = `
        <div id="active-flashcard" class="flashcard-card">
          <span class="flashcard-badge">Thẻ ${currentCardIdx + 1}/${flashcardsData.length}</span>
          <div id="card-text" style="font-size:1.05rem;font-weight:600;color:#0f172a;line-height:1.5;">${esc(card.question)}</div>
          <span class="flashcard-hint">🔄 Click vào thẻ để lật mặt xem đáp án</span>
        </div>
        <div class="flashcard-controls">
          <button id="prev-card-btn" class="outline inline" style="padding:6px 12px;font-size:0.8rem;" ${currentCardIdx === 0 ? "disabled" : ""}>⬅️ Thẻ Trước</button>
          <span style="font-size:0.8rem;color:#64748b;font-weight:600;">${currentCardIdx + 1} / ${flashcardsData.length}</span>
          <button id="next-card-btn" class="primary inline" style="padding:6px 12px;font-size:0.8rem;background:#0284c7;border-color:#0284c7;" ${currentCardIdx === flashcardsData.length - 1 ? "disabled" : ""}>Thẻ Tiếp ➡️</button>
        </div>
      `;

      const activeCardEl = $("#active-flashcard");
      if (activeCardEl) {
        activeCardEl.onclick = () => {
          isFlipped = !isFlipped;
          activeCardEl.classList.toggle("flipped", isFlipped);
          const textEl = $("#card-text");
          if (textEl) {
            textEl.innerHTML = isFlipped 
              ? `<span style="color:#0369a1;font-size:0.95rem;font-weight:normal;">💡 <strong>Đáp án:</strong> ${esc(card.answer)}</span>`
              : esc(card.question);
          }
        };
      }

      $("#prev-card-btn")?.addEventListener("click", () => {
        if (currentCardIdx > 0) { currentCardIdx--; renderFlashcard(); }
      });
      $("#next-card-btn")?.addEventListener("click", () => {
        if (currentCardIdx < flashcardsData.length - 1) { currentCardIdx++; renderFlashcard(); }
      });
    }

    let docChatHistory = [];
    const tutorForm = $("#doc-tutor-form");
    if (tutorForm) {
      tutorForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = $("#doc-tutor-input");
        const msg = input?.value.trim();
        if (!msg) return;
        input.value = "";
        docChatHistory.push({ role: "user", content: msg });
        const box = $("#doc-tutor-messages");
        if (box) {
          box.innerHTML += `<div class="chat-msg user">${esc(msg)}</div>`;
          box.innerHTML += `<div class="chat-msg assistant tutor-loading">🤖 AI đang đọc bài và suy nghĩ...</div>`;
          setTimeout(() => { box.scrollTop = box.scrollHeight; }, 30);
        }
        try {
          const res = await api(`/api/documents/${encodeURIComponent(doc.id)}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: docChatHistory })
          });
          const replyText = typeof res.reply === "string" ? res.reply : (res.reply?.reply || JSON.stringify(res.reply));
          docChatHistory.push({ role: "assistant", content: replyText });
          const loadingMsg = box?.querySelector(".tutor-loading");
          if (loadingMsg) loadingMsg.remove();
          if (box) {
            let traceHtml = "";
            if (res.docTrace && res.docTrace.length) {
              traceHtml = `
                <details class="doc-trace-details" style="margin-bottom:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:6px 10px;font-size:0.78rem;">
                  <summary style="cursor:pointer;font-weight:700;color:#0284c7;">🔍 Log AI Đọc Bài (${res.docTrace.length} bước)</summary>
                  <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px;padding-left:6px;border-left:2px solid #38bdf8;">
                    ${res.docTrace.map(step => `<div>${formatMarkdown(step)}</div>`).join("")}
                  </div>
                </details>
              `;
            }
            box.innerHTML += `<div class="chat-msg assistant">${traceHtml}${formatMarkdown(replyText)}</div>`;
            setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
          }
        } catch (err) {
          const loadingMsg = box?.querySelector(".tutor-loading");
          if (loadingMsg) loadingMsg.innerHTML = `<span style="color:#d93434;">⚠️ Lỗi AI: ${esc(err.message)}</span>`;
          setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
        }
      };
    }

    $("#detail").showModal();
  } catch (error) { alert(error.message); }
}

function openAuth(mode = "login") {
  authMode = mode;
  if ($("#auth-title")) $("#auth-title").textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  if ($("#auth-submit")) $("#auth-submit").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  if ($("#name-field")) $("#name-field").classList.toggle("hidden", mode === "login");
  if ($("#auth-status")) $("#auth-status").innerHTML = "";
  if ($("#auth-dialog")) $("#auth-dialog").showModal();
}

async function loadTopicRooms() {
  const listEl = $("#room-list");
  if (!listEl) return;
  try {
    const data = await api("/api/rooms");
    topicRoomsData = data.rooms || [];
    listEl.innerHTML = topicRoomsData.map(r => `
      <div class="room-card ${r.id === activeRoomId ? 'active' : ''}" data-room-id="${esc(r.id)}">
        <div class="room-card-title">${esc(r.name)}</div>
        <div class="room-card-desc">${esc(r.description)}</div>
        <div class="room-card-meta">💬 ${r.messageCount} thảo luận</div>
      </div>
    `).join("");

    listEl.querySelectorAll("[data-room-id]").forEach(card => {
      card.onclick = () => selectRoom(card.dataset.roomId);
    });

    if (!activeRoomId && topicRoomsData.length > 0) {
      selectRoom(topicRoomsData[0].id);
    }
  } catch (err) {
    listEl.innerHTML = `<div class="notice error">${esc(err.message)}</div>`;
  }
}

async function selectRoom(roomId) {
  activeRoomId = roomId;
  const room = topicRoomsData.find(r => r.id === roomId);
  if (room && $("#active-room-header")) {
    $("#active-room-header").innerHTML = `
      <h3>${esc(room.name)}</h3>
      <p>${esc(room.description)}</p>
    `;
  }
  document.querySelectorAll(".room-card").forEach(c => {
    c.classList.toggle("active", c.dataset.roomId === roomId);
  });
  await loadRoomMessages(roomId);
}

async function loadRoomMessages(roomId) {
  const msgBox = $("#room-messages");
  if (!msgBox) return;
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/messages`);
    const msgs = data.messages || [];
    if (msgs.length === 0) {
      msgBox.innerHTML = `<div class="chat-msg assistant">Chưa có thảo luận nào trong phòng này. Hãy là người đầu tiên lên tiếng!</div>`;
      return;
    }
    const currentName = user?.displayName || "Học viên VShare";
    msgBox.innerHTML = msgs.map(m => {
      const isMe = m.userName === currentName;
      const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="chat-msg ${isMe ? 'user' : 'assistant'}">
          <div class="msg-author">${esc(m.userName)} <span style="font-weight:normal;opacity:0.75;font-size:0.72rem">${timeStr}</span></div>
          <div>${esc(m.content)}</div>
        </div>
      `;
    }).join("");
    msgBox.scrollTop = msgBox.scrollHeight;
  } catch (err) {
    msgBox.innerHTML = `<div class="chat-msg assistant">Lỗi tải tin nhắn: ${esc(err.message)}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initTabs();

  if ($("#feed-search")) $("#feed-search").oninput = renderFeed;
  if ($("#category-filter")) $("#category-filter").onchange = renderFeed;

  document.querySelectorAll("[data-auth]").forEach((button) => button.onclick = () => openAuth(button.dataset.auth));
  if ($("[data-close]")) $("[data-close]").onclick = () => $("#auth-dialog")?.close();
  if ($("[data-detail-close]")) $("[data-detail-close]").onclick = () => $("#detail")?.close();

  if ($("#auth-form")) {
    $("#auth-form").onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const data = await api(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        token = data.token; user = data.user; localStorage.setItem("vshare_token", token);
        updateAuthUi(); $("#auth-dialog")?.close(); event.currentTarget.reset();
      } catch (error) {
        if ($("#auth-status")) $("#auth-status").innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
      }
    };
  }

  if ($("#logout")) {
    $("#logout").onclick = async () => {
      try { await api("/api/auth/logout", { method: "POST" }); } catch {}
      token = ""; user = null; localStorage.removeItem("vshare_token"); updateAuthUi(); setTab("feed");
    };
  }

  if ($("#search-form")) {
    $("#search-form").onsubmit = async (e) => {
      e.preventDefault();
      const q = $("#query")?.value.trim();
      if (!q) return;
      if ($("#status")) $("#status").innerHTML = `<div class="loading">✨ Agent đang đọc kho RAG VShare và suy nghĩ...</div>`;
      try {
        const data = await api("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
        if ($("#status")) $("#status").innerHTML = `<div class="success">${esc(data.message)} (${data.mode})</div>`;
        const resEl = $("#search-results");
        if (resEl) {
          resEl.innerHTML = (data.results || []).map((r) => `<div class="post-card"><h4>Tài liệu ID: ${esc(r.documentId)}</h4><p>${esc(r.reason)}</p><span class="tag">Độ tin cậy: ${(r.confidence * 100).toFixed(0)}%</span></div>`).join("");
        }
      } catch (err) {
        if ($("#status")) $("#status").innerHTML = `<div class="notice error">${esc(err.message)}</div>`;
      }
    };
  }

function formatMarkdown(text, matchedDocs = []) {
  if (!text) return "";
  let html = esc(text);

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^\*\s+(.*)$/gm, "• $1");
  html = html.replace(/\n/g, "<br>");

  if (matchedDocs && matchedDocs.length) {
    matchedDocs.forEach(d => {
      const escapedTitle = esc(d.title);
      const chip = `<a href="javascript:void(0)" class="doc-link-chip" data-doc-link="${esc(d.id)}">📄 ${escapedTitle}</a>`;
      const pattern = new RegExp(`<strong>"${escapedTitle}"<\/strong>|"${escapedTitle}"|<strong>${escapedTitle}<\/strong>`, "g");
      html = html.replace(pattern, chip);
    });
  }

  return html;
}

  if ($("#chat-form")) {
    $("#chat-form").onsubmit = async (e) => {
      e.preventDefault();
      const input = $("#chat-input");
      const msg = input?.value.trim();
      if (!msg) return;
      input.value = "";
      chatHistory.push({ role: "user", content: msg });
      const msgBox = $("#chat-messages");
      if (msgBox) {
        msgBox.innerHTML += `<div class="chat-msg user">${esc(msg)}</div>`;
        msgBox.innerHTML += `<div class="chat-msg assistant id-loading">🤖 VShare AI đang suy nghĩ...</div>`;
        msgBox.scrollTop = msgBox.scrollHeight;
      }
      try {
        const res = await api("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: chatHistory }) });
        const replyText = typeof res.reply === "string" ? res.reply : (res.reply?.reply || JSON.stringify(res.reply || ""));
        if (replyText) {
          chatHistory.push({ role: "assistant", content: replyText });
        }
        const loadingMsg = msgBox?.querySelector(".id-loading");
        if (loadingMsg) loadingMsg.remove();
        if (msgBox) {
          let traceHtml = "";
          if (res.agentTrace && res.agentTrace.length) {
            traceHtml = `
              <details class="agent-trace-details" style="margin-bottom:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px 12px;font-size:0.82rem;">
                <summary style="cursor:pointer;font-weight:700;color:#0284c7;">🧠 Xem Chuỗi Hoạt Động & Suy Nghĩ Của Agent (${res.agentTrace.length} bước)</summary>
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;padding-left:8px;border-left:2px solid #38bdf8;">
                  ${res.agentTrace.map(step => `<div>${formatMarkdown(step)}</div>`).join("")}
                </div>
              </details>
            `;
          }

          let actionBtnsHtml = "";
          if (res.matchedDocs && res.matchedDocs.length) {
            actionBtnsHtml += `<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">`;
            res.matchedDocs.forEach(d => {
              actionBtnsHtml += `<button class="primary inline doc-action-reader-btn" data-doc-reader-id="${esc(d.id)}" style="background:#ff4b4b;border-color:#ff4b4b;font-size:0.83rem;padding:7px 14px;cursor:pointer;text-align:left;border-radius:6px;box-shadow:0 2px 6px rgba(255,75,75,0.2);">📖 Mở Trình Đọc Chia Đôi & Trợ Giảng AI: "${esc(d.title)}"</button>`;
            });
            actionBtnsHtml += `</div>`;
          }
          if (res.recommendedRoom) {
            actionBtnsHtml += `<div style="margin-top:8px;"><button class="outline inline jump-room-btn" data-jump-room="${esc(res.recommendedRoom.id)}">🚀 Tham gia phòng chat "${esc(res.recommendedRoom.name)}" ngay</button></div>`;
          }

          const formattedReply = formatMarkdown(replyText, res.matchedDocs);
          msgBox.innerHTML += `<div class="chat-msg assistant">${traceHtml}${formattedReply}${actionBtnsHtml}</div>`;
          setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 50);

          msgBox.querySelectorAll("[data-jump-room]").forEach(btn => {
            btn.onclick = () => {
              setTab("community-rooms");
              selectRoom(btn.dataset.jumpRoom);
            };
          });

          msgBox.querySelectorAll("[data-doc-link]").forEach(chip => {
            chip.onclick = () => openDoc(chip.dataset.docLink);
          });

          msgBox.querySelectorAll("[data-doc-reader-id]").forEach(btn => {
            btn.onclick = () => openDoc(btn.dataset.docReaderId);
          });
        }
      } catch (err) {
        const loadingMsg = msgBox?.querySelector(".id-loading");
        if (loadingMsg) loadingMsg.innerHTML = `<span style="color:#d93434;">⚠️ Lỗi AI: ${esc(err.message)}</span>`;
        setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 50);
      }
    };
  }

  if ($("#create-form")) {
    $("#create-form").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      if ($("#create-status")) $("#create-status").innerHTML = `<div class="loading">Đang tải tài liệu lên và trích xuất RAG...</div>`;
      try {
        await api("/api/documents", { method: "POST", body: formData });
        if ($("#create-status")) $("#create-status").innerHTML = `<div class="success">Đăng tài liệu thành công!</div>`;
        e.currentTarget.reset();
        renderFeed();
        renderMyDocs();
        renderContributors();
      } catch (err) {
        if ($("#create-status")) $("#create-status").innerHTML = `<div class="notice error">${esc(err.message)}</div>`;
      }
    };
  }

  if ($("#room-msg-form")) {
    $("#room-msg-form").onsubmit = async (e) => {
      e.preventDefault();
      if (!activeRoomId) return;
      const input = $("#room-msg-input");
      const content = input?.value.trim();
      if (!content) return;
      input.value = "";
      try {
        await api(`/api/rooms/${encodeURIComponent(activeRoomId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        });
        await loadRoomMessages(activeRoomId);
      } catch (err) {
        alert("Lỗi gửi tin nhắn: " + err.message);
      }
    };
  }

  updateAuthUi();
  renderFeed();
  renderContributors();
  renderMyDocs();
  loadTopicRooms();
});

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => setTab(tab.dataset.tab);
  });
}

function setTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));
}

function updateAuthUi() {
  const isAuth = Boolean(token && user);
  if ($("#auth-user")) $("#auth-user").textContent = isAuth ? (user.displayName || user.email) : "";
  if ($("#auth-user-box")) $("#auth-user-box").classList.toggle("hidden", !isAuth);
  document.querySelectorAll("[data-auth]").forEach((btn) => btn.classList.toggle("hidden", isAuth));
  const myTab = document.querySelector('[data-tab="mydocs"]');
  if (myTab) myTab.classList.toggle("hidden", !isAuth);
}
