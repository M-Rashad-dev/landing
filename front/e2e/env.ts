import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Isolated E2E stack: its own database and ports, so it never touches the dev data. */
export const E2E = {
  database: process.env.E2E_DB_DATABASE ?? "landing_e2e",
  laravelPort: 8011,
  nextPort: 3100,
  backDir: resolve(__dirname, "../../back"),
  frontDir: resolve(__dirname, ".."),
  /** Portable PHP on the Windows dev box, `php` elsewhere. */
  php: process.env.PHP_BIN ?? (existsSync(resolve(__dirname, "../../tools/php/php.exe")) ? resolve(__dirname, "../../tools/php/php.exe") : "php"),
};

export const APP_URL = `http://app.localhost:${E2E.nextPort}`;
export const siteUrl = (host: string, path = "/") => `http://${host}:${E2E.nextPort}${path}`;

/** Laravel environment for the E2E run (overrides back/.env). */
export const laravelEnv = {
  DB_DATABASE: E2E.database,
  APP_ENV: "local",
  CACHE_STORE: "database",
  QUEUE_CONNECTION: "sync",
  FRONT_INTERNAL_URL: `http://127.0.0.1:${E2E.nextPort}`,
  PUBLIC_SCHEME: "http",
  PUBLIC_PORT: String(E2E.nextPort),
};
