import "dotenv/config";

const num = (v, d) =>
  v !== undefined && v !== "" && Number.isFinite(Number(v))
    ? Number(v)
    : d;

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: num(process.env.PORT, 4000),

  db: {
    host: (process.env.DB_HOST ?? "").trim(),
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? "",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "",
    ssl: process.env.DB_SSL === "true",
  },

  // Set AUTO_MIGRATE=true to create/upgrade tables every time the server starts (safe: every statement is IF NOT EXISTS).
  autoMigrate: process.env.AUTO_MIGRATE === "true",

  jwtSecret: process.env.JWT_SECRET ?? "",

  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),

  accessMinutes: num(process.env.ACCESS_TOKEN_MINUTES, 30),
  refreshDays: num(process.env.REFRESH_TOKEN_DAYS, 7),
  minPasswordLength: num(process.env.MIN_PASSWORD_LENGTH, 10),
  emergencyMinutes: num(process.env.EMERGENCY_MINUTES, 60),

  loginRateLimit: num(process.env.LOGIN_RATE_LIMIT, 200),
  refreshRateLimit: num(process.env.REFRESH_RATE_LIMIT, 600),

  maxFailedLogins: 5,
  lockMinutes: 15,
};

const LOOPBACK = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/i;

export function assertDatabaseConfig() {
  const missing = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
  ].filter((k) => !String(process.env[k] ?? "").trim());

  if (missing.length) {
    throw new Error(
      `Missing database settings: ${missing.join(", ")}.`
    );
  }

  const host = config.db.host;

  if (
    LOOPBACK.test(host) ||
    host.includes("://") ||
    host.includes("/")
  ) {
    throw new Error(
      "DB_HOST must be a hosted MySQL hostname, without https:// or a URL path."
    );
  }
}

export function assertConfig() {
  assertDatabaseConfig();

  if (config.jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a random string of at least 32 characters."
    );
  }

  if (config.corsOrigins.length === 0) {
    throw new Error(
      "CORS_ORIGINS must contain at least one permitted frontend origin."
    );
  }
}