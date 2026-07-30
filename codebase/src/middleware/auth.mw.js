import { authenticate } from "../services/auth.service.js";

/** Rejects the request unless a valid session is present. */
export function requireAuth(request, _response, next) {
  try {
    request.auth = authenticate(request.headers.authorization);
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches request.auth when a valid token is present, but never rejects. */
export function optionalAuth(request, _response, next) {
  try {
    request.auth = authenticate(request.headers.authorization);
  } catch {
    request.auth = null;
  }
  next();
}

export function requireRole(...roles) {
  return (request, _response, next) => {
    if (roles.includes(request.auth?.user?.role)) return next();
    const error = new Error("Bạn không có quyền thực hiện thao tác này.");
    error.status = 403;
    error.code = "FORBIDDEN";
    next(error);
  };
}
