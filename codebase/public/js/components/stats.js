import { html } from "../core/dom.js";
import { icon } from "./icons.js";

/**
 * Stat strip shown at the top of a page.
 *
 * Its job is compositional as much as informational: a wide screen with a
 * single column of cards reads as empty, and a row of real numbers anchors the
 * top of the layout. Values come from data the view already fetched — nothing
 * here is invented.
 *
 * @param {{label: string, value: string|number, hint?: string, iconName?: string}[]} tiles
 */
export const statStrip = (tiles) => html`
  <div class="stats">
    ${tiles.map((tile) => html`
      <div class="stat-tile">
        <span class="stat-tile__label">
          ${tile.iconName ? icon(tile.iconName, 13) : ""}
          <span>${tile.label}</span>
        </span>
        <span class="stat-tile__value">${tile.value}</span>
        ${tile.hint ? html`<span class="stat-tile__hint">${tile.hint}</span>` : ""}
      </div>
    `)}
  </div>
`;

/** Skeleton with the same shape, so the strip does not pop in. */
export const statStripSkeleton = (count = 4) => html`
  <div class="stats" aria-hidden="true">
    ${Array.from({ length: count }, () => html`
      <div class="stat-tile">
        <div class="skeleton skeleton--chip"></div>
        <div class="skeleton skeleton--title"></div>
      </div>
    `)}
  </div>
`;
