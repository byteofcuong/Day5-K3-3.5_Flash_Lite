import { endpoints } from "../core/api.js";
import { formatDate, html } from "../core/dom.js";
import { icon } from "./icons.js";

const LEVEL_LABELS = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
  all: "Mọi trình độ",
};

export const levelLabel = (level) => LEVEL_LABELS[level] || level || "Mọi trình độ";

export function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export const tagList = (tags = []) => html`
  <ul class="tags">${tags.map((tag) => html`<li class="tag">${tag}</li>`)}</ul>
`;

const CATEGORY_SLUGS = {
  "Tài liệu": "tai-lieu",
  "Kiến thức": "kien-thuc",
  "Công cụ": "cong-cu",
  "Khác": "khac",
};

/** Category pills are colour-coded so the feed is scannable at a glance. */
export function categoryBadge(category) {
  const label = category || "Tài liệu";
  return html`<span class="badge badge--cat-${CATEGORY_SLUGS[label] || "khac"}">${label}</span>`;
}

/**
 * One document card.
 * Actions are declared with data-* attributes and handled by the parent view
 * through delegation — no inline handlers, no globals.
 */
export function documentCard(doc, { owned = false } = {}) {
  return html`
    <article class="card card--interactive doc-card ${doc.available === false ? "is-archived" : ""}" data-doc-id="${doc.id}">
      <div class="doc-card__head">
        <p class="doc-card__meta">
          <span class="doc-card__avatar" aria-hidden="true">
            ${String(doc.ownerName || doc.source || "V").charAt(0).toUpperCase()}
          </span>
          <span class="doc-card__owner">${doc.ownerName || doc.source || "VShare"}</span>
          ${doc.date ? html`<span class="dot">·</span><time>${formatDate(doc.date)}</time>` : ""}
          <span class="dot">·</span>
          ${categoryBadge(doc.category)}
          <span class="badge">${levelLabel(doc.level)}</span>
        </p>
        <h3 class="doc-card__title">${doc.title}</h3>
      </div>

      <p class="doc-card__summary">${doc.summary}</p>

      ${doc.fileName
        ? html`<p class="doc-card__file">
            ${icon("file", 14)}
            <span>${doc.fileName}${doc.sizeBytes ? html` · ${formatSize(doc.sizeBytes)}` : ""}</span>
          </p>`
        : ""}

      ${doc.tags?.length ? tagList(doc.tags) : ""}

      ${doc.available === false
        ? html`<p class="doc-card__flag">${icon("info", 14)} Đã gỡ khỏi kho — chỉ bạn nhìn thấy.</p>`
        : ""}

      <div class="doc-card__actions">
        <button type="button" class="btn btn--primary btn--sm" data-action="open" data-id="${doc.id}">
          Mở tài liệu
        </button>
        <button type="button" class="btn btn--secondary btn--sm" data-action="summarize" data-id="${doc.id}">
          ${icon("sparkles", 15)} Tóm tắt
        </button>
        ${doc.fileUrl
          ? html`<a class="btn btn--ghost btn--sm" href="${endpoints.download(doc.id)}" target="_blank" rel="noopener">
              ${icon("download", 15)} Tải tệp
            </a>`
          : ""}
        ${owned && doc.available !== false
          ? html`<button type="button" class="btn btn--danger btn--sm btn--icon" data-action="archive" data-id="${doc.id}" aria-label="Gỡ tài liệu">
              ${icon("trash", 15)}
            </button>`
          : ""}
      </div>

      <div class="doc-card__slot" data-slot="${doc.id}"></div>
    </article>
  `;
}
