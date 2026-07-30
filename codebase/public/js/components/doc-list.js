import { api, endpoints } from "../core/api.js";
import { delegate, html, render } from "../core/dom.js";
import { openDocument } from "../views/doc-detail.view.js";
import { icon } from "./icons.js";
import { errorState, loadingState } from "./states.js";

/**
 * Wires the actions every document list shares (open / summarize / archive).
 * Feed and "my documents" differ only in what they fetch, not in behaviour.
 *
 * @returns {() => void} unbind function for the view's destroy()
 */
export function attachDocumentListActions(root, { onChanged } = {}) {
  const offs = [];

  offs.push(delegate(root, "click", '[data-action="open"]', (_event, target) => {
    openDocument(target.dataset.id);
  }));

  offs.push(delegate(root, "click", '[data-action="summarize"]', async (_event, target) => {
    const id = target.dataset.id;
    const slot = root.querySelector(`[data-slot="${CSS.escape(id)}"]`);
    if (!slot) return;

    target.disabled = true;
    render(slot, loadingState("AI đang đọc và tóm tắt…"));
    try {
      const result = await api.post(endpoints.summarize(id));
      render(slot, html`
        <div class="summary">
          <h4 class="summary__title">${icon("sparkles", 15)} Tóm tắt AI</h4>
          <p><strong>Phù hợp với:</strong> ${result.targetAudience}</p>
          <ul class="summary__points">${(result.keyPoints || []).map((point) => html`<li>${point}</li>`)}</ul>
          <p><strong>Khuyến nghị:</strong> ${result.recommendedAction}</p>
        </div>
      `);
    } catch (error) {
      render(slot, errorState(error.message));
    } finally {
      target.disabled = false;
    }
  }));

  offs.push(delegate(root, "click", '[data-action="archive"]', async (_event, target) => {
    if (!window.confirm("Gỡ tài liệu này khỏi kho VShare?")) return;
    target.disabled = true;
    try {
      await api.delete(endpoints.document(target.dataset.id));
      onChanged?.();
    } catch (error) {
      window.alert(error.message);
      target.disabled = false;
    }
  }));

  return () => offs.forEach((off) => off());
}
