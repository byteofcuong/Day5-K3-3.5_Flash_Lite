import { $, delegate, html, render } from "./core/dom.js";
import { createRouter, navigate, onRouteChange, parseHash } from "./core/router.js";
import { isAuthenticated, logout, restoreSession, session } from "./state/session.js";
import { mountAssistant } from "./components/assistant.js";
import { openAuthDialog } from "./components/auth-dialog.js";
import { icon } from "./components/icons.js";
import { createFeedView } from "./views/feed.view.js";
import { createSearchView } from "./views/search.view.js";
import { createRoomsView } from "./views/rooms.view.js";
import { createUploadView } from "./views/upload.view.js";
import { createMyDocsView } from "./views/my-docs.view.js";

/**
 * Application bootstrap: one route table, a sidebar rendered from it, and one
 * place that reacts to the session changing.
 *
 * The AI assistant is deliberately NOT a route — it is a floating widget
 * mounted once, so it stays reachable while you are reading or uploading.
 */

const routes = [
  { id: "feed", path: "/feed", label: "Bảng tin", icon: "feed", group: "Khám phá", title: "Bảng tin", view: createFeedView() },
  { id: "search", path: "/search", label: "Tìm bằng AI", icon: "sparkles", group: "Khám phá", title: "Tìm bằng AI", view: createSearchView() },
  { id: "rooms", path: "/rooms", label: "Phòng thảo luận", icon: "users", group: "Khám phá", title: "Phòng thảo luận", view: createRoomsView() },
  { id: "upload", path: "/upload", label: "Đăng tài liệu", icon: "upload", group: "Của tôi", title: "Đăng tài liệu", view: createUploadView(), protected: true },
  { id: "my-docs", path: "/my-docs", label: "Tài liệu của tôi", icon: "folder", group: "Của tôi", title: "Tài liệu của tôi", view: createMyDocsView(), protected: true },
];

const nav = $("[data-nav]");
const accountSlot = $("[data-account]");
const sidebar = $("[data-sidebar]");
const scrim = $("[data-sidebar-scrim]");

function renderNav(activeId) {
  const visible = routes.filter((route) => !route.protected || isAuthenticated());
  const groups = [];
  for (const route of visible) {
    const last = groups.at(-1);
    if (last?.name === route.group) last.items.push(route);
    else groups.push({ name: route.group, items: [route] });
  }

  // data-hue makes each item carry its own section colour when active.
  render(nav, html`${groups.map((group) => html`
    <p class="nav__group-label">${group.name}</p>
    ${group.items.map((route) => html`
      <a class="nav__link ${route.id === activeId ? "is-active" : ""}"
         data-hue="${route.id}" href="#${route.path}">
        <span class="nav__icon">${icon(route.icon, 16)}</span>
        <span>${route.label}</span>
      </a>
    `)}
  `)}`);
}

function renderAccount() {
  const { status, user } = session.get();

  if (status === "authenticated") {
    render(accountSlot, html`
      <div class="account">
        <span class="account__avatar" aria-hidden="true">${user.displayName.charAt(0).toUpperCase()}</span>
        <span class="account__info">
          <span class="account__name">${user.displayName}</span>
          <span class="account__role">${user.role === "admin" ? "Quản trị viên" : "Thành viên"}</span>
        </span>
        <button type="button" class="btn btn--ghost btn--sm btn--icon" data-logout aria-label="Đăng xuất">
          ${icon("logout", 16)}
        </button>
      </div>
    `);
    return;
  }

  render(accountSlot, html`
    <div class="account account--guest">
      <button type="button" class="btn btn--primary btn--sm btn--block" data-auth="register">Tạo tài khoản</button>
      <button type="button" class="btn btn--ghost btn--sm btn--block" data-auth="login">Đăng nhập</button>
    </div>
  `);
}

/* --- Mobile drawer --- */

function setSidebar(open) {
  sidebar.classList.toggle("is-open", open);
  scrim.hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
}

render($("[data-sidebar-toggle]"), icon("menu", 20));

delegate(document.body, "click", "[data-sidebar-toggle]", () => setSidebar(!sidebar.classList.contains("is-open")));
delegate(document.body, "click", "[data-sidebar-scrim]", () => setSidebar(false));
delegate(document.body, "click", ".nav__link", () => setSidebar(false));

/* --- Auth actions --- */

delegate(document.body, "click", "[data-auth]", (_event, target) => openAuthDialog(target.dataset.auth));
delegate(document.body, "click", "[data-logout]", async () => {
  await logout();
  navigate("/feed");
});

/* --- Boot --- */

const router = createRouter({
  outlet: $("[data-outlet]"),
  routes,
  guard: (route) => !route.protected || isAuthenticated(),
});

// The active screen's hue drives --hue / --hue-soft for the whole document,
// so page chrome and navigation always agree on the section colour.
onRouteChange((route) => {
  document.body.dataset.hue = route.id;
  renderNav(route.id);
});

renderAccount();
renderNav(parseHash().path.slice(1));

// Resolve who is logged in before the first route renders, so a protected route
// survives a page refresh instead of bouncing to the feed.
await restoreSession();
renderAccount();
await router.start();
mountAssistant();

// From here on, the sidebar and the active route react to session changes.
session.select((state) => state.status, (status) => {
  renderAccount();
  renderNav(router.current()?.id);

  if (status === "guest" && router.current()?.protected) navigate("/feed");
  else router.refresh();
});
