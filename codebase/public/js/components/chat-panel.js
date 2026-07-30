import { append, delegate, html, on, raw, render, scrollToBottom } from "../core/dom.js";
import { renderMarkdown } from "../core/markdown.js";
import { icon } from "./icons.js";

/**
 * Reusable chat surface shared by the AI chatbot, the community rooms and the
 * in-document tutor. Each caller supplies only how a message is sent and how a
 * reply is turned into markup.
 *
 * The caller owns the `.chat` element; this only fills it in.
 */
export function createChatPanel({
  mount,
  placeholder = "Nhập nội dung…",
  greeting = "",
  disabled = false,
  disabledHint = "",
  onSend,
}) {
  render(mount, html`
    <div class="chat__log" data-chat-log role="log" aria-live="polite"></div>
    <p class="chat__hint" data-chat-hint>${disabledHint}</p>
    <form class="chat__form" data-chat-form>
      <input class="input" data-chat-input placeholder="${placeholder}" autocomplete="off" required ${raw(disabled ? "disabled" : "")}>
      <button class="btn btn--primary btn--icon" type="submit" data-chat-send aria-label="Gửi" ${raw(disabled ? "disabled" : "")}>
        ${icon("send", 16)}
      </button>
    </form>
  `);

  if (!mount.classList.contains("chat")) mount.classList.add("chat");

  const log = mount.querySelector("[data-chat-log]");
  const form = mount.querySelector("[data-chat-form]");
  const input = mount.querySelector("[data-chat-input]");
  const sendButton = mount.querySelector("[data-chat-send]");
  const hintNode = mount.querySelector("[data-chat-hint]");
  const cleanups = [];

  function appendMessage({ role, author = "", time = "", body, className = "" }) {
    const node = append(log, html`
      <div class="msg msg--${role} ${className}">
        ${author ? html`<p class="msg__author">${author}${time ? html`<span class="msg__time">${time}</span>` : ""}</p>` : ""}
        <div class="msg__body">${body}</div>
      </div>
    `);
    scrollToBottom(log);
    return node;
  }

  if (greeting) appendMessage({ role: "assistant", body: html`${greeting}` });

  function setBusy(busy) {
    input.disabled = busy;
    sendButton.disabled = busy;
  }

  cleanups.push(on(form, "submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    setBusy(true);
    try {
      await onSend(text, panel);
    } finally {
      setBusy(false);
      input.focus();
    }
  }));

  const panel = {
    log,
    input,
    appendMessage,

    clear() {
      render(log, html``);
    },

    setEnabled(enabled, hint = "") {
      input.disabled = !enabled;
      sendButton.disabled = !enabled;
      hintNode.textContent = hint;
    },

    /** Shows a placeholder bubble and returns a handle to replace or fail it. */
    pending(label = "Đang xử lý…") {
      const node = appendMessage({
        role: "assistant",
        className: "is-pending",
        body: html`<span class="spinner spinner--sm"></span> ${label}`,
      });
      return {
        replace(content) {
          node.classList.remove("is-pending");
          render(node.querySelector(".msg__body"), content);
          scrollToBottom(log);
        },
        fail(message) {
          node.classList.remove("is-pending");
          node.classList.add("is-error");
          render(node.querySelector(".msg__body"), html`${message}`);
          scrollToBottom(log);
        },
      };
    },

    /** Collapsible ReAct trace. */
    trace(steps, label = "Chuỗi suy luận của Agent") {
      if (!steps?.length) return html``;
      return html`
        <details class="trace">
          <summary>${label} · ${steps.length} bước</summary>
          <ol class="trace__steps">
            ${steps.map((step) => html`<li>${renderMarkdown(typeof step === "string" ? step : JSON.stringify(step))}</li>`)}
          </ol>
        </details>
      `;
    },

    onDocumentChipClick(handler) {
      cleanups.push(delegate(log, "click", "[data-open-doc]", (_event, target) => handler(target.dataset.openDoc)));
    },

    onAction(selector, handler) {
      cleanups.push(delegate(log, "click", selector, handler));
    },

    destroy() {
      cleanups.forEach((off) => off());
      cleanups.length = 0;
    },
  };

  return panel;
}
