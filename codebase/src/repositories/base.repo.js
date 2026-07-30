import { collection, persist } from "../store/json-store.js";
import { newId, nowIso } from "../lib/ids.js";

/**
 * Thin CRUD helper shared by every repository. Repositories stay declarative and
 * only add the query logic that is actually specific to their collection.
 */
export function createRepository(name, idPrefix) {
  const all = () => collection(name);

  return {
    all,

    find(predicate) {
      return all().find(predicate) || null;
    },

    filter(predicate) {
      return all().filter(predicate);
    },

    findById(id) {
      return all().find((item) => item.id === id) || null;
    },

    async insert(data) {
      const record = { id: data.id || newId(idPrefix), createdAt: nowIso(), updatedAt: nowIso(), ...data };
      all().push(record);
      await persist();
      return record;
    },

    async update(id, patch) {
      const record = this.findById(id);
      if (!record) return null;
      Object.assign(record, patch, { updatedAt: nowIso() });
      await persist();
      return record;
    },

    async remove(id) {
      const items = all();
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      await persist();
      return true;
    },
  };
}
