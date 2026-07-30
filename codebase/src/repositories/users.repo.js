import { createRepository } from "./base.repo.js";
import { normalizeEmail } from "../lib/ids.js";

const repo = createRepository("users", "user");

export const usersRepo = {
  ...repo,
  findByEmail(email) {
    const normalized = normalizeEmail(email);
    return repo.find((user) => normalizeEmail(user.email) === normalized);
  },
  listActive() {
    return repo.filter((user) => user.status === "active");
  },
};

/** Strips the password hash before a user object crosses the HTTP boundary. */
export function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}
