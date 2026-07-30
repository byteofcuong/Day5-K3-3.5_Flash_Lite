import { api, endpoints } from "../core/api.js";
import { delegate, html, on, render } from "../core/dom.js";
import { categoryBadge, levelLabel, tagList } from "../components/doc-card.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { emptyState, errorState, loadingState } from "../components/states.js";
import { openDocument } from "./doc-detail.view.js";

/**
 * AI search results.
 *
 * Spec §4b requires each result to show its confidence (G2) and the reason it
 * was picked (G11); §6 requires distinct low-confidence, empty and refusal
 * paths. Each of those is a branch in renderOutcome().
 */

const EXAMPLES = [
  "Tài liệu ReAct cho người mới bắt đầu",
  "Cách viết system instruction cho RAG",
  "Khi nào nên dùng AI Agent",
];

function confidenceMeter(confidence) {
  const percent = Math.round((Number(confidence) || 0) * 100);
  const level = percent >= 75 ? "high" : percent >= 45 ? "medium" : "low";
  const label = { high: "Căn cứ mạnh", medium: "Căn cứ vừa", low: "Căn cứ yếu" }[level];
  return html`
    <div class="confidence confidence--${level}" title="Độ tin cậy ${percent}%">
      <span class="confidence__label">${label}</span>
      <span class="confidence__track"><span class="confidence__fill" style="width:${percent}%"></span></span>
      <span class="confidence__label">${percent}%</span>
    </div>
  `;
}

function resultCard(item, index) {
  const doc = item.document;
  return html`
    <article class="card card--interactive result-card">
      <div class="result-card__top">
        <span class="result-card__rank">${index + 1}</span>
        <div>
          <h3 class="result-card__title">${doc.title}</h3>
          <p class="result-card__meta">
            <span class="badge badge--hue">${levelLabel(doc.level)}</span>
            ${categoryBadge(doc.category)}
            <span class="dot">·</span>
            <span>${doc.source || "VShare"}</span>
          </p>
        </div>
      </div>

      ${confidenceMeter(item.confidence)}

      <p class="result-card__reason">${item.reason}</p>
      <p class="muted">${doc.summary}</p>
      ${doc.tags?.length ? tagList(doc.tags) : ""}

      <div class="result-card__actions">
        <button type="button" class="btn btn--primary btn--sm" data-open="${doc.id}">Mở tài liệu</button>
        ${doc.fileUrl
          ? html`<a class="btn btn--ghost btn--sm" href="${endpoints.download(doc.id)}" target="_blank" rel="noopener">
              ${icon("download", 15)} Tải tệp
            </a>`
          : ""}
      </div>
    </article>
  `;
}

/** Shown before the first search — the screen explains itself instead of sitting empty. */
function idlePanel() {
  return html`
    <div class="rules">
      <div class="rule">
        <span class="rule__num">01</span>
        <h3 class="rule__title">Chỉ tìm trong kho VShare</h3>
        <p class="rule__body">Agent không tra cứu ngoài internet. Mọi gợi ý đều là tài liệu có thật trong kho.</p>
      </div>
      <div class="rule">
        <span class="rule__num">02</span>
        <h3 class="rule__title">Luôn nêu căn cứ</h3>
        <p class="rule__body">Mỗi kết quả kèm lý do được chọn và mức độ tin cậy, truy về tiêu đề, mô tả và thẻ.</p>
      </div>
      <div class="rule">
        <span class="rule__num">03</span>
        <h3 class="rule__title">Thiếu căn cứ thì hỏi lại</h3>
        <p class="rule__body">Nếu truy vấn quá mơ hồ, agent hỏi thêm thay vì đoán bừa một tài liệu.</p>
      </div>
    </div>
  `;
}

function renderOutcome(node, data) {
  if (data.status === "clarify" && data.clarifyingQuestion) {
    render(node, html`
      <div class="callout callout--warn">
        <span class="callout__icon">${icon("info", 18)}</span>
        <div>
          <h3 class="callout__title">Agent cần bạn nói rõ hơn</h3>
          <p class="callout__body">${data.clarifyingQuestion}</p>
          <p class="muted">Chưa hiển thị gợi ý nào cho tới khi đủ căn cứ.</p>
        </div>
      </div>
    `);
    return;
  }

  if (data.status === "refuse") {
    render(node, html`
      <div class="callout callout--danger">
        <span class="callout__icon">${icon("info", 18)}</span>
        <div>
          <h3 class="callout__title">Yêu cầu nằm ngoài phạm vi</h3>
          <p class="callout__body">${data.message}</p>
        </div>
      </div>
    `);
    return;
  }

  if (!data.results?.length) {
    render(node, emptyState({
      iconName: "search",
      title: data.message || "Không tìm thấy tài liệu có căn cứ",
      hint: "Agent chỉ trả kết quả tồn tại trong kho VShare. Thử mô tả rõ chủ đề, trình độ hoặc công cụ bạn đang dùng.",
    }));
    return;
  }

  render(node, html`
    <p class="result-summary">
      <span>${data.message}</span>
      <span class="dot">·</span>
      <span class="badge badge--outline">chế độ ${data.mode}</span>
      <span class="badge badge--outline">quét ${data.catalogSize} tài liệu</span>
      ${data.groundingRejected
        ? html`<span class="badge badge--warning">loại ${data.groundingRejected} kết quả không có căn cứ</span>`
        : ""}
    </p>
    <div class="stack">${data.results.map((item, index) => resultCard(item, index))}</div>
  `);
}

export function createSearchView() {
  let cleanups = [];
  let inFlight = null;

  return {
    async render(container) {
      render(container, html`
        ${pageHeader({
          eyebrow: "AI Search",
          title: "Tìm học liệu có căn cứ",
          sub: "Agent chỉ tìm trong kho VShare và luôn nêu lý do cho từng gợi ý.",
          iconName: "sparkles",
        })}
        ${pageBody(html`
          <div class="search-hero">
            <h2 class="search-hero__title">Bạn đang cần học liệu gì?</h2>
            <p class="search-hero__lead">
              Mô tả nhu cầu bằng lời thường. Nếu không đủ căn cứ, agent sẽ hỏi lại
              thay vì đoán bừa.
            </p>

            <form class="searchbar" data-search-form>
              ${icon("search", 18)}
              <input class="input" data-query name="query" maxlength="500" required
                     placeholder="Ví dụ: tài liệu ReAct cho người mới bắt đầu" autocomplete="off">
              <button class="btn btn--primary" type="submit">Tìm</button>
            </form>

            <div class="search-examples">
              ${EXAMPLES.map((example) => html`
                <button type="button" class="search-example" data-example="${example}">${example}</button>
              `)}
            </div>
          </div>

          <div data-results>${idlePanel()}</div>
        `)}
      `);

      const form = container.querySelector("[data-search-form]");
      const input = container.querySelector("[data-query]");
      const results = container.querySelector("[data-results]");
      const submit = form.querySelector("button");

      cleanups.push(delegate(results, "click", "[data-open]", (_event, target) => openDocument(target.dataset.open)));

      cleanups.push(delegate(container, "click", "[data-example]", (_event, target) => {
        input.value = target.dataset.example;
        form.requestSubmit();
      }));

      cleanups.push(on(form, "submit", async (event) => {
        event.preventDefault();
        const query = input.value.trim();
        if (query.length < 2) return;

        // A newer query supersedes the one still in flight.
        inFlight?.abort();
        const controller = new AbortController();
        inFlight = controller;

        submit.disabled = true;
        render(results, loadingState("Agent đang đọc kho VShare và suy luận…"));

        try {
          const data = await api.post(endpoints.search, { query }, { signal: controller.signal });
          renderOutcome(results, data);
        } catch (error) {
          if (error.name === "AbortError") return;
          render(results, errorState(error.message));
        } finally {
          if (inFlight === controller) inFlight = null;
          submit.disabled = false;
        }
      }));

      input.focus();
    },

    destroy() {
      inFlight?.abort();
      inFlight = null;
      cleanups.forEach((off) => off());
      cleanups = [];
    },
  };
}
