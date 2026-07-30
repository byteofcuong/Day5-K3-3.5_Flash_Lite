/**
 * Rebuilds data/db.json from data/catalog.json and the demo fixtures.
 * Run with:  npm run seed        (refuses to overwrite an existing db)
 *            npm run seed -- --force
 */
import fs from "node:fs/promises";
import { paths } from "../src/config/env.js";
import { buildSeed, DEMO_PASSWORD } from "../src/store/seed.js";
import { flushNow, loadStore, resetStore } from "../src/store/json-store.js";

const force = process.argv.includes("--force");

const exists = await fs
  .access(paths.dbFile)
  .then(() => true)
  .catch(() => false);

if (exists && !force) {
  console.error("data/db.json đã tồn tại. Dùng: npm run seed -- --force để ghi đè.");
  process.exit(1);
}

if (exists) await fs.rm(paths.dbFile);

resetStore();
const state = await loadStore(buildSeed);
await flushNow();

const counts = Object.entries(state.collections)
  .map(([name, items]) => `${name}=${items.length}`)
  .join(", ");

console.log(`Đã tạo data/db.json (${counts})`);
console.log(`Tài khoản demo: admin@vshare.local / viet@vshare.local — mật khẩu: ${DEMO_PASSWORD}`);
