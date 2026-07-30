/**
 * DOM helpers built around an auto-escaping template tag.
 *
 * Every value interpolated into `html` is escaped unless it is explicitly
 * wrapped in `raw()`. That makes injection the exception you have to opt into,
 * instead of something each call site has to remember to prevent.
 */

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

/** Marks a string as already-safe markup. Use only on markup you produced. */
export const raw = (value) => new SafeHtml(String(value ?? ""));

export const isSafeHtml = (value) => value instanceof SafeHtml;

function interpolate(value) {
  if (value === null || value === undefined || value === false) return "";
  if (isSafeHtml(value)) return value.value;
  if (Array.isArray(value)) return value.map(interpolate).join("");
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let output = "";
  strings.forEach((chunk, index) => {
    output += chunk;
    if (index < values.length) output += interpolate(values[index]);
  });
  return new SafeHtml(output);
}

/** Blocks javascript:/data: URLs before they reach an href or iframe src. */
export function safeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:|\/|\.\/|#)/i.test(url)) return url;
  return "";
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Replaces a node's content. Accepts SafeHtml; plain strings are escaped. */
export function render(node, content) {
  if (!node) return null;
  node.innerHTML = isSafeHtml(content) ? content.value : escapeHtml(content);
  return node;
}

/** Appends to a node's content, same escaping rules as render(). */
export function append(node, content) {
  if (!node) return null;
  node.insertAdjacentHTML("beforeend", isSafeHtml(content) ? content.value : escapeHtml(content));
  return node.lastElementChild;
}

/**
 * Delegated event binding. Handlers survive re-renders because the listener
 * lives on a stable ancestor, not on the elements being replaced.
 * @returns {() => void} unbind function
 */
export function delegate(root, eventName, selector, handler) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(eventName, listener);
  return () => root.removeEventListener(eventName, listener);
}

export function on(node, eventName, handler, options) {
  node.addEventListener(eventName, handler, options);
  return () => node.removeEventListener(eventName, handler, options);
}

export function scrollToBottom(node) {
  if (node) requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
}

export function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN");
}
