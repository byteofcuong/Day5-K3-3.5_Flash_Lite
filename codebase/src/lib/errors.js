/**
 * Single error type carried from services up to the error middleware, so route
 * handlers never build status codes by hand.
 */
export class HttpError extends Error {
  constructor(status, message, code = "ERROR") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = "BAD_REQUEST") => new HttpError(400, message, code);
export const unauthorized = (message = "Bạn cần đăng nhập.", code = "UNAUTHORIZED") => new HttpError(401, message, code);
export const forbidden = (message = "Bạn không có quyền thực hiện thao tác này.", code = "FORBIDDEN") => new HttpError(403, message, code);
export const notFound = (message = "Không tìm thấy tài nguyên.", code = "NOT_FOUND") => new HttpError(404, message, code);
export const conflict = (message, code = "CONFLICT") => new HttpError(409, message, code);
export const upstream = (message = "Dịch vụ AI không phản hồi.", code = "UPSTREAM_ERROR") => new HttpError(502, message, code);
