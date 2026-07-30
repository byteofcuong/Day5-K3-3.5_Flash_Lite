import { assertConfig, config } from "./config/env.js";
import { createApp } from "./app.js";
import { flushNow } from "./store/json-store.js";

assertConfig();

const app = await createApp();

if (!config.isTest) {
  const server = app.listen(config.port, () => {
    console.log(`VShare: http://localhost:${config.port}`);
    console.log(`  chế độ AI: ${config.ai.mock ? "mock" : `gemini (${config.ai.model})`}`);
    console.log(`  dữ liệu:   data/db.json`);
  });

  // Make sure a debounced write is not lost when the process is stopped.
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await flushNow();
      server.close(() => process.exit(0));
    });
  }
}

export { app };
