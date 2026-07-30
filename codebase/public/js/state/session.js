import { api, endpoints, getToken, onUnauthorized, setToken } from "../core/api.js";
import { createStore } from "../core/store.js";

/**
 * Owns "who is logged in". Views read from it and never touch localStorage or
 * the token directly.
 *
 * status: "unknown" until restore() has resolved, then "guest" | "authenticated".
 */
export const session = createStore({ status: "unknown", user: null, error: "" });

export const isAuthenticated = () => session.get().status === "authenticated";
export const currentUser = () => session.get().user;

/**
 * Rehydrates the session on boot. The previous version only kept the token and
 * assumed a logged-out user after every refresh.
 */
export async function restoreSession() {
  if (!getToken()) {
    session.set({ status: "guest", user: null });
    return;
  }
  try {
    const { user } = await api.get(endpoints.me);
    session.set({ status: "authenticated", user, error: "" });
  } catch {
    setToken("");
    session.set({ status: "guest", user: null });
  }
}

export async function login(credentials) {
  const { token, user } = await api.post(endpoints.login, credentials);
  setToken(token);
  session.set({ status: "authenticated", user, error: "" });
  return user;
}

export async function register(details) {
  const { token, user } = await api.post(endpoints.register, details);
  setToken(token);
  session.set({ status: "authenticated", user, error: "" });
  return user;
}

export async function logout() {
  try {
    await api.post(endpoints.logout);
  } catch {
    // A revoked or expired session is already logged out server-side.
  }
  setToken("");
  session.set({ status: "guest", user: null });
}

// A 401 from any request means the session is gone; reflect that once, centrally.
onUnauthorized(() => session.set({ status: "guest", user: null }));
