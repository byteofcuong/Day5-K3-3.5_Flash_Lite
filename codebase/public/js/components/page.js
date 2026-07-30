import { html } from "../core/dom.js";
import { icon } from "./icons.js";

/**
 * Page chrome shared by every view: a sticky header carrying the screen's
 * identity plus its primary actions, then the scrolling body.
 *
 * The `hue` sets --hue / --hue-soft for the whole screen, which the nav item,
 * the header tile and any accent inside the page all read from. That is what
 * makes each section visually distinct without hardcoding colours per view.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.hue]      section key: feed | search | chat | rooms | upload | mine
 * @param {string} [options.iconName] icon shown in the tinted tile
 */
export const pageHeader = ({ eyebrow = "", title, sub = "", iconName = "", actions = "" }) => html`
  <header class="page-head">
    <div class="page-head__inner">
      <div class="page-head__lead">
        ${iconName ? html`<span class="page-head__icon">${icon(iconName, 22)}</span>` : ""}
        <div>
          ${eyebrow ? html`<p class="page-head__eyebrow">${eyebrow}</p>` : ""}
          <h1 class="page-head__title">${title}</h1>
          ${sub ? html`<p class="page-head__sub">${sub}</p>` : ""}
        </div>
      </div>
      ${actions ? html`<div class="page-head__actions">${actions}</div>` : ""}
    </div>
  </header>
`;

/**
 * @param {"default"|"narrow"|"flush"} [options.width]
 */
export const pageBody = (content, { width = "default" } = {}) => html`
  <div class="page-body ${width === "narrow" ? "page-body--narrow" : width === "flush" ? "page-body--flush" : ""}">
    <div class="page-body__inner">${content}</div>
  </div>
`;
