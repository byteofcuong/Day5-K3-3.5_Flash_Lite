import { api, endpoints } from "../core/api.js";
import { delegate, formatTime, html, render } from "../core/dom.js";
import { createChatPanel } from "../components/chat-panel.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { errorState, loadingState } from "../components/states.js";
import { openAuthDialog } from "../components/auth-dialog.js";
import { currentUser, isAuthenticated, session } from "../state/session.js";

const POLL_INTERVAL_MS = 8000;

/** Topic rooms: a room rail plus one chat surface. */
export function createRoomsView() {
  let cleanups = [];
  let rooms = [];
  let activeRoomId = null;
  let panel = null;
  let pollTimer = null;

  function renderRoomList(node) {
    render(node, html`${rooms.map((room) => html`
      <li>
        <button type="button" class="room ${room.id === activeRoomId ? "is-active" : ""}" data-room="${room.id}">
          <span class="room__name">${room.emoji || "💬"} ${room.name}</span>
          <span class="room__desc">${room.description}</span>
          <span class="room__meta">${room.messageCount} thảo luận</span>
        </button>
      </li>`)}`);
  }

  async function loadMessages() {
    if (!activeRoomId || !panel) return;
    try {
      const { items } = await api.get(endpoints.roomMessages(activeRoomId));
      const me = currentUser()?.id;
      panel.clear();
      if (!items.length) {
        panel.appendMessage({ role: "assistant", body: html`Chưa có thảo luận nào. Hãy là người mở đầu!` });
        return;
      }
      for (const message of items) {
        panel.appendMessage({
          role: message.userId === me ? "user" : "assistant",
          author: message.userName,
          time: formatTime(message.createdAt),
          body: html`${message.content}`,
        });
      }
    } catch (error) {
      panel.appendMessage({ role: "assistant", className: "is-error", body: html`${error.message}` });
    }
  }

  function applyAuthState() {
    if (!panel) return;
    panel.setEnabled(
      isAuthenticated() && Boolean(activeRoomId),
      isAuthenticated() ? "" : "Đăng nhập để tham gia thảo luận.",
    );
  }

  async function selectRoom(container, roomId) {
    activeRoomId = roomId;
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    render(container.querySelector("[data-room-head]"), html`
      <div>
        <h2 class="room-head__title">${room.emoji || "💬"} ${room.name}</h2>
        <p class="room-head__desc">${room.description}</p>
      </div>
      <span class="badge">${room.messageCount} tin nhắn</span>
    `);

    renderRoomList(container.querySelector("[data-room-list]"));
    applyAuthState();
    await loadMessages();
  }

  return {
    async render(container, context) {
      render(container, html`
        ${pageHeader({
          eyebrow: "Cộng đồng",
          title: "Phòng thảo luận",
          sub: "Kết nối với học viên đang nghiên cứu cùng chủ đề.",
          iconName: "users",
        })}
        ${pageBody(html`
          <div class="rooms-layout">
            <aside class="rooms-sidebar">
              <span class="section-label">Chủ đề</span>
              <ul class="room-list" data-room-list>${loadingState("Đang tải…")}</ul>
            </aside>
            <section class="room-main">
              <header class="room-head" data-room-head>
                <h2 class="room-head__title">Chọn một phòng để bắt đầu</h2>
              </header>
              <div data-chat-mount></div>
            </section>
          </div>
        `, { width: "flush" })}
      `);

      panel = createChatPanel({
        mount: container.querySelector("[data-chat-mount]"),
        placeholder: "Chia sẻ với mọi người…",
        disabled: true,
        disabledHint: "Chọn một phòng để bắt đầu.",
        async onSend(text) {
          if (!isAuthenticated()) {
            openAuthDialog("login");
            return;
          }
          try {
            await api.post(endpoints.roomMessages(activeRoomId), { content: text });
            await loadMessages();
          } catch (error) {
            panel.appendMessage({ role: "assistant", className: "is-error", body: html`${error.message}` });
          }
        },
      });

      cleanups.push(delegate(container, "click", "[data-room]", (_event, target) => {
        selectRoom(container, target.dataset.room);
      }));

      // Enable/disable the composer the moment the session changes.
      cleanups.push(session.select((state) => state.status, applyAuthState));

      try {
        const { items } = await api.get(endpoints.rooms);
        rooms = items;
      } catch (error) {
        render(container.querySelector("[data-room-list]"), errorState(error.message));
        return;
      }

      const requested = context?.query?.get("room");
      const initial = rooms.find((room) => room.id === requested)?.id || rooms[0]?.id;
      if (initial) await selectRoom(container, initial);

      // Cheap stand-in for realtime: refresh while the tab is visible.
      pollTimer = setInterval(() => {
        if (document.visibilityState === "visible") loadMessages();
      }, POLL_INTERVAL_MS);
    },

    destroy() {
      clearInterval(pollTimer);
      pollTimer = null;
      panel?.destroy();
      panel = null;
      cleanups.forEach((off) => off());
      cleanups = [];
    },
  };
}
