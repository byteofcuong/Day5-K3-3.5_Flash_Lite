import { api, endpoints } from "../core/api.js";
import { html, on, render } from "../core/dom.js";
import { documentCard } from "../components/doc-card.js";
import { attachDocumentListActions } from "../components/doc-list.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { emptyState, errorState, skeletonList } from "../components/states.js";

const CATEGORIES = ["Tài liệu", "Kiến thức", "Công cụ", "Khác"];

export function createFeedView() {
  let cleanups = [];
  const filters = { q: "", category: "all" };

  async function loadDocuments(listNode, countNode) {
    render(listNode, skeletonList(3));
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.category !== "all") params.set("category", filters.category);

      const { items } = await api.get(`${endpoints.documents}?${params}`);
      countNode.textContent = items.length ? `${items.length} tài liệu` : "";

      render(listNode, items.length
        ? html`${items.map((doc) => documentCard(doc))}`
        : emptyState({
            iconName: "search",
            title: "Không tìm thấy tài liệu phù hợp",
            hint: "Thử xoá bớt bộ lọc hoặc dùng từ khoá khác.",
          }));
    } catch (error) {
      render(listNode, errorState(error.message, { retryLabel: "Thử lại" }));
    }
  }

  async function loadContributors(node) {
    try {
      const { items } = await api.get(endpoints.contributors);
      render(node, items.length
        ? html`${items.map((person) => html`
            <li class="contributor">
              <span class="contributor__rank">${person.rank}</span>
              <span class="contributor__avatar" aria-hidden="true">${person.name.charAt(0).toUpperCase()}</span>
              <span class="contributor__info">
                <span class="contributor__name">${person.name}</span>
                <span class="contributor__doc">${person.topDocumentTitle}</span>
              </span>
              <span class="contributor__count">${person.documentCount}</span>
            </li>`)}`
        : html`<li class="contributor"><span class="muted">Chưa có người đóng góp.</span></li>`);
    } catch {
      render(node, html`<li class="contributor"><span class="muted">Không tải được.</span></li>`);
    }
  }

  return {
    async render(container) {
      render(container, html`
        ${pageHeader({
          eyebrow: "Khám phá",
          title: "Bảng tin",
          sub: "Tài liệu mới nhất được cộng đồng VShare chia sẻ.",
          iconName: "feed",
        })}
        ${pageBody(html`
          <div class="split">
            <div>
              <div class="toolbar">
                <div class="input-group toolbar__search">
                  ${icon("search", 16)}
                  <input class="input" type="search" data-filter-q placeholder="Tìm theo tiêu đề, mô tả hoặc tag…">
                </div>
                <select class="input toolbar__filter" data-filter-category>
                  <option value="all">Tất cả danh mục</option>
                  ${CATEGORIES.map((category) => html`<option value="${category}">${category}</option>`)}
                </select>
              </div>

              <p class="muted" data-count></p>
              <div class="stack" data-list></div>
            </div>

            <aside class="panel">
              <div class="panel__head">
                <h2 class="panel__title">${icon("users", 16)} Đóng góp nhiều nhất</h2>
              </div>
              <ul class="contributors" data-contributors></ul>
            </aside>
          </div>
        `)}
      `);

      const listNode = container.querySelector("[data-list]");
      const countNode = container.querySelector("[data-count]");
      const searchInput = container.querySelector("[data-filter-q]");
      const categorySelect = container.querySelector("[data-filter-category]");

      searchInput.value = filters.q;
      categorySelect.value = filters.category;

      cleanups.push(attachDocumentListActions(listNode, { onChanged: () => loadDocuments(listNode, countNode) }));

      // Debounced so typing does not fire a request per keystroke.
      let debounce;
      cleanups.push(on(searchInput, "input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          filters.q = searchInput.value.trim();
          loadDocuments(listNode, countNode);
        }, 250);
      }));

      cleanups.push(on(categorySelect, "change", () => {
        filters.category = categorySelect.value;
        loadDocuments(listNode, countNode);
      }));

      cleanups.push(on(listNode, "click", (event) => {
        if (event.target.closest("[data-retry]")) loadDocuments(listNode, countNode);
      }));

      await Promise.all([
        loadDocuments(listNode, countNode),
        loadContributors(container.querySelector("[data-contributors]")),
      ]);
    },

    destroy() {
      cleanups.forEach((off) => off());
      cleanups = [];
    },
  };
}
