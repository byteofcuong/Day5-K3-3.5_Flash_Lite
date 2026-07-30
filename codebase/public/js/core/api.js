/**
 * Single HTTP entry point for the app.
 *
 * Owns: auth header injection, JSON encoding, error normalisation and the
 * global 401 signal. No view builds a fetch() call by hand.
 */

const TOKEN_KEY = "vshare_token";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let token = localStorage.getItem(TOKEN_KEY) || "";
const unauthorizedListeners = new Set();

export function getToken() {
  return token;
}

export function setToken(value) {
  token = value || "";
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Fires whenever the server rejects our token, so the session can reset once. */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const isFormData = body instanceof FormData;
  if (body && !isFormData && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: finalHeaders,
      signal,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Không kết nối được máy chủ.", 0, "NETWORK_ERROR");
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      setToken("");
      unauthorizedListeners.forEach((listener) => listener());
    }
    throw new ApiError(payload.error || `Lỗi máy chủ (${response.status}).`, response.status, payload.code || "ERROR");
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

/** Path builders — keeps endpoint strings out of the views. */
export const endpoints = {
  health: "/api/health",
  register: "/api/auth/register",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  me: "/api/auth/me",
  documents: "/api/documents",
  myDocuments: "/api/my/documents",
  contributors: "/api/contributors",
  document: (id) => `/api/documents/${encodeURIComponent(id)}`,
  download: (id) => `/api/documents/${encodeURIComponent(id)}/download`,
  ratings: (id) => `/api/documents/${encodeURIComponent(id)}/ratings`,
  rate: (id) => `/api/documents/${encodeURIComponent(id)}/rate`,
  summarize: (id) => `/api/documents/${encodeURIComponent(id)}/summarize`,
  flashcards: (id) => `/api/documents/${encodeURIComponent(id)}/flashcards`,
  documentChat: (id) => `/api/documents/${encodeURIComponent(id)}/chat`,
  search: "/api/search",
  chat: "/api/chat",
  rooms: "/api/rooms",
  roomMessages: (id) => `/api/rooms/${encodeURIComponent(id)}/messages`,
};
