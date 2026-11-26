import { assertConfig, config } from "./config/environment.js";
import { createApp } from "./app.js";
import { pool } from "./config/database.js";
import { runMigrations } from "./db/run-migrate.js";

assertConfig();

if (config.autoMigrate) {
  try {
    const { version, warnings } = await runMigrations();
    console.log(`Database schema is up to date (server ${version}).`);
    warnings.forEach((w) => console.warn(`Warning: ${w}`));
  } catch (e) {
    console.error(`Migration failed: ${e.message}`);
    process.exit(1);
  }
}
const server = createApp().listen(config.port, () => {
  console.log(`Hospital server listening on port ${config.port}`);
  // Not secret: shows which websites the server accepts, to make CORS problems easy to diagnose.
  console.log(`Allowed websites (CORS_ORIGINS): ${config.corsOrigins.join(" | ")}`);
});

const stop = async () => {
  server.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);