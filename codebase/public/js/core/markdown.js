import { escapeHtml, raw } from "./dom.js";

/**
 * Renders the small subset of Markdown the AI actually emits.
 * Escaping happens first, so no model output can inject markup.
 */
export function renderMarkdown(text, linkedDocuments = []) {
  if (!text) return raw("");

  let output = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[*-]\s+(.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*<\/li>)/, "<ul>$1</ul>")
    .replace(/\n/g, "<br>");

  // Turn document titles the model mentioned into clickable chips.
  for (const doc of linkedDocuments) {
    const title = escapeHtml(doc.title);
    if (!title) continue;
    const chip = `<button type="button" class="doc-chip" data-open-doc="${escapeHtml(doc.id)}">📄 ${title}</button>`;
    const pattern = new RegExp(`<strong>&quot;${escapeRegExp(title)}&quot;</strong>|&quot;${escapeRegExp(title)}&quot;|<strong>${escapeRegExp(title)}</strong>`, "g");
    output = output.replace(pattern, chip);
  }

  return raw(output);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
