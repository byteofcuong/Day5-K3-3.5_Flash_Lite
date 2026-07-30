import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { badRequest, conflict, forbidden, unauthorized } from "../lib/errors.js";
import { normalizeEmail, nowIso } from "../lib/ids.js";
import { sessionsRepo } from "../repositories/sessions.repo.js";
import { toPublicUser, usersRepo } from "../repositories/users.repo.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, sid: sessionId, role: user.role, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, issuer: config.jwt.issuer, audience: config.jwt.audience },
  );
}

async function startSession(user, userAgent) {
  const session = await sessionsRepo.insert({
    userId: user.id,
    revoked: false,
    userAgent: userAgent || "",
    expiresAt: new Date(Date.now() + config.jwt.sessionTtlMs).toISOString(),
  });
  return { token: signToken(user, session.id), user: toPublicUser(user) };
}

export async function register({ email, displayName, password, userAgent }) {
  const normalizedEmail = normalizeEmail(email);
  const name = String(displayName || "").trim();

  if (!EMAIL_PATTERN.test(normalizedEmail)) throw badRequest("Email không hợp lệ.", "INVALID_EMAIL");
  if (name.length < 2 || name.length > 60) throw badRequest("Tên phải có từ 2 đến 60 ký tự.", "INVALID_NAME");
  if (String(password || "").length < 8) throw badRequest("Mật khẩu cần ít nhất 8 ký tự.", "WEAK_PASSWORD");
  if (usersRepo.findByEmail(normalizedEmail)) throw conflict("Email đã được sử dụng.", "EMAIL_TAKEN");

  const user = await usersRepo.insert({
    email: normalizedEmail,
    displayName: name,
    passwordHash: await bcrypt.hash(String(password), 10),
    role: "member",
    status: "active",
    avatarUrl: "",
    bio: "",
  });

  return startSession(user, userAgent);
}

export async function login({ email, password, userAgent }) {
  const user = usersRepo.findByEmail(email);
  const matches = user && (await bcrypt.compare(String(password || ""), user.passwordHash));
  // Same message for unknown email and wrong password — no account enumeration.
  if (!matches) throw unauthorized("Email hoặc mật khẩu không đúng.", "INVALID_CREDENTIALS");
  if (user.status !== "active") throw forbidden("Tài khoản đã bị khóa.", "ACCOUNT_LOCKED");
  return startSession(user, userAgent);
}

export async function logout(sessionId) {
  await sessionsRepo.revoke(sessionId);
  return { message: "Đã đăng xuất." };
}

/** Resolves a bearer token to { user, sessionId }; throws on any invalid state. */
export function authenticate(authorizationHeader) {
  const header = String(authorizationHeader || "");
  if (!header.startsWith("Bearer ")) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  } catch {
    throw unauthorized("Phiên đăng nhập đã hết hạn.", "TOKEN_EXPIRED");
  }

  const session = sessionsRepo.findById(payload.sid);
  if (!sessionsRepo.isUsable(session)) throw unauthorized("Phiên đăng nhập đã hết hạn hoặc bị thu hồi.", "SESSION_INVALID");

  const user = usersRepo.findById(payload.sub);
  if (!user || user.status !== "active") throw forbidden("Tài khoản không hoạt động.", "ACCOUNT_INACTIVE");

  return { user, sessionId: payload.sid, authenticatedAt: nowIso() };
}
