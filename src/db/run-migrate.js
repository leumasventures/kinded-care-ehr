import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { config, assertDatabaseConfig } from "../config/environment.js";
import { applySchema } from "./migrate.js";

/** Opens its own connection (multipleStatements is needed for the .sql files), applies the schema, closes it. */
export async function runMigrations() {
  assertDatabaseConfig();
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true,
    timezone: "Z",
    dateStrings: true,
    charset: "utf8mb4",
  });
  try {
    return await applySchema(conn);
  } finally {
    await conn.end();
  }
}

// `npm run migrate` / `node src/db/run-migrate.js`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(({ version, warnings }) => {
      console.log(`Database schema is up to date (server ${version}).`);
      warnings.forEach((w) => console.warn(`Warning: ${w}`));
      process.exit(0);
    })
    .catch((e) => {
      console.error(`Migration failed: ${e.message}`);
      process.exit(1);
    });
}
