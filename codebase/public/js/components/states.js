import { html } from "../core/dom.js";
import { icon } from "./icons.js";

/** Shared loading / empty / error blocks so every view speaks the same language. */

/** Small inline spinner + label. Use when the wait is short or nested. */
export const loadingState = (message = "Đang tải…") => html`
  <div class="state state--inline" role="status">
    <span class="spinner" aria-hidden="true"></span>
    <span>${message}</span>
  </div>
`;

/**
 * Skeleton placeholders that mirror the shape of the content being loaded, so
 * the layout does not jump once data arrives.
 */
export const skeletonList = (count = 3) => html`
  <div class="stack" aria-hidden="true">
    ${Array.from({ length: count }, () => html`
      <div class="skeleton-card">
        <div class="skeleton skeleton--chip"></div>
        <div class="skeleton skeleton--title"></div>
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--short"></div>
      </div>
    `)}
  </div>
`;

export const emptyState = ({ iconName = "file", title, hint = "", action = "" }) => html`
  <div class="state">
    <span class="state__icon">${icon(iconName, 22)}</span>
    <p class="state__title">${title}</p>
    ${hint ? html`<p class="state__hint">${hint}</p>` : ""}
    ${action}
  </div>
`;

export const errorState = (message, { retryLabel = "" } = {}) => html`
  <div class="state state--error" role="alert">
    <span class="state__icon">${icon("info", 22)}</span>
    <p class="state__title">Không tải được dữ liệu</p>
    <p class="state__hint">${message}</p>
    ${retryLabel ? html`<button type="button" class="btn btn--secondary btn--sm" data-retry>${retryLabel}</button>` : ""}
  </div>
`;

export const notice = (message, variant = "info") => html`
  <div class="notice notice--${variant}">
    ${icon(variant === "error" ? "info" : variant === "success" ? "check" : "info", 16)}
    <span>${message}</span>
  </div>
`;
