import { api, endpoints } from "../core/api.js";
import { html, on, render } from "../core/dom.js";
import { icon } from "../components/icons.js";
import { pageBody, pageHeader } from "../components/page.js";
import { notice } from "../components/states.js";
import { navigate } from "../core/router.js";

const CATEGORIES = ["Tài liệu", "Kiến thức", "Công cụ", "Khác"];
const LEVELS = [
  { value: "all", label: "Mọi trình độ" },
  { value: "beginner", label: "Cơ bản" },
  { value: "intermediate", label: "Trung cấp" },
  { value: "advanced", label: "Nâng cao" },
];
const ACCEPTED = ".pdf,.docx,.xlsx,.pptx,.txt,.md,.png,.jpg,.jpeg,.zip";

export function createUploadView() {
  let cleanups = [];

  return {
    async render(container) {
      render(container, html`
        ${pageHeader({
          eyebrow: "Của tôi",
          title: "Đăng tài liệu",
          sub: "Mô tả càng rõ, agent càng dễ tìm đúng tài liệu cho người khác.",
          iconName: "upload",
        })}
        ${pageBody(html`
          <div class="with-rail">
            <form class="card form" data-upload-form novalidate>
            <label class="field">
              <span class="field__label">Tiêu đề</span>
              <input class="input" name="title" minlength="3" maxlength="150" required
                     placeholder="Ví dụ: Checklist Context Engineering">
            </label>

            <label class="field">
              <span class="field__label">Mô tả</span>
              <textarea class="input" name="summary" minlength="10" maxlength="2000" rows="5" required
                        placeholder="Nội dung gì, dành cho ai, dùng trong bối cảnh nào…"></textarea>
              <span class="field__hint">Đây là phần agent đọc để quyết định có gợi ý tài liệu của bạn hay không.</span>
            </label>

            <div class="field-row">
              <label class="field">
                <span class="field__label">Danh mục</span>
                <select class="input" name="category">
                  ${CATEGORIES.map((category) => html`<option value="${category}">${category}</option>`)}
                </select>
              </label>
              <label class="field">
                <span class="field__label">Trình độ</span>
                <select class="input" name="level">
                  ${LEVELS.map((level) => html`<option value="${level.value}">${level.label}</option>`)}
                </select>
              </label>
            </div>

            <label class="field">
              <span class="field__label">Tags</span>
              <input class="input" name="tags" placeholder="ai, react, agent">
              <span class="field__hint">Phân cách bằng dấu phẩy, tối đa 10 thẻ.</span>
            </label>

            <label class="field">
              <span class="field__label">Tệp đính kèm</span>
              <input class="input" name="file" type="file" accept="${ACCEPTED}" required>
              <span class="field__hint">Tối đa 20 MB. Tệp .txt/.md sẽ được trích xuất nội dung cho RAG.</span>
            </label>

            <div>
              <button class="btn btn--primary" type="submit">Đăng tài liệu</button>
            </div>
            </form>

            <div class="rail">
              <aside class="panel">
                <div class="panel__head">
                  <h2 class="panel__title">${icon("sparkles", 15)} Viết mô tả tốt</h2>
                </div>
                <div class="panel__body stack">
                  <p class="muted">Agent đọc phần mô tả để quyết định có gợi ý tài liệu của bạn hay không. Nên nêu rõ:</p>
                  <ul class="stack">
                    <li class="muted">• Nội dung chính gồm những gì</li>
                    <li class="muted">• Dành cho trình độ nào</li>
                    <li class="muted">• Dùng trong bối cảnh nào</li>
                    <li class="muted">• Công cụ hoặc framework liên quan</li>
                  </ul>
                </div>
              </aside>

              <aside class="panel">
                <div class="panel__head">
                  <h2 class="panel__title">${icon("file", 15)} Định dạng nhận</h2>
                </div>
                <div class="panel__body">
                  <ul class="tags">
                    ${ACCEPTED.split(",").map((ext) => html`<li class="tag">${ext.replace(".", "")}</li>`)}
                  </ul>
                  <p class="muted panel__note">Tối đa 20 MB.</p>
                </div>
              </aside>
            </div>
          </div>

          <div data-upload-status></div>
        `)}
      `);

      const form = container.querySelector("[data-upload-form]");
      const status = container.querySelector("[data-upload-status]");
      const submit = form.querySelector("button[type=submit]");

      cleanups.push(on(form, "submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        submit.disabled = true;
        render(status, notice("Đang tải tệp lên và trích xuất nội dung…", "info"));

        try {
          await api.post(endpoints.documents, new FormData(form));
          form.reset();
          render(status, notice("Đăng tài liệu thành công. Đang chuyển tới kho của bạn…", "success"));
          setTimeout(() => navigate("/my-docs"), 900);
        } catch (error) {
          render(status, notice(error.message, "error"));
        } finally {
          submit.disabled = false;
        }
      }));
    },

    destroy() {
      cleanups.forEach((off) => off());
      cleanups = [];
    },
  };
}
