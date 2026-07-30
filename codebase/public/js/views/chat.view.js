import { api, endpoints } from "../core/api.js";
import { html, render } from "../core/dom.js";
import { renderMarkdown } from "../core/markdown.js";
import { createChatPanel } from "../components/chat-panel.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { navigate } from "../core/router.js";
import { openDocument } from "./doc-detail.view.js";

/** General VShare assistant, grounded on the whole catalog. */
export function createChatView() {
  const history = [];
  let panel = null;

  return {
    async render(container) {
      render(container, html`
        ${pageHeader({
          eyebrow: "Trợ lý AI",
          title: "Hỏi đáp cùng VShare Assistant",
          sub: "Hỏi về bài học, tra cứu tài liệu hoặc nhờ gợi ý phòng thảo luận phù hợp.",
          iconName: "chat",
        })}
        ${pageBody(html`<div class="chat chat--tall" data-chat-mount></div>`, { width: "narrow" })}
      `);

      panel = createChatPanel({
        mount: container.querySelector("[data-chat-mount]"),
        placeholder: "Nhập câu hỏi của bạn…",
        greeting: "Xin chào! Mình là VShare Assistant. Bạn cần hỗ trợ gì về học liệu hôm nay?",
        async onSend(text) {
          panel.appendMessage({ role: "user", body: html`${text}` });
          history.push({ role: "user", content: text });

          const pending = panel.pending("Đang suy nghĩ…");
          try {
            const result = await api.post(endpoints.chat, { messages: history });
            const reply = typeof result.reply === "string" ? result.reply : result.reply?.reply || "";
            history.push({ role: "assistant", content: reply });

            const matched = result.matchedDocs || [];
            pending.replace(html`
              ${panel.trace(result.agentTrace)}
              ${renderMarkdown(reply, matched)}
              ${matched.length
                ? html`<div class="msg__actions">
                    ${matched.map((doc) => html`
                      <button type="button" class="btn btn--secondary btn--sm" data-open-doc="${doc.id}">
                        ${icon("file", 15)} Mở: ${doc.title}
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
        },
      });

      panel.onDocumentChipClick(openDocument);
      panel.onAction("[data-join-room]", (_event, target) => {
        navigate(`/rooms?room=${encodeURIComponent(target.dataset.joinRoom)}`);
      });
    },

    destroy() {
      panel?.destroy();
      panel = null;
    },
  };
}
