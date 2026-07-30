/**
 * Hash router with a single source of truth for the route table.
 *
 * The nav is generated from the same table the router resolves against, so a
 * nav entry can never point at a view that does not exist — which is exactly
 * how the previous tab system broke.
 */

let routes = [];
let outlet = null;
let currentView = null;
let currentRoute = null;
let guard = () => true;
const changeListeners = new Set();

const normalize = (path) => {
  const clean = String(path || "").trim();
  return clean.startsWith("/") ? clean : `/${clean}`;
};

/** Splits "#/rooms?room=x" into { path: "/rooms", query: URLSearchParams }. */
export function parseHash(hash = window.location.hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const [path, queryString = ""] = raw.split("?");
  return {
    path: normalize(path || routes[0]?.path || "/"),
    query: new URLSearchParams(queryString),
  };
}

const findRoute = (path) => routes.find((route) => route.path === path) || null;

async function resolve() {
  const { path, query } = parseHash();
  const route = findRoute(path);

  if (!route) {
    navigate(routes[0].path, { replace: true });
    return;
  }

  if (route.protected && !guard(route)) {
    navigate(routes[0].path, { replace: true });
    return;
  }

  if (currentView?.destroy) currentView.destroy();
  outlet.replaceChildren();

  const container = document.createElement("div");
  container.className = "view";
  container.dataset.view = route.id;
  outlet.append(container);

  currentRoute = route;
  currentView = route.view;
  changeListeners.forEach((listener) => listener(route));
  document.title = `${route.title} · VShare`;

  await route.view.render(container, { query, route });
}

export function createRouter({ outlet: outletNode, routes: routeTable, guard: guardFn }) {
  outlet = outletNode;
  routes = routeTable;
  if (guardFn) guard = guardFn;

  window.addEventListener("hashchange", resolve);

  return {
    start: resolve,
    /** Re-runs the active route, e.g. after login changes what it may show. */
    refresh: resolve,
    routes: () => routes,
    current: () => currentRoute,
  };
}

export function navigate(target, { replace = false } = {}) {
  const next = `#${normalize(target)}`;
  if (window.location.hash === next) {
    resolve();
    return;
  }
  if (replace) window.location.replace(next);
  else window.location.hash = next;
}

export function onRouteChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}
