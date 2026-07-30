import { createRepository } from "./base.repo.js";

const repo = createRepository("documents", "doc");

const byNewest = (a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || ""));

export const documentsRepo = {
  ...repo,

  /**
   * @param {object} [options]
   * @param {string} [options.ownerId]        restrict to one owner
   * @param {boolean} [options.includeUnavailable]  include soft-deleted docs
   * @param {string} [options.category]
   * @param {string} [options.search]         matches title, summary and tags
   */
  list({ ownerId, includeUnavailable = false, category, search } = {}) {
    const needle = String(search || "").trim().toLowerCase();
    return repo
      .all()
      .filter((doc) => (includeUnavailable ? true : doc.available === true))
      .filter((doc) => (ownerId ? doc.ownerId === ownerId : true))
      .filter((doc) => (category ? doc.category === category : true))
      .filter((doc) => {
        if (!needle) return true;
        const haystack = `${doc.title} ${doc.summary} ${(doc.tags || []).join(" ")}`.toLowerCase();
        return haystack.includes(needle);
      })
      .sort(byNewest);
  },

  findAvailable(id, includeUnavailable = false) {
    const doc = repo.findById(id);
    if (!doc) return null;
    return includeUnavailable || doc.available === true ? doc : null;
  },

  /** Catalog handed to the AI agent — availability filtering happens here, once. */
  catalog() {
    return repo.all().filter((doc) => doc.available === true);
  },

  async incrementDownload(id) {
    const doc = repo.findById(id);
    if (!doc) return null;
    return repo.update(id, { downloadCount: (doc.downloadCount || 0) + 1 });
  },

  countByOwner(ownerId) {
    return repo.all().filter((doc) => doc.ownerId === ownerId && doc.available === true).length;
  },
};
