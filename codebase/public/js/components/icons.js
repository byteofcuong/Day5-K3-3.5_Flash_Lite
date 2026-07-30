import { raw } from "../core/dom.js";

/**
 * Inline SVG icon set.
 *
 * Icons are inlined rather than loaded from a sprite or a CDN because the app
 * ships with no build step and no external requests. All of them are 20×20,
 * 1.5px stroke, and inherit `currentColor` so a single CSS rule controls them.
 */

const svg = (paths, size) => raw(
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" `
  + `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" `
  + `aria-hidden="true">${paths}</svg>`,
);

const PATHS = {
  feed: '<rect x="2.5" y="3" width="15" height="4.5" rx="1.2"/><rect x="2.5" y="10.5" width="15" height="6.5" rx="1.2"/>',
  sparkles: '<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/><path d="M15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  chat: '<path d="M17 11.5a2.5 2.5 0 01-2.5 2.5H8l-4 3v-3H5.5A2.5 2.5 0 013 11.5v-6A2.5 2.5 0 015.5 3h9A2.5 2.5 0 0117 5.5z"/>',
  users: '<circle cx="7.5" cy="7" r="2.75"/><path d="M2.5 16.5c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2"/><path d="M13.5 4.6a2.75 2.75 0 010 5.3M14.5 12.7c2 .5 3.2 1.9 3.2 3.8"/>',
  upload: '<path d="M10 13.5V3.5"/><path d="M6.5 7L10 3.5 13.5 7"/><path d="M3.5 13v2.5a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5V13"/>',
  folder: '<path d="M2.5 6a1.5 1.5 0 011.5-1.5h3.1a1.5 1.5 0 011.2.6l.9 1.2h6.3A1.5 1.5 0 0117 7.8v6.7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5z"/>',
  logout: '<path d="M8 17H4.5A1.5 1.5 0 013 15.5v-11A1.5 1.5 0 014.5 3H8"/><path d="M13 13.5L16.5 10 13 6.5"/><path d="M16.5 10H7.5"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  download: '<path d="M10 3v9"/><path d="M6.5 8.5L10 12l3.5-3.5"/><path d="M3.5 14v1.5A1.5 1.5 0 005 17h10a1.5 1.5 0 001.5-1.5V14"/>',
  external: '<path d="M11 3h6v6"/><path d="M17 3l-7.5 7.5"/><path d="M15 12v3.5A1.5 1.5 0 0113.5 17h-9A1.5 1.5 0 013 15.5v-9A1.5 1.5 0 014.5 5H8"/>',
  file: '<path d="M11.5 2.5H6A1.5 1.5 0 004.5 4v12A1.5 1.5 0 006 17.5h8a1.5 1.5 0 001.5-1.5V6.5z"/><path d="M11.5 2.5v4h4"/>',
  search: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/>',
  star: '<path d="M10 3l2.1 4.4 4.7.6-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7L3.2 8l4.7-.6z"/>',
  menu: '<path d="M3 6h14M3 10h14M3 14h14"/>',
  chevronRight: '<path d="M8 5l4.5 5L8 15"/>',
  arrowLeft: '<path d="M12 5l-4.5 5L12 15"/>',
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  trash: '<path d="M3.5 5.5h13"/><path d="M8 5.5V4a1 1 0 011-1h2a1 1 0 011 1v1.5"/><path d="M5 5.5l.7 10a1.5 1.5 0 001.5 1.4h5.6a1.5 1.5 0 001.5-1.4l.7-10"/>',
  cards: '<rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="M2.5 8.5h15"/>',
  send: '<path d="M17 3L9 11"/><path d="M17 3l-5.2 14-2.8-6-6-2.8z"/>',
  info: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5"/><path d="M10 6.6h.01"/>',
  check: '<path d="M4.5 10.5l3.5 3.5 7.5-8"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {number} [size=20]
 */
export function icon(name, size = 20) {
  const path = PATHS[name];
  if (!path) return raw("");
  return svg(path, size);
}

export const iconNames = Object.keys(PATHS);
