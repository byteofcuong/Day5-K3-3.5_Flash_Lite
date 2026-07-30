import jwt from "jsonwebtoken";
import { getSession, getUser } from "./firebase.js";

function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET phải có ít nhất 32 ký tự.");
  }
  return process.env.JWT_SECRET;
}

export function signAccessToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, sid: sessionId, role: user.role, email: user.email },
    secret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h", issuer: "vshare-api", audience: "vshare-web" },
  );
}

export async function requireAuth(request, response, next) {
  try {
    const header = request.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return response.status(401).json({ error: "Bạn cần đăng nhập." });
    const payload = jwt.verify(header.slice(7), secret(), { issuer: "vshare-api", audience: "vshare-web" });
    const [session, user] = await Promise.all([getSession(payload.sid), getUser(payload.sub)]);
    if (!session || session.revoked || new Date(session.expiresAt) <= new Date()) {
      return response.status(401).json({ error: "Phiên đăng nhập đã hết hạn hoặc bị thu hồi." });
    }
    if (!user || user.status !== "active") return response.status(403).json({ error: "Tài khoản không hoạt động." });
    request.auth = { user, sessionId: payload.sid };
    next();
  } catch {
    response.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

export function requireRole(...roles) {
  return (request, response, next) => roles.includes(request.auth?.user?.role)
    ? next()
    : response.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này." });
}

export function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
