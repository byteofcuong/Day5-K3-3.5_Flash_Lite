import { api, endpoints } from "../core/api.js";
import { delegate, formatDate, html, render, safeUrl } from "../core/dom.js";
import { renderMarkdown } from "../core/markdown.js";
import { createChatPanel } from "../components/chat-panel.js";
import { createModal } from "../components/modal.js";
import { levelLabel, tagList } from "../components/doc-card.js";
import { icon } from "../components/icons.js";
import { emptyState, errorState, loadingState } from "../components/states.js";

/**
 * The document reader: source pane on the left, AI study tools on the right.
 * Opened from any view via openDocument(id) — it owns its own modal instance.
 */

const modal = createModal({ id: "doc-modal", size: "xl" });
let activeCleanups = [];

modal.onClose(() => {
  activeCleanups.forEach((off) => off());
  activeCleanups = [];
});

/**
 * Picks how to show the attachment. Only PDFs and images can be embedded —
 * anything else (docx, zip…) gets a download prompt rather than an iframe that
 * would render as a blank box or trigger a surprise download.
 */
function filePreview(doc) {
  const url = safeUrl(doc.fileUrl);
  if (!url) return html`<div class="reader__text">${doc.content || doc.summary}</div>`;

  const name = String(doc.fileName || url).toLowerCase();
  const type = String(doc.mimeType || "");

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return html`
      <object class="reader__frame" data="${url}" type="application/pdf">
        <div class="reader__fallback">
          <p>Trình duyệt không hiển thị được PDF trực tiếp.</p>
          <a class="btn btn--primary btn--sm" href="${url}" target="_blank" rel="noopener">
            ${icon("external", 15)} Mở PDF ở tab mới
          </a>
        </div>
      </object>
    `;
  }

  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(name)) {
    return html`<div class="reader__image"><img src="${url}" alt="${doc.title}"></div>`;
  }

  return html`
    <div class="reader__fallback">
      <span class="state__icon">${icon("file", 22)}</span>
      <p><strong>${doc.fileName || "Tệp đính kèm"}</strong></p>
      <p class="muted">Định dạng này không xem trực tiếp được trên trình duyệt.</p>
      <a class="btn btn--primary btn--sm" href="${endpoints.download(doc.id)}" target="_blank" rel="noopener">
        ${icon("download", 15)} Tải tệp về máy
      </a>
    </div>
  `;
}

function shell(doc, ratings) {
  return html`
    <header class="reader__head">
      <div>
        <h2 class="reader__title">${doc.title}</h2>
        <p class="reader__meta">
          <span>${doc.ownerName || doc.source || "VShare"}</span>
          <span class="dot">·</span>
          <span class="badge badge--hue">${levelLabel(doc.level)}</span>
          <time>${formatDate(doc.date)}</time>
          ${ratings.totalReviews
            ? html`<span class="dot">·</span>
                   <span>★ ${ratings.averageRating}/5 · ${ratings.totalReviews} nhận xét</span>`
            : ""}
        </p>
      </div>
      ${doc.fileUrl
        ? html`<a class="btn btn--secondary btn--sm" href="${endpoints.download(doc.id)}" target="_blank" rel="noopener">
            ${icon("download", 15)} Tải tệp
          </a>`
        : ""}
    </header>

    <div class="reader">
      <section class="reader__source">
        <div class="reader__source-bar">
          <h3 class="reader__section-title">${icon("file", 14)} ${doc.fileName || "Nội dung tài liệu"}</h3>
          ${safeUrl(doc.fileUrl)
            ? html`<a class="link" href="${safeUrl(doc.fileUrl)}" target="_blank" rel="noopener">Mở tab mới</a>`
            : ""}
        </div>
        ${filePreview(doc)}
        <p class="reader__summary"><strong>Tóm tắt:</strong> ${doc.summary}</p>
        ${doc.tags?.length ? tagList(doc.tags) : ""}
      </section>

      <section class="reader__tools">
        <div class="segmented" role="tablist">
          <button type="button" class="segmented__btn is-active" data-tool="tutor" role="tab">
            ${icon("chat", 15)} Hỏi đáp AI
          </button>
          <button type="button" class="segmented__btn" data-tool="flashcards" role="tab">
            ${icon("cards", 15)} Flashcard
          </button>
        </div>
        <div class="reader__pane" data-pane="tutor"></div>
        <div class="reader__pane is-hidden" data-pane="flashcards"></div>
      </section>
    </div>

    <section class="reader__reviews">
      <span class="section-label">Đánh giá từ cộng đồng · ${ratings.totalReviews}</span>
      ${ratings.reviews.length
        ? html`<ul class="reviews">
            ${ratings.reviews.map((review) => html`
              <li class="review">
                <span class="review__head">
                  <span class="review__score">★ ${review.rating}/5</span>
                  <span>${review.userName}</span>
                </span>
                <span>${review.comment}</span>
              </li>`)}
          </ul>`
        : emptyState({ iconName: "chat", title: "Chưa có nhận xét nào." })}
    </section>
  `;
}

function mountTutor(pane, doc) {
  const history = [];
  const panel = createChatPanel({
    mount: pane,
    placeholder: "Hỏi AI về tài liệu này…",
    greeting: `Mình là trợ giảng AI cho tài liệu “${doc.title}”. Bạn muốn hỏi gì về nội dung này?`,
    async onSend(text) {
      panel.appendMessage({ role: "user", body: html`${text}` });
      history.push({ role: "user", content: text });
      const pending = panel.pending("Đang đọc tài liệu…");
      try {
        const result = await api.post(endpoints.documentChat(doc.id), { messages: history });
        const reply = typeof result.reply === "string" ? result.reply : result.reply?.reply || "";
        history.push({ role: "assistant", content: reply });
        pending.replace(html`${panel.trace(result.docTrace, "Log AI đọc bài")}${renderMarkdown(reply)}`);
      } catch (error) {
        pending.fail(error.message);
      }
    },
  });
  activeCleanups.push(() => panel.destroy());
}

async function mountFlashcards(pane, doc) {
  render(pane, loadingState("AI đang trích xuất thẻ ôn tập…"));

  let cards = [];
  try {
    const result = await api.post(endpoints.flashcards(doc.id));
    cards = result.flashcards || [];
  } catch (error) {
    render(pane, errorState(error.message));
    return;
  }

  if (!cards.length) {
    render(pane, emptyState({ iconName: "cards", title: "Không tạo được thẻ ôn tập cho tài liệu này." }));
    return;
  }

  let index = 0;
  let flipped = false;

  const paint = () => {
    const card = cards[index];
    render(pane, html`
      <div class="flashcard ${flipped ? "is-flipped" : ""}" data-flip role="button" tabindex="0">
        <span class="flashcard__badge">${index + 1}/${cards.length}</span>
        <p class="flashcard__text">${flipped ? card.answer : card.question}</p>
        <span class="flashcard__hint">${flipped ? "Bấm để xem lại câu hỏi" : "Bấm để lật xem đáp án"}</span>
      </div>
      <div class="flashcard__nav">
        <button type="button" class="btn btn--ghost btn--sm" data-card="prev" ${index === 0 ? "disabled" : ""}>
          ${icon("arrowLeft", 15)} Trước
        </button>
        <span class="flashcard__count">${index + 1} / ${cards.length}</span>
        <button type="button" class="btn btn--ghost btn--sm" data-card="next" ${index === cards.length - 1 ? "disabled" : ""}>
          Tiếp ${icon("chevronRight", 15)}
        </button>
      </div>
    `);
  };

  paint();

  activeCleanups.push(delegate(pane, "click", "[data-flip]", () => {
    flipped = !flipped;
    paint();
  }));

  activeCleanups.push(delegate(pane, "click", "[data-card]", (_event, target) => {
    const next = index + (target.dataset.card === "next" ? 1 : -1);
    if (next < 0 || next >= cards.length) return;
    index = next;
    flipped = false;
    paint();
  }));
}

export async function openDocument(id) {
  const body = modal.open(loadingState("Đang mở tài liệu…"));

  let doc;
  let ratings;
  try {
    [doc, ratings] = await Promise.all([
      api.get(endpoints.document(id)).then((result) => result.document),
      api.get(endpoints.ratings(id)).catch(() => ({ averageRating: 0, totalReviews: 0, reviews: [] })),
    ]);
  } catch (error) {
    render(body, errorState(error.message));
    return;
  }

  render(body, shell(doc, ratings));

  const tutorPane = body.querySelector('[data-pane="tutor"]');
  const flashcardPane = body.querySelector('[data-pane="flashcards"]');
  mountTutor(tutorPane, doc);

  let flashcardsLoaded = false;
  activeCleanups.push(delegate(body, "click", "[data-tool]", (_event, target) => {
    const tool = target.dataset.tool;
    body.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("is-active", button === target));
    tutorPane.classList.toggle("is-hidden", tool !== "tutor");
    flashcardPane.classList.toggle("is-hidden", tool !== "flashcards");

    if (tool === "flashcards" && !flashcardsLoaded) {
      flashcardsLoaded = true;
      mountFlashcards(flashcardPane, doc);
    }
  }));
}
