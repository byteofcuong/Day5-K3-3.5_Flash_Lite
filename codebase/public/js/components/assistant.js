import { api, endpoints } from "../core/api.js";
import { delegate, html, on, render } from "../core/dom.js";
import { renderMarkdown } from "../core/markdown.js";
import { navigate } from "../core/router.js";
import { createChatPanel } from "./chat-panel.js";
import { icon } from "./icons.js";

/**
 * The VShare assistant, as a floating widget rather than a page.
 *
 * It lives outside the router: mounted once at boot and available on every
 * screen, because "ask the assistant" is something you do *while* working, not
 * a place you navigate to. The chat panel is created lazily on first open so
 * the widget costs nothing until used.
 */

const GREETING = "Xin chào! Mình là VShare Assistant. Bạn cần tìm học liệu gì hôm nay?";

let root = null;
let panelEl = null;
let chat = null;
let history = [];
let isOpen = false;

function fabTemplate() {
  return html`
    <button type="button" class="assistant__fab" data-assistant-toggle
            aria-expanded="false" aria-controls="assistant-panel">
      <span class="assistant__pip" aria-hidden="true"></span>
      ${icon("sparkles", 18)}
      <span>Trợ lý AI</span>
    </button>
  `;
}

function panelTemplate() {
  return html`
    <section class="assistant__panel" id="assistant-panel" role="dialog" aria-label="Trợ lý AI VShare">
      <header class="assistant__head">
        ${icon("sparkles", 18)}
        <span class="assistant__titles">
          <span class="assistant__title">VShare Assistant</span>
          <span class="assistant__sub">Trả lời dựa trên kho tài liệu VShare</span>
        </span>
        <button type="button" class="assistant__close" data-assistant-close aria-label="Đóng">
          ${icon("close", 16)}
        </button>
      </header>
      <div class="chat" data-assistant-chat></div>
    </section>
  `;
}

async function send(text) {
  chat.appendMessage({ role: "user", body: html`${text}` });
  history.push({ role: "user", content: text });

  const pending = chat.pending("Đang suy nghĩ…");
  try {
    const result = await api.post(endpoints.chat, { messages: history });
    const reply = typeof result.reply === "string" ? result.reply : result.reply?.reply || "";
    history.push({ role: "assistant", content: reply });

    const matched = result.matchedDocs || [];
    pending.replace(html`
      ${chat.trace(result.agentTrace)}
      ${renderMarkdown(reply, matched)}
      ${matched.length
        ? html`<div class="msg__actions">
            ${matched.map((doc) => html`
              <button type="button" class="btn btn--secondary btn--sm" data-open-doc="${doc.id}">
                ${icon("file", 15)} ${doc.title}
              </button>`)}
          </div>`
        : ""}
      ${result.recommendedRoom
        ? html`<div class="msg__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-join-room="${result.recommendedRoom.id}">
              ${icon("users", 15)} Tham gia “${result.recommendedRoom.name}”
            </button>
          </div>`
        : ""}
    `);
  } catch (error) {
    pending.fail(error.message);
  }
}

/** Imported lazily so the reader modal is not built until it is needed. */
async function openDoc(id) {
  const { openDocument } = await import("../views/doc-detail.view.js");
  setOpen(false);
  openDocument(id);
}

function ensureChat() {
  if (chat) return;
  chat = createChatPanel({
    mount: panelEl.querySelector("[data-assistant-chat]"),
    placeholder: "Hỏi về học liệu, bài học…",
    greeting: GREETING,
    onSend: send,
  });

  chat.onDocumentChipClick(openDoc);
  chat.onAction("[data-open-doc]", (_event, target) => openDoc(target.dataset.openDoc));
  chat.onAction("[data-join-room]", (_event, target) => {
    setOpen(false);
    navigate(`/rooms?room=${encodeURIComponent(target.dataset.joinRoom)}`);
  });
}

function setOpen(open) {
  isOpen = open;
  const fab = root.querySelector("[data-assistant-toggle]");

  if (open) {
    if (!panelEl) {
      root.insertAdjacentHTML("afterbegin", panelTemplate().value);
      panelEl = root.querySelector(".assistant__panel");
    }
    panelEl.hidden = false;
    ensureChat();
    chat.input.focus();
  } else if (panelEl) {
    panelEl.hidden = true;
  }

  fab.setAttribute("aria-expanded", String(open));
}

/** Mounts the widget once. Safe to call repeatedly. */
export function mountAssistant() {
  if (root) return;

  root = document.createElement("div");
  root.className = "assistant";
  root.dataset.hue = "chat";   // the assistant keeps its own colour everywhere
  render(root, fabTemplate());
  document.body.append(root);

  delegate(root, "click", "[data-assistant-toggle]", () => setOpen(!isOpen));
  delegate(root, "click", "[data-assistant-close]", () => setOpen(false));

  on(document, "keydown", (event) => {
    if (event.key === "Escape" && isOpen) setOpen(false);
  });
}
