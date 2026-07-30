import { api, endpoints } from "../core/api.js";
import { delegate, html, on, render } from "../core/dom.js";
import { documentCard } from "../components/doc-card.js";
import { attachDocumentListActions } from "../components/doc-list.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { statStrip, statStripSkeleton } from "../components/stats.js";
import { emptyState, errorState, skeletonList } from "../components/states.js";
import { navigate } from "../core/router.js";

const CATEGORIES = ["Tài liệu", "Kiến thức", "Công cụ", "Khác"];

/**
 * Feed composition, wide-screen first:
 *   stat strip → toolbar → [document grid | rail]
 * The strip and the rail are what stop a wide viewport from reading as empty.
 */
export function createFeedView() {
  let cleanups = [];
  const filters = { q: "", category: "all" };

  function topTags(documents, limit = 14) {
    const counts = new Map();
    for (const doc of documents) {
      for (const tag of doc.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  async function loadDocuments(container) {
    const listNode = container.querySelector("[data-list]");
    const countNode = container.querySelector("[data-count]");
    render(listNode, skeletonList(4));

    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.category !== "all") params.set("category", filters.category);

      const { items } = await api.get(`${endpoints.documents}?${params}`);
      countNode.textContent = items.length ? `Hiển thị ${items.length} tài liệu` : "Không có kết quả";

      render(listNode, items.length
        ? html`<div class="card-grid">${items.map((doc) => documentCard(doc))}</div>`
        : emptyState({
            iconName: "search",
            title: "Không tìm thấy tài liệu phù hợp",
            hint: "Thử xoá bớt bộ lọc hoặc dùng từ khoá khác.",
            action: html`<button type="button" class="btn btn--secondary btn--sm" data-clear-filters>Xoá bộ lọc</button>`,
          }));
    } catch (error) {
      render(listNode, errorState(error.message, { retryLabel: "Thử lại" }));
    }
  }

  /** One request set feeds the stat strip, the contributor rail and the tags. */
  async function loadOverview(container) {
    const statsNode = container.querySelector("[data-stats]");
    const railNode = container.querySelector("[data-rail]");
    render(statsNode, statStripSkeleton(4));

    try {
      const [docsResult, contributorsResult, roomsResult] = await Promise.all([
        api.get(endpoints.documents),
        api.get(endpoints.contributors),
        api.get(endpoints.rooms),
      ]);

      const documents = docsResult.items;
      const contributors = contributorsResult.items;
      const rooms = roomsResult.items;
      const withFile = documents.filter((doc) => doc.fileUrl).length;
      const discussions = rooms.reduce((total, room) => total + (room.messageCount || 0), 0);

      render(statsNode, statStrip([
        { label: "Tài liệu", value: documents.length, hint: `${withFile} có tệp đính kèm`, iconName: "feed" },
        { label: "Người đóng góp", value: contributors.length, hint: "đang hoạt động", iconName: "users" },
        { label: "Phòng thảo luận", value: rooms.length, hint: `${discussions} lượt trao đổi`, iconName: "chat" },
        { label: "Danh mục", value: CATEGORIES.length, hint: "phân loại học liệu", iconName: "folder" },
      ]));

      const tags = topTags(documents);
      render(railNode, html`
        <aside class="panel">
          <div class="panel__head">
            <h2 class="panel__title">${icon("users", 15)} Đóng góp nhiều nhất</h2>
          </div>
          <ul class="contributors">
            ${contributors.length
              ? contributors.map((person) => html`
                  <li class="contributor">
                    <span class="contributor__rank">${person.rank}</span>
                    <span class="contributor__avatar" aria-hidden="true">${person.name.charAt(0).toUpperCase()}</span>
                    <span class="contributor__info">
                      <span class="contributor__name">${person.name}</span>
                      <span class="contributor__doc">${person.topDocumentTitle}</span>
                    </span>
                    <span class="contributor__count">${person.documentCount}</span>
                  </li>`)
              : html`<li class="contributor"><span class="muted">Chưa có người đóng góp.</span></li>`}
          </ul>
        </aside>

        ${tags.length
          ? html`<aside class="panel">
              <div class="panel__head">
                <h2 class="panel__title">${icon("search", 15)} Chủ đề phổ biến</h2>
              </div>
              <div class="panel__body">
                <ul class="tags">
                  ${tags.map(([tag, count]) => html`
                    <li><button type="button" class="tag" data-tag="${tag}">${tag} · ${count}</button></li>
                  `)}
                </ul>
              </div>
            </aside>`
          : ""}

        <aside class="panel">
          <div class="panel__head">
            <h2 class="panel__title">${icon("sparkles", 15)} Chưa thấy thứ cần tìm?</h2>
          </div>
          <div class="panel__body stack">
            <p class="muted">Mô tả nhu cầu bằng lời thường — agent sẽ tìm và nêu căn cứ cho từng gợi ý.</p>
            <button type="button" class="btn btn--primary btn--sm btn--block" data-goto-search>
              ${icon("sparkles", 15)} Tìm bằng AI
            </button>
          </div>
        </aside>
      `);
    } catch (error) {
      render(statsNode, errorState(error.message));
    }
  }

  function syncChips(container) {
    container.querySelectorAll("[data-category]").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.category === filters.category);
    });
  }

  return {
    async render(container) {
      render(container, html`
        ${pageHeader({
          eyebrow: "Khám phá",
          title: "Bảng tin",
          sub: "Tài liệu mới nhất được cộng đồng VShare chia sẻ.",
          iconName: "feed",
          actions: html`<button type="button" class="btn btn--primary" data-goto-upload>
            ${icon("plus", 16)} Đăng tài liệu
          </button>`,
        })}
        ${pageBody(html`
          <div data-stats></div>

          <div class="with-rail">
            <div>
              <div class="toolbar">
                <div class="input-group toolbar__search">
                  ${icon("search", 16)}
                  <input class="input" type="search" data-filter-q placeholder="Tìm theo tiêu đề, mô tả hoặc tag…">
                </div>
                <div class="chips">
                  <button type="button" class="chip is-active" data-category="all">Tất cả</button>
                  ${CATEGORIES.map((category) => html`
                    <button type="button" class="chip" data-category="${category}">${category}</button>
                  `)}
                </div>
                <span class="toolbar__spacer"></span>
                <span class="muted" data-count></span>
              </div>

              <div data-list></div>
            </div>

            <div class="rail" data-rail></div>
          </div>
        `)}
      `);

      const searchInput = container.querySelector("[data-filter-q]");
      searchInput.value = filters.q;
      syncChips(container);

      cleanups.push(attachDocumentListActions(container.querySelector("[data-list]"), {
        onChanged: () => { loadDocuments(container); loadOverview(container); },
      }));

      // Debounced so typing does not fire a request per keystroke.
      let debounce;
      cleanups.push(on(searchInput, "input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          filters.q = searchInput.value.trim();
          loadDocuments(container);
        }, 250);
      }));

      cleanups.push(delegate(container, "click", "[data-category]", (_event, target) => {
        filters.category = target.dataset.category;
        syncChips(container);
        loadDocuments(container);
      }));

      cleanups.push(delegate(container, "click", "[data-tag]", (_event, target) => {
        filters.q = target.dataset.tag;
        searchInput.value = filters.q;
        loadDocuments(container);
      }));

      cleanups.push(delegate(container, "click", "[data-clear-filters]", () => {
        filters.q = "";
        filters.category = "all";
        searchInput.value = "";
        syncChips(container);
        loadDocuments(container);
      }));

      cleanups.push(delegate(container, "click", "[data-goto-upload]", () => navigate("/upload")));
      cleanups.push(delegate(container, "click", "[data-goto-search]", () => navigate("/search")));
      cleanups.push(delegate(container, "click", "[data-retry]", () => loadDocuments(container)));

      await Promise.all([loadDocuments(container), loadOverview(container)]);
    },

    destroy() {
      cleanups.forEach((off) => off());
      cleanups = [];
    },
  };
}
