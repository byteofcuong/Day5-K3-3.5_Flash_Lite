import { html, on, render } from "../core/dom.js";
import { icon } from "./icons.js";

/**
 * Wraps a native <dialog> so callers get open/close/content without touching
 * the element, and every modal closes the same way (button, Esc, backdrop).
 */
export function createModal({ id, size = "md" }) {
  const dialog = document.createElement("dialog");
  dialog.id = id;
  dialog.className = `modal modal--${size}`;
  render(dialog, html`
    <button type="button" class="modal__close" data-modal-close aria-label="Đóng">${icon("close", 18)}</button>
    <div class="modal__body" data-modal-body></div>
  `);
  document.body.append(dialog);

  const body = dialog.querySelector("[data-modal-body]");
  let onCloseHandler = null;

  on(dialog, "click", (event) => {
    // Clicking the dialog element itself means the backdrop was hit.
    if (event.target === dialog) dialog.close();
    else if (event.target.closest("[data-modal-close]")) dialog.close();
  });

  on(dialog, "close", () => {
    if (onCloseHandler) onCloseHandler();
    render(body, html``);
  });

  return {
    body,
    element: dialog,

    setContent(content) {
      render(body, content);
      return body;
    },

    open(content) {
      if (content) render(body, content);
      if (!dialog.open) dialog.showModal();
      return body;
    },

    close() {
      if (dialog.open) dialog.close();
    },

    onClose(handler) {
      onCloseHandler = handler;
    },
  };
}
