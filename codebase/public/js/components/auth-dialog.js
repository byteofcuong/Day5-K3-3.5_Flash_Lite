import { html, on, render } from "../core/dom.js";
import { login, register } from "../state/session.js";
import { createModal } from "./modal.js";
import { notice } from "./states.js";

const modal = createModal({ id: "auth-modal", size: "sm" });

function template(mode) {
  const isRegister = mode === "register";
  return html`
    <h2 class="modal__title">${isRegister ? "Tạo tài khoản VShare" : "Đăng nhập"}</h2>
    <p class="modal__lead">
      ${isRegister
        ? "Tài khoản cho phép bạn đăng tài liệu và tham gia phòng thảo luận."
        : "Đăng nhập để đăng tài liệu và thảo luận cùng cộng đồng."}
    </p>

    <form class="form" data-auth-form novalidate>
      ${isRegister
        ? html`
            <label class="field">
              <span class="field__label">Họ tên</span>
              <input class="input" name="displayName" minlength="2" maxlength="60" required autocomplete="name">
            </label>`
        : ""}
      <label class="field">
        <span class="field__label">Email</span>
        <input class="input" name="email" type="email" required autocomplete="email">
      </label>
      <label class="field">
        <span class="field__label">Mật khẩu</span>
        <input class="input" name="password" type="password" minlength="8" required
               autocomplete="${isRegister ? "new-password" : "current-password"}">
        ${isRegister ? html`<span class="field__hint">Ít nhất 8 ký tự.</span>` : ""}
      </label>
      <button class="btn btn--primary btn--block btn--lg" type="submit">
        ${isRegister ? "Tạo tài khoản" : "Đăng nhập"}
      </button>
    </form>

    <div data-auth-status></div>

    <p class="modal__footnote">
      ${isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
      <button type="button" class="link" data-switch-mode="${isRegister ? "login" : "register"}">
        ${isRegister ? "Đăng nhập" : "Đăng ký"}
      </button>
    </p>

    <p class="modal__demo">Tài khoản demo · <code>viet@vshare.local</code> · <code>VShare@2026</code></p>
  `;
}

export function openAuthDialog(mode = "login") {
  const body = modal.open(template(mode));
  const form = body.querySelector("[data-auth-form]");
  const status = body.querySelector("[data-auth-status]");
  const submit = form.querySelector("button[type=submit]");

  on(body, "click", (event) => {
    const switcher = event.target.closest("[data-switch-mode]");
    if (switcher) openAuthDialog(switcher.dataset.switchMode);
  });

  on(form, "submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const values = Object.fromEntries(new FormData(form));
    submit.disabled = true;
    render(status, html``);

    try {
      if (mode === "register") await register(values);
      else await login(values);
      modal.close();
    } catch (error) {
      render(status, notice(error.message, "error"));
    } finally {
      submit.disabled = false;
    }
  });

  form.querySelector("input")?.focus();
}
