import { api, endpoints } from "../core/api.js";
import { html, on, render } from "../core/dom.js";
import { documentCard } from "../components/doc-card.js";
import { attachDocumentListActions } from "../components/doc-list.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { emptyState, errorState, skeletonList } from "../components/states.js";
import { navigate } from "../core/router.js";

export function createMyDocsView() {
  let cleanups = [];

  async function load(listNode) {
    render(listNode, skeletonList(2));
    try {
      const { items } = await api.get(endpoints.myDocuments);
      render(listNode, items.length
        ? html`${items.map((doc) => documentCard(doc, { owned: true }))}`
        : emptyState({
            iconName: "folder",
            title: "Bạn chưa đăng tài liệu nào",
            hint: "Chia sẻ tài liệu đầu tiên để nó xuất hiện trong kho VShare.",
            action: html`<button type="button" class="btn btn--primary btn--sm" data-goto-upload>Đăng tài liệu</button>`,
          }));
    } catch (error) {
      render(listNode, errorState(error.message, { retryLabel: "Thử lại" }));
    }
  }

  return {
    async render(container) {
      render(container, html`
        ${pageHeader({
          eyebrow: "Của tôi",
          title: "Tài liệu của tôi",
          sub: "Tài liệu đã gỡ vẫn hiển thị ở đây nhưng không xuất hiện trong kho chung.",
          iconName: "folder",
          actions: html`<button type="button" class="btn btn--primary" data-goto-upload>
            ${icon("plus", 16)} Đăng tài liệu
          </button>`,
        })}
        ${pageBody(html`<div class="stack" data-list></div>`, { width: "narrow" })}
      `);

      const listNode = container.querySelector("[data-list]");

      cleanups.push(attachDocumentListActions(listNode, { onChanged: () => load(listNode) }));
      cleanups.push(on(container, "click", (event) => {
        if (event.target.closest("[data-goto-upload]")) navigate("/upload");
        if (event.target.closest("[data-retry]")) load(listNode);
      }));

      await load(listNode);
    },

    destroy() {
      cleanups.forEach((off) => off());
      cleanups = [];
    },
  };
}
