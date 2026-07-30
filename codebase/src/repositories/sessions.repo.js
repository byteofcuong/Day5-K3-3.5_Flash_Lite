import { createRepository } from "./base.repo.js";
import { persist } from "../store/json-store.js";

const repo = createRepository("sessions", "sess");

export const sessionsRepo = {
  ...repo,

  isUsable(session) {
    return Boolean(session) && !session.revoked && new Date(session.expiresAt) > new Date();
  },

  async revoke(id) {
    return repo.update(id, { revoked: true, revokedAt: new Date().toISOString() });
  },

  /** Keeps db.json from growing without bound across restarts. */
  async purgeExpired() {
    const items = repo.all();
    const cutoff = Date.now();
    let removed = 0;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (new Date(items[index].expiresAt).getTime() <= cutoff) {
        items.splice(index, 1);
        removed += 1;
      }
    }
    if (removed) await persist();
    return removed;
  },
};
